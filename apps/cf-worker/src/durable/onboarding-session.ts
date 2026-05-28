/**
 * Onboarding Session Durable Object
 *
 * Manages personalized onboarding flows with:
 * - Preset questions from database
 * - AI-generated personalized questions using AI SDK
 * - Session persistence and timeout handling
 * - Configurable models and prompts via database
 * - Direct storage to Graph DO (no user_memory collection)
 */

import { Agent } from 'agents';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { getDb } from '../lib/db';
import type { Database } from '@repo/db/types';
import {
	configOnboarding,
	configOnboardingQuestions,
	configOnboardingProfiles,
	configOnboardingProfileQuestions,
	configTagCatalog,
	configTagNamespaces,
	userOnboardingAssignments,
	userOnboardingAuditEvents,
	users,
	planPackages,
	planPaymentTransactions,
	coreCreditLedger,
	userCustomization,
	aiAgents,
	aiPrompts,
	aiAgentModels,
	aiProviders
} from '@repo/db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { MemoryGraphService } from '../graph/memory-graph-service';
import type { Env, GraphNode, GraphEdge } from '../types';
import type {
	Question,
	ProfilerData,
	OnboardingAgentState,
	OnboardingSession,
	OnboardingConfig,
	OnboardingResponse,
	OnboardingStartRequest,
	OnboardingAnswerRequest,
	CachedQuestions,
	CachedConfig,
	OnboardingAnswerValue
} from '../types/onboarding';
import {
	getPrompt,
	interpolatePrompt,
	DEFAULT_PROMPTS,
	ONBOARDING_SYSTEM_PROMPT,
	ONBOARDING_QUESTION_USER,
	buildOnboardingQuestionSystemPrompt
} from '../utils/prompts';
import { getModelConfigWithFallback, getModelFromConfig } from '../utils/model-factory';
import { trackInferenceCost } from '../utils/cost-tracker';
import { createLogger, formatError } from '../utils/logger';
import { configurePostHogLogger } from '../utils/posthog-logger';
import { ConfigError, ValidationError } from '../utils/errors';
import { filterVisibleAgents } from '../utils/tag-visibility';
import { getUserTags } from '../utils/tag-resolver';
import {
	resolveDashboardTemplate,
	instantiateDashboardFromTemplate
} from '../services/dashboard-template';
import {
	buildCompletionTags,
	buildOnboardingTags as buildSessionOnboardingTags
} from '../services/onboarding-tags';
import {
	isLegacyFinanceFallbackQuestion,
	selectFallbackAIQuestion,
	resolveOnboardingAIQuestionModel
} from '../utils/onboarding-ai-helpers';
import {
	buildFlowAnswerState,
	findNextVisibleQuestion,
	normalizeQuestionType
} from '../services/onboarding-flow';
import { normalizeOnboardingAnswer } from '../services/onboarding-answers';
import {
	buildTranscriptEvent,
	formatTranscriptForProfiler
} from '../services/onboarding-transcript';
import { createProfilerDispatcher } from '../services/profiler-dispatcher';

// ============================================================================
// Constants
// ============================================================================

type OnboardingQuestionRecord = {
	id: string;
	question: string | null;
	type: string | null;
	description: string | null;
	sidebarTitle: string | null;
	factKey: string | null;
	options: unknown;
	order: string | number | null;
	created: string | null;
	updated: string | null;
	enabled: boolean | null;
	required: boolean | null;
	showWhen: unknown | null;
	group: string | null;
	metadata: unknown | null;
};

function isOnboardingQuestionSchemaMismatch(error: unknown): boolean {
	const message =
		error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
	return (
		message.includes('config_onboarding_questions') &&
		['enabled', 'required', 'show_when', 'metadata', 'group'].some((column) =>
			message.includes(column)
		)
	);
}

async function loadOnboardingQuestionRecords(db: Database): Promise<OnboardingQuestionRecord[]> {
	try {
		return await db
			.select()
			.from(configOnboardingQuestions)
			.orderBy(asc(configOnboardingQuestions.order));
	} catch (error) {
		if (!isOnboardingQuestionSchemaMismatch(error)) throw error;

		const legacyRows = await db.execute<OnboardingQuestionRecord>(sql`
			SELECT
				id,
				question,
				type,
				description,
				sidebar_title AS "sidebarTitle",
				fact_key AS "factKey",
				options,
				"order",
				created,
				updated,
				true AS enabled,
				true AS required,
				NULL::jsonb AS "showWhen",
				NULL::text AS "group",
				NULL::jsonb AS metadata
			FROM config_onboarding_questions
			ORDER BY "order"
		`);

		return legacyRows.rows;
	}
}

const DEFAULT_MAX_AI_QUESTIONS = 3;
const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function resolveMaxAiQuestions(config: OnboardingConfig): number {
	return Number.isFinite(config.max_ai_questions)
		? config.max_ai_questions
		: DEFAULT_MAX_AI_QUESTIONS;
}

function numberOrDefault(raw: unknown, fallback: number): number {
	if (raw == null) return fallback;
	const value = Number(raw);
	return Number.isFinite(value) ? value : fallback;
}

// ============================================================================
// Zod Schema for AI Response Validation
// ============================================================================

const aiQuestionResponseSchema = z
	.object({
		question: z.object({
			id: z.string(),
			factKey: z.string(),
			factLabel: z.string(),
			type: z.enum(['checkbox', 'multiselect', 'text', 'number']),
			question: z.string(),
			sidebarTitle: z.string(),
			description: z.string().nullable(),
			options: z.array(
				z.object({
					value: z.string(),
					label: z.string(),
					icon: z.string().nullable(),
					description: z.string().nullable()
				})
			),
			required: z.boolean()
		}),
		reasoning: z.string()
	})
	.refine(
		(data) => {
			// For checkbox and multiselect, options must have at least 2 items
			if (data.question.type === 'checkbox' || data.question.type === 'multiselect') {
				return data.question.options && data.question.options.length >= 2;
			}
			return true;
		},
		{
			message: 'checkbox and multiselect questions must have at least 2 options',
			path: ['question', 'options']
		}
	);

// ============================================================================
// Default System Prompt (imported from constants/prompts.ts)
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = ONBOARDING_SYSTEM_PROMPT;
const GENERIC_PROFILE_ONBOARDING_SYSTEM_PROMPT = `You are creating a personalized onboarding experience for the specific profile selected by the user.

Use only the profile's domain, audience, goals, and collected answers as context. Ask one concise follow-up question that helps personalize recommendations for that profile. Do not assume the profile is about finance, investing, portfolios, retirement, or risk tolerance unless the profile prompt explicitly says so.

**Current Profile Data:**
{{profiler_data}}

**Previous Answers:**
{{previous_answers}}`;

function cloneSession(session: OnboardingSession | null): OnboardingSession | null {
	return session ? structuredClone(session) : null;
}

// ============================================================================
// Profile-Scoped Config Helpers (re-exported for external use)
// ============================================================================

export { buildProfileConfig, buildProfileQuestions } from '../utils/profile-config';
import { buildProfileConfig } from '../utils/profile-config';
import { buildProfileQuestions } from '../utils/profile-config';

// ============================================================================
// Onboarding Agent
// ============================================================================

export class OnboardingAgent extends Agent<Env, OnboardingAgentState> {
	initialState: OnboardingAgentState = {
		session: null
	};

	private session: OnboardingSession | null = null;
	private cachedQuestions: CachedQuestions | null = null;
	private cachedConfig: CachedConfig | null = null;
	private log = createLogger('OnboardingAgent');

	async onStart(): Promise<void> {
		configurePostHogLogger(this.env);
		this.ensureSessionLoaded();
	}

	private ensureSessionLoaded(): void {
		if (!this.session && this.state.session) {
			this.session = cloneSession(this.state.session);
		}
	}

	private async clearPersistedSession(): Promise<void> {
		this.session = null;
		this.setState({ session: null });
		await this.ctx.storage.deleteAlarm();
		this.cachedQuestions = null;
		this.cachedConfig = null;
	}

	// ============================================================================
	// Database Access
	// ============================================================================

	private async getDatabase(): Promise<Database> {
		return await getDb(this.env);
	}

	// ============================================================================
	// Config Loading
	// ============================================================================

	private async getConfig(): Promise<OnboardingConfig> {
		// Return cached if valid
		if (this.cachedConfig) {
			const ttl = this.cachedConfig.config.cache_ttl_ms || DEFAULT_CACHE_TTL_MS;
			if (Date.now() - this.cachedConfig.fetchedAt < ttl) {
				return this.cachedConfig.config;
			}
		}

		const db = await this.getDatabase();

		try {
			// Query config with LEFT JOINs on system_prompt, model, and model's provider
			const rows = await db
				.select({
					config: configOnboarding,
					prompt: aiPrompts,
					model: aiAgentModels,
					provider: aiProviders
				})
				.from(configOnboarding)
				.leftJoin(aiPrompts, eq(configOnboarding.systemPrompt, aiPrompts.id))
				.leftJoin(aiAgentModels, eq(configOnboarding.model, aiAgentModels.id))
				.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
				.where(eq(configOnboarding.enabled, true));

			if (rows.length === 0) {
				throw new ConfigError('Onboarding config not found or disabled', {
					code: 'ONBOARDING_CONFIG_NOT_FOUND',
					configKey: 'config_onboarding'
				});
			}

			const row = rows[0];
			const config: OnboardingConfig = {
				id: row.config.id,
				system_prompt: row.config.systemPrompt ?? '',
				model: row.config.model ?? '',
				max_ai_questions: numberOrDefault(row.config.maxAiQuestions, DEFAULT_MAX_AI_QUESTIONS),
				session_timeout_ms: Number(row.config.sessionTimeoutMs) || DEFAULT_SESSION_TIMEOUT_MS,
				cache_ttl_ms: Number(row.config.cacheTtlMs) || DEFAULT_CACHE_TTL_MS,
				enabled: row.config.enabled ?? true,
				defaultTags: [],
				visibility: 'public',
				promptTemplate: row.prompt?.promptTemplate ?? null,
				modelId: row.model?.modelId ?? null,
				providerKey: (row.provider?.providerKey as OnboardingConfig['providerKey']) ?? null
			};

			this.log.debug('config_loaded', {
				id: config.id,
				hasPromptTemplate: !!config.promptTemplate,
				hasModel: !!config.modelId,
				hasProvider: !!config.providerKey,
				modelId: config.modelId,
				providerKey: config.providerKey
			});

			this.cachedConfig = {
				config,
				fetchedAt: Date.now()
			};

			return config;
		} catch (error) {
			this.log.error('config_load_failed', { ...formatError(error) });
			// Return a default config for development
			return {
				id: 'default',
				system_prompt: '',
				model: '',
				max_ai_questions: DEFAULT_MAX_AI_QUESTIONS,
				session_timeout_ms: DEFAULT_SESSION_TIMEOUT_MS,
				cache_ttl_ms: DEFAULT_CACHE_TTL_MS,
				enabled: true,
				defaultTags: [],
				visibility: 'public',
				promptTemplate: null,
				modelId: null,
				providerKey: null
			};
		}
	}

	// ============================================================================
	// HTTP Router
	// ============================================================================

	async onRequest(request: Request): Promise<Response> {
		configurePostHogLogger(this.env);
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			this.ensureSessionLoaded();

			switch (path) {
				case '/start':
					return await this.handleStart(request);
				case '/answer':
					return await this.handleAnswer(request);
				case '/skip':
					return await this.handleSkip(request);
				case '/disclosure/respond':
					return await this.handleDisclosureRespond(request);
				case '/state':
					return await this.handleGetState();
				case '/reset':
					await this.clearPersistedSession();
					return this.jsonResponse({ success: true });
				default:
					return this.jsonResponse({ error: 'Not Found' }, 404);
			}
		} catch (error) {
			this.log.error('request_error', { ...formatError(error) });
			return this.errorResponse(error);
		}
	}

	// ============================================================================
	// Handlers
	// ============================================================================

	private async handleStart(request: Request): Promise<Response> {
		const body = await this.parseBody<OnboardingStartRequest>(request);

		if (!body.userId) {
			return this.errorResponse('userId is required', 400);
		}

		const profileId = body.profileId;
		const config = profileId ? await this.getProfileConfig(profileId) : await this.getConfig();
		const presetQuestions = profileId
			? await this.fetchProfileQuestions(profileId)
			: await this.fetchPresetQuestions();
		const maxAiQuestions = resolveMaxAiQuestions(config);

		// Check if there's an existing session for this user
		if (
			this.session &&
			this.session.userId === body.userId &&
			(this.session.profileId ?? null) === (profileId ?? null)
		) {
			const disclosureGateResponse = this.getDisclosureGateResponse(config);
			if (disclosureGateResponse) return disclosureGateResponse;

			if (this.replaceLegacyFinanceFallbackQuestion(config)) {
				await this.persist(config.session_timeout_ms);
			}

			if (this.session.currentQuestion) {
				this.log.info('session_resumed', {
					questionNumber: this.session.currentQuestionNumber,
					userId: body.userId
				});
				// Resume existing session - return current state with counts
				return this.jsonResponse({
					success: true,
					question: this.session.currentQuestion,
					questionNumber: this.session.currentQuestionNumber,
					phase: this.session.phase,
					presetCount: presetQuestions.length,
					maxAiQuestions,
					answeredFacts: this.getAnsweredFacts()
				});
			}
		}

		// Create a fresh session only if none exists
		this.log.info('session_created', { userId: body.userId });

		if (presetQuestions.length === 0) {
			return this.errorResponse('Onboarding questions not configured', 500);
		}

		// Capture location from CF headers (becomes "home" location)
		const capturedLocation = body.cfHeaders
			? {
					country: body.cfHeaders.country,
					timezone: body.cfHeaders.timezone,
					continent: body.cfHeaders.continent,
					city: body.cfHeaders.city
				}
			: undefined;

		if (capturedLocation?.country) {
			this.log.debug('location_captured', {
				country: capturedLocation.country,
				timezone: capturedLocation.timezone
			});
		}

		const firstQuestion = findNextVisibleQuestion(presetQuestions, {
			answersByQuestionId: {},
			answersByFactKey: {}
		});

		if (!firstQuestion) {
			return this.errorResponse('Onboarding questions not configured', 500);
		}

		this.session = {
			userId: body.userId,
			assignmentId: body.assignmentId,
			profileId,
			phase: 'preset',
			status: config.disclosures?.enabled ? 'disclosure_pending' : 'in_progress',
			disclosureResponses: config.disclosures?.enabled ? {} : undefined,
			currentQuestionNumber: 1,
			currentQuestion: firstQuestion,
			profilerData: [],
			skippedQuestionIds: [],
			transcript: [],
			deterministicTags: [],
			aiAssignedTags: [],
			finalTags: [],
			profileExtractionStatus: 'not_started',
			enableAI: false,
			startedAt: Date.now(),
			lastActivityAt: Date.now(),
			capturedLocation
		};

		await this.persist(config.session_timeout_ms);

		// Gate: return disclosures first if enabled
		if (config.disclosures?.enabled) {
			return this.jsonResponse({
				success: true,
				disclosures: config.disclosures,
				disclosuresPending: true,
				phase: 'preset'
			});
		}

		return this.jsonResponse({
			success: true,
			question: this.session.currentQuestion,
			questionNumber: 1,
			phase: 'preset',
			presetCount: presetQuestions.length,
			maxAiQuestions,
			answeredFacts: []
		});
	}

	private async handleAnswer(request: Request): Promise<Response> {
		if (!this.session?.currentQuestion) {
			return this.errorResponse('No active session', 400);
		}

		const body = await this.parseBody<OnboardingAnswerRequest>(request);

		if (this.session.userId !== body.userId) {
			return this.errorResponse('Unauthorized', 403);
		}

		const config = await this.getSessionConfig();
		const disclosureGateResponse = this.getDisclosureGateResponse(config, 409, false);
		if (disclosureGateResponse) return disclosureGateResponse;

		try {
			const normalizedAnswer = normalizeOnboardingAnswer(this.session.currentQuestion, body.answer);
			this.updateProfilerData(this.session.currentQuestion, normalizedAnswer.value);
			this.updateTranscript(this.session.currentQuestion, normalizedAnswer);
			this.session.lastActivityAt = Date.now();

			return await this.determineNextStep();
		} catch (error) {
			return this.errorResponse(error, 400);
		}
	}

	private async handleSkip(request: Request): Promise<Response> {
		if (!this.session?.currentQuestion) {
			return this.errorResponse('No active session', 400);
		}

		const body = await this.parseBody<OnboardingStartRequest>(request);

		if (this.session.userId !== body.userId) {
			return this.errorResponse('Unauthorized', 403);
		}

		const config = await this.getSessionConfig();
		const disclosureGate = this.getDisclosureGateResponse(config, 409, false);
		if (disclosureGate) return disclosureGate;

		if (this.session.currentQuestion.required) {
			return this.errorResponse('This question cannot be skipped', 400);
		}

		this.session.skippedQuestionIds = [
			...(this.session.skippedQuestionIds ?? []).filter(
				(questionId) => questionId !== this.session?.currentQuestion?.id
			),
			this.session.currentQuestion.id
		];
		this.session.lastActivityAt = Date.now();

		void this.writeAuditEvent('question_skipped', {
			questionId: this.session.currentQuestion.id,
			factKey: this.session.currentQuestion.factKey,
			prompt: this.session.currentQuestion.question
		});

		return await this.determineNextStep(true);
	}

	private async handleDisclosureRespond(request: Request): Promise<Response> {
		if (!this.session) {
			return this.errorResponse('No active session', 400);
		}
		const body = await this.parseBody<{ userId: string; responses: Record<string, boolean> }>(
			request
		);
		if (this.session.userId !== body.userId) {
			return this.errorResponse('Unauthorized', 403);
		}

		const config = await this.getSessionConfig();
		if (!config.disclosures?.enabled) {
			return this.errorResponse('Disclosures not enabled', 400);
		}

		const deniedRequired = config.disclosures.items.filter(
			(item) => item.required && body.responses[item.id] !== true
		);
		const rejectMessage =
			deniedRequired[0]?.rejectMessage ??
			(deniedRequired[0]?.type === 'acknowledgement'
				? 'You must acknowledge all required disclosures to proceed.'
				: 'You must agree to all required disclosures to proceed.');

		if (deniedRequired.length > 0) {
			this.session.disclosureResponses = body.responses;
			this.session.status = 'disclosure_pending';
			this.session.lastActivityAt = Date.now();
			await this.persist();

			await this.writeAuditEvent('disclosure_denied', {
				metadata: { deniedItems: deniedRequired.map((i) => i.id), responses: body.responses }
			});

			return this.jsonResponse({
				success: false,
				error: rejectMessage,
				disclosures: config.disclosures,
				disclosuresPending: true,
				rejectMessage
			});
		}

		// All disclosures accepted
		this.session.disclosureResponses = body.responses;
		this.session.status = 'in_progress';
		this.session.lastActivityAt = Date.now();
		await this.persist();

		await this.writeAuditEvent('disclosure_accepted', { metadata: { responses: body.responses } });

		const presetQuestions = await this.fetchSessionPresetQuestions();
		const maxAiQuestions = resolveMaxAiQuestions(config);

		return this.jsonResponse({
			success: true,
			question: this.session.currentQuestion,
			questionNumber: this.session.currentQuestionNumber,
			phase: this.session.phase,
			presetCount: presetQuestions.length,
			maxAiQuestions,
			answeredFacts: this.getAnsweredFacts()
		});
	}

	private async handleGetState(): Promise<Response> {
		if (!this.session) {
			return this.errorResponse('No active session', 400);
		}

		const config = await this.getSessionConfig();

		const disclosureGateResponse = this.getDisclosureGateResponse(config);
		if (disclosureGateResponse) return disclosureGateResponse;

		if (this.replaceLegacyFinanceFallbackQuestion(config)) {
			await this.persist(config.session_timeout_ms);
		}

		if (!this.session.currentQuestion) {
			return this.errorResponse('No active session', 400);
		}

		const presetQuestions = await this.fetchSessionPresetQuestions();

		return this.jsonResponse({
			success: true,
			question: this.session.currentQuestion,
			questionNumber: this.session.currentQuestionNumber,
			phase: this.session.phase,
			presetCount: presetQuestions.length,
			maxAiQuestions: resolveMaxAiQuestions(config),
			answeredFacts: this.getAnsweredFacts()
		});
	}

	// ============================================================================
	// Flow Logic
	// ============================================================================

	private getDisclosureGateResponse(
		config: OnboardingConfig,
		status = 200,
		success = true
	): Response | null {
		if (!this.session || !config.disclosures?.enabled) return null;
		if (this.session.status !== 'disclosure_pending') return null;

		const hasResponses = Object.keys(this.session.disclosureResponses ?? {}).length > 0;
		const deniedRequired = hasResponses
			? config.disclosures.items.filter(
					(item) => item.required && this.session?.disclosureResponses?.[item.id] !== true
				)
			: [];
		const rejectMessage =
			deniedRequired[0]?.rejectMessage ??
			(deniedRequired[0]?.type === 'acknowledgement'
				? 'You must acknowledge all required disclosures to proceed.'
				: deniedRequired.length > 0
					? 'You must agree to all required disclosures to proceed.'
					: undefined);

		return this.jsonResponse(
			{
				success,
				disclosures: config.disclosures,
				disclosuresPending: true,
				rejectMessage,
				phase: this.session.phase,
				error: success
					? undefined
					: (rejectMessage ?? 'You must complete the disclosures before continuing onboarding.')
			},
			status
		);
	}

	private async determineNextStep(_skipped = false): Promise<Response> {
		if (!this.session) {
			return this.errorResponse('Session not found', 400);
		}

		const config = await this.getSessionConfig();
		let nextQuestion: Question | null = null;

		switch (this.session.phase) {
			case 'preset': {
				const presetQuestions = await this.fetchSessionPresetQuestions();
				const state = buildFlowAnswerState(
					this.session.profilerData,
					this.session.skippedQuestionIds ?? []
				);
				nextQuestion = findNextVisibleQuestion(presetQuestions, state);
				if (nextQuestion) {
					this.session.currentQuestionNumber =
						this.session.profilerData.length + (this.session.skippedQuestionIds?.length ?? 0) + 1;
				} else if (resolveMaxAiQuestions(config) <= 0) {
					return await this.completeOnboarding();
				} else {
					// Move to AI prompt question - increment the question number!
					this.session.phase = 'ai-prompt';
					this.session.currentQuestionNumber++; // Now at presetCount + 1 (e.g., 6)
					nextQuestion = this.getAIPromptQuestion();
				}
				break;
			}

			case 'ai-prompt': {
				const answer = this.session.profilerData.find(
					(p) => p.factKey === 'enable_ai_personalization'
				)?.answer;

				if (answer === 'yes') {
					this.session.phase = 'ai-personalized';
					this.session.enableAI = true;
					nextQuestion = await this.generateAIQuestion(config);
					if (nextQuestion) {
						this.session.currentQuestionNumber++;
					} else {
						return await this.completeOnboarding();
					}
				} else {
					return await this.completeOnboarding();
				}
				break;
			}

			case 'ai-personalized': {
				const presetCount = (await this.fetchSessionPresetQuestions()).length;
				// AI question index: currentQuestionNumber - presetCount - 1 (for AI prompt question)
				// e.g., if presetCount=5, currentQuestionNumber=7, aiQuestionIndex = 7 - 5 - 1 = 1 (second AI question)
				const aiQuestionIndex = this.session.currentQuestionNumber - presetCount - 1;
				const maxAI = resolveMaxAiQuestions(config);

				if (aiQuestionIndex >= maxAI) {
					return await this.completeOnboarding();
				}

				nextQuestion = await this.generateAIQuestion(config);
				if (nextQuestion) {
					this.session.currentQuestionNumber++;
				} else {
					return await this.completeOnboarding();
				}
				break;
			}
		}

		this.session.currentQuestion = nextQuestion;
		await this.persist(config.session_timeout_ms);

		if (nextQuestion) {
			const presetQuestions = await this.fetchSessionPresetQuestions();
			return this.jsonResponse({
				success: true,
				question: nextQuestion,
				questionNumber: this.session.currentQuestionNumber,
				phase: this.session.phase,
				presetCount: presetQuestions.length,
				maxAiQuestions: resolveMaxAiQuestions(config),
				answeredFacts: this.getAnsweredFacts()
			});
		}

		return await this.completeOnboarding();
	}

	private async completeOnboarding(): Promise<Response> {
		if (!this.session) {
			return this.errorResponse('Session not found', 400);
		}

		const userId = this.session.userId;
		const profilerData = this.session.profilerData;
		const capturedLocation = this.session.capturedLocation;
		const transcript = this.session.transcript ?? [];

		try {
			// Store onboarding facts directly to Graph DO (includes captured location)
			await this.storeOnboardingToGraph(userId, profilerData, capturedLocation);

			const db = await this.getDatabase();

			// Auto-activate trial plan and assign credits
			await this.activateTrialPlan(db, userId);
			const config = await this.getSessionConfig();

			// Build deterministic tags (geo from location, role from profiler, option-granted tags, profile defaults)
			const onboardingTags = buildSessionOnboardingTags({
				capturedLocation,
				profilerData,
				transcript,
				defaultTags: config.defaultTags
			});

			// AI-assign tags from the system tag catalog based on profiler answers
			const aiTags = await this.assignTagsFromCatalog(db, userId, profilerData);

			// Merge all tags (geo + role + defaults + AI-assigned) and persist
			const allTags = buildCompletionTags({
				capturedLocation,
				profilerData,
				transcript,
				defaultTags: config.defaultTags,
				aiTags
			});
			this.session.deterministicTags = onboardingTags;
			this.session.aiAssignedTags = aiTags;
			this.session.finalTags = allTags;
			await this.persistOnboardingTags(db, userId, allTags);

			// Select personalized agent shelf using AI (only from visible agents)
			await this.selectAgentShelf(db, userId, profilerData, allTags);

			// Assign dashboard template based on user tags (with widget-level gating)
			await this.assignDashboardTemplate(db, userId, allTags);

			// Mark user as onboarding complete
			await db
				.update(users)
				.set({
					onboardingComplete: true,
					updated: new Date().toISOString()
				})
				.where(eq(users.id, userId));

			if (this.session.assignmentId) {
				await db
					.update(userOnboardingAssignments)
					.set({
						completedAt: new Date().toISOString(),
						transcript,
						updated: new Date().toISOString()
					})
					.where(
						and(
							eq(userOnboardingAssignments.id, this.session.assignmentId),
							eq(userOnboardingAssignments.user, userId)
						)
					);
			}

			this.session.phase = 'completed';
			this.session.status = 'extracting_profile';
			this.session.completedAt = Date.now();
			this.session.profileExtractionStatus = 'running';
			await this.persist();

			void this.writeAuditEvent('onboarding_completed', {
				status: 'completed',
				metadata: {
					answeredCount: profilerData.length,
					skippedCount: this.session.skippedQuestionIds?.length ?? 0,
					tagCount: allTags.length
				}
			});

			let extractionPending = false;
			try {
				await this.extractProfileFromTranscript(db, userId, transcript, allTags, capturedLocation);
				if (this.session) {
					this.session.profileExtractionStatus = 'succeeded';
					this.session.status = 'completed';
				}
			} catch (error) {
				extractionPending = true;
				if (this.session) {
					this.session.profileExtractionStatus = 'pending_retry';
					this.session.status = 'profile_extraction_pending';
					this.session.nextRetryAt = Date.now() + 10 * 60 * 1000;
				}
				this.log.error('profile_extraction_pending', { userId, ...formatError(error) });
			}

			if (extractionPending) {
				await this.persist();
			} else {
				await this.clearPersistedSession();
			}

			return this.jsonResponse({
				success: true,
				completed: true,
				profileExtractionPending: extractionPending,
				message: extractionPending
					? 'Onboarding completed; profile extraction will retry'
					: 'Onboarding completed and stored to memory graph'
			});
		} catch (error) {
			this.log.error('complete_failed', { ...formatError(error) });
			return this.errorResponse('Failed to save onboarding data', 500);
		}
	}

	private async extractProfileFromTranscript(
		db: Database,
		userId: string,
		transcript: NonNullable<OnboardingSession['transcript']>,
		userTags: string[],
		capturedLocation?: { country?: string; timezone?: string; continent?: string; city?: string }
	): Promise<void> {
		const transcriptText = formatTranscriptForProfiler(transcript);
		const locationText = capturedLocation
			? [
					capturedLocation.country ? `Detected country: ${capturedLocation.country}` : null,
					capturedLocation.timezone ? `Detected timezone: ${capturedLocation.timezone}` : null,
					capturedLocation.continent ? `Detected continent: ${capturedLocation.continent}` : null,
					capturedLocation.city ? `Detected city: ${capturedLocation.city}` : null
				]
					.filter(Boolean)
					.join('\n')
			: '';

		const messages = [
			{
				userMessage: [transcriptText, locationText].filter(Boolean).join('\n\n'),
				assistantResponse: 'Onboarding completed.'
			}
		];

		const dispatcher = createProfilerDispatcher({
			env: this.env,
			db,
			userId,
			sessionId: `onboarding::${userId}`,
			agentId: 'onboarding',
			userTags,
			source: 'onboarding'
		});

		await dispatcher.dispatch(messages);
	}

	/**
	 * Auto-activate trial plan for new users after onboarding
	 * - Finds active trial plan
	 * - Assigns plan to user
	 * - Credits their account with trial credits
	 */
	private async activateTrialPlan(db: Database, userId: string): Promise<void> {
		try {
			// Find active trial plan
			const trialPlan = await db.query.planPackages.findFirst({
				where: and(
					eq(planPackages.type, 'trial'),
					eq(planPackages.isActive, true),
					eq(planPackages.isArchived, false)
				),
				orderBy: desc(planPackages.created)
			});

			if (!trialPlan) {
				this.log.warn('no_trial_plan', { userId });
				return;
			}

			const creditsToAdd = Number(trialPlan.credits) || 0;
			const now = new Date().toISOString();

			// Create payment transaction record for trial
			await db.insert(planPaymentTransactions).values({
				id: generateId(),
				user: userId,
				plan: trialPlan.id,
				provider: 'stripe',
				providerPaymentId: `trial_onboarding_${userId}_${Date.now()}`,
				status: 'completed',
				currency: 'USD',
				amount: String(0),
				notes: 'Auto-activated trial plan after onboarding',
				created: now,
				updated: now
			});

			// Add credits to user's account if plan has credits
			// Guard against NaN/invalid credits
			if (Number.isFinite(creditsToAdd) && creditsToAdd > 0) {
				await db.insert(coreCreditLedger).values({
					id: generateId(),
					user: userId,
					type: 'credit',
					transactionType: 'bonus',
					creditsChanged: String(creditsToAdd),
					balanceBefore: String(0),
					balanceAfter: String(creditsToAdd),
					description: `Trial credits from ${trialPlan.title}`,
					notes: 'Auto-credited after onboarding completion',
					created: now,
					updated: now
				});
			}

			// Update user with plan and trial_claimed flag
			await db
				.update(users)
				.set({
					plan: trialPlan.id,
					trialClaimed: true,
					updated: now
				})
				.where(eq(users.id, userId));

			this.log.info('trial_activated', { userId, credits: creditsToAdd, planId: trialPlan.id });
		} catch (error) {
			// Don't fail onboarding if trial activation fails
			this.log.error('trial_activation_failed', { userId, ...formatError(error) });
		}
	}

	/**
	 * Use AI to assign tags from the system tag catalog based on user's onboarding answers.
	 * Fetches tags from namespaces marked as assignable during onboarding, sends them along with
	 * the user's profiler data to the AI, and returns the assigned tags.
	 * Runs at completeOnboarding() so it works for both manual and AI onboarding paths.
	 */
	private async assignTagsFromCatalog(
		db: Database,
		userId: string,
		profilerData: ProfilerData[]
	): Promise<string[]> {
		try {
			// Fetch tags with their namespace info via JOIN
			const allRecords = await db
				.select({
					tag: configTagCatalog.tag,
					description: configTagCatalog.description,
					namespaceName: configTagNamespaces.name,
					isAssignableOnboarding: configTagNamespaces.isAssignableOnboarding
				})
				.from(configTagCatalog)
				.leftJoin(configTagNamespaces, eq(configTagCatalog.namespace, configTagNamespaces.id))
				.orderBy(configTagCatalog.namespace, configTagCatalog.tag);

			// Filter to only tags from namespaces marked as assignable during onboarding
			const catalogRecords = allRecords.filter((t) => t.isAssignableOnboarding === true);

			if (catalogRecords.length === 0) {
				this.log.debug('no_assignable_tags_in_catalog');
				return [];
			}

			// Format user facts
			const userFacts = profilerData
				.filter((p) => p.factKey !== 'enable_ai_personalization')
				.map((p) => `- ${p.factLabel}: ${this.formatAnswer(p.answer)}`)
				.join('\n');

			if (!userFacts) {
				this.log.debug('no_profiler_data_for_tag_assignment');
				return [];
			}

			// Format tag catalog: "namespace:tag — description"
			const tagCatalog = catalogRecords
				.map((t) => {
					const nsName = t.namespaceName ?? 'unknown';
					return `- ${nsName}:${t.tag}${t.description ? ` — ${t.description}` : ''}`;
				})
				.join('\n');

			// Load prompt or use fallback
			const prompt = await getPrompt(
				db,
				'onboarding_tag_assignment',
				DEFAULT_PROMPTS.onboarding_tag_assignment
			);

			const systemPrompt = interpolatePrompt(prompt, {
				user_facts: userFacts,
				tag_catalog: tagCatalog
			});

			// Use the same model resolution pattern as selectAgentShelf
			const modelConfig = await getModelConfigWithFallback(db, 'onboarding_tag_assignment_model');

			const model = getModelFromConfig(modelConfig, this.env);

			const tagAssignmentSchema = z.object({
				tags: z
					.array(z.string())
					.describe('Array of tags in namespace:value format assigned to the user'),
				reasoning: z.string().describe('Brief explanation of why each tag was assigned')
			});

			const { output: result, usage } = await generateText({
				model,
				output: Output.object({ schema: tagAssignmentSchema }),
				prompt: systemPrompt,
				timeout: 30_000
			});

			// Track cost
			try {
				await trackInferenceCost({
					db,
					modelConfig,
					usage,
					purpose: 'onboarding_tag_assignment',
					recordContext: { userId, messageId: `onboarding::tags::${userId}` },
					extraMetadata: { billing_context: 'system_onboarding' }
				});
			} catch (costErr) {
				this.log.warn('tag_assignment_cost_tracking_failed', {
					...formatError(costErr as Error)
				});
			}

			// Validate returned tags exist in catalog
			const validTags = new Set(
				catalogRecords.map((t) => `${t.namespaceName ?? 'unknown'}:${t.tag}`)
			);
			const assignedTags = (result?.tags ?? []).filter((t) => validTags.has(t));

			this.log.info('ai_tags_assigned', {
				userId,
				assigned: assignedTags,
				reasoning: result?.reasoning
			});

			return assignedTags;
		} catch (error) {
			// Don't fail onboarding if tag assignment fails
			this.log.error('ai_tag_assignment_failed', { userId, ...formatError(error) });
			return [];
		}
	}

	/**
	 * Persist onboarding tags to user_customization (upsert).
	 * Merges with existing tags to preserve admin-assigned ones.
	 */
	private async persistOnboardingTags(db: Database, userId: string, tags: string[]): Promise<void> {
		if (tags.length === 0) return;

		try {
			// Try to find existing tags record
			const existing = await db.query.userCustomization.findFirst({
				where: and(eq(userCustomization.user, userId), eq(userCustomization.key, 'tags'))
			});

			if (existing) {
				// Merge: union of existing + new tags (preserves admin-assigned tags)
				const existingTags = Array.isArray((existing.value as any)?.tags)
					? (existing.value as any).tags
					: [];
				const merged = [...new Set([...existingTags, ...tags])];

				await db
					.update(userCustomization)
					.set({
						value: { tags: merged },
						updated: new Date().toISOString()
					})
					.where(eq(userCustomization.id, existing.id));
				this.log.info('onboarding_tags_merged', {
					userId,
					existing: existingTags,
					added: tags,
					merged
				});
			} else {
				// No existing record — create fresh
				await db.insert(userCustomization).values({
					id: generateId(),
					user: userId,
					key: 'tags',
					value: { tags },
					created: new Date().toISOString(),
					updated: new Date().toISOString()
				});
				this.log.info('onboarding_tags_created', { userId, tags });
			}
		} catch (error) {
			this.log.error('tag_assignment_failed', { userId, ...formatError(error) });
		}
	}

	/**
	 * AI-selected personalized agent recommendations based on user profile
	 * Stores the selected agents in user_customization with key "agent_shelf"
	 */
	private async selectAgentShelf(
		db: Database,
		userId: string,
		profilerData: ProfilerData[],
		onboardingTags: string[]
	): Promise<void> {
		try {
			// Fetch all active agents including tag_rule for visibility filtering
			const allAgentRows = await db
				.select({
					id: aiAgents.id,
					name: aiAgents.name,
					description: aiAgents.description,
					is_universal: aiAgents.isUniversal,
					tag_rule: aiAgents.tagRule
				})
				.from(aiAgents)
				.where(eq(aiAgents.status, 'active'));

			if (allAgentRows.length === 0) {
				this.log.warn('no_active_agents', { userId });
				return;
			}

			// Compute effective user tags: plan granted_tags + onboarding-assigned tags
			let planTags: string[] = [];
			try {
				const userRow = await db.query.users.findFirst({
					where: eq(users.id, userId),
					columns: { plan: true }
				});
				if (userRow?.plan) {
					const planRow = await db.query.planPackages.findFirst({
						where: eq(planPackages.id, userRow.plan),
						columns: { grantedTags: true }
					});
					planTags = (planRow?.grantedTags as string[]) ?? [];
				}
			} catch {
				// User may not have a plan yet
			}
			const userTags = getUserTags({ granted_tags: planTags }, { tags: onboardingTags });

			// Only show agents the user can actually see
			const agents = filterVisibleAgents(
				allAgentRows.map((a) => ({
					...a,
					is_universal: a.is_universal ?? false,
					tag_rule: a.tag_rule as import('@repo/shared/types').TagRule | null
				})),
				userTags
			);

			if (agents.length === 0) {
				this.log.warn('no_visible_agents', { userId, totalActive: allAgentRows.length });
				return;
			}

			// Format user facts for the prompt
			const userFacts = profilerData
				.filter((p) => p.factKey !== 'enable_ai_personalization')
				.map((p) => `- ${p.factLabel}: ${this.formatAnswer(p.answer)}`)
				.join('\n');

			// Format agents for the prompt
			const agentList = agents
				.map((a: any) => `- ${a.id}: ${a.name} - ${a.description || 'No description'}`)
				.join('\n');

			// Load prompt or use fallback
			const prompt = await getPrompt(
				db,
				'agent_shelf_selection',
				DEFAULT_PROMPTS.agent_shelf_selection
			);

			// Interpolate variables into prompt
			const systemPrompt = interpolatePrompt(prompt, {
				user_facts: userFacts,
				agent_list: agentList,
				max_agents: '5'
			});

			// Get AI model from ai_agent_models (configurable)
			const modelConfig = await getModelConfigWithFallback(db, 'agent_shelf_selection_model');
			this.log.debug('model_config', {
				source: modelConfig.config_key,
				modelId: modelConfig.model_id
			});

			const model = getModelFromConfig(modelConfig, this.env);

			const shelfSelectionSchema = z.object({
				agents: z
					.array(z.string())
					.min(1)
					.max(8)
					.describe('Array of agent IDs recommended for this user'),
				reasoning: z.string().describe('Brief explanation of why these agents were selected')
			});

			const { output: result, usage } = await generateText({
				model,
				output: Output.object({ schema: shelfSelectionSchema }),
				prompt: systemPrompt,
				timeout: 30_000
			});

			// Track cost at system level
			try {
				await trackInferenceCost({
					db,
					modelConfig,
					usage,
					purpose: 'onboarding_agent_shelf',
					recordContext: { userId, messageId: `onboarding::shelf::${userId}` },
					extraMetadata: { billing_context: 'system_onboarding' }
				});
			} catch (costErr) {
				this.log.warn('shelf_cost_tracking_failed', { ...formatError(costErr as Error) });
			}

			// Filter to only include valid agent IDs
			const validAgentIds = new Set(agents.map((a: any) => a.id));
			const selectedAgents = result!.agents.filter((id) => validAgentIds.has(id));

			// If AI returned no valid agents, use universal agents as fallback
			if (selectedAgents.length === 0) {
				const universalAgents = agents
					.filter((a: any) => a.isUniversal)
					.slice(0, 5)
					.map((a: any) => a.id);

				if (universalAgents.length > 0) {
					selectedAgents.push(...universalAgents);
					this.log.warn('agents_fallback_universal', { userId, count: universalAgents.length });
				}
			}

			// Store in user_customization (upsert to handle re-runs)
			const now = new Date().toISOString();
			await db
				.insert(userCustomization)
				.values({
					id: generateId(),
					user: userId,
					key: 'agent_shelf',
					value: {
						agent_ids: selectedAgents,
						ai_reasoning: result.reasoning,
						selected_at: now,
						source: 'onboarding_ai'
					},
					created: now,
					updated: now
				})
				.onConflictDoUpdate({
					target: [userCustomization.key, userCustomization.user],
					set: {
						value: {
							agent_ids: selectedAgents,
							ai_reasoning: result.reasoning,
							selected_at: now,
							source: 'onboarding_ai'
						},
						updated: now
					}
				});

			this.log.info('agents_selected', {
				userId,
				count: selectedAgents.length,
				agentIds: selectedAgents
			});
		} catch (error) {
			this.log.error('shelf_selection_failed', { userId, ...formatError(error) });
		}
	}

	/**
	 * Assign a dashboard template to the user based on their tags.
	 * Resolves the best matching template, filters widgets by tag gating,
	 * and creates the user's dashboard layout + widget instances.
	 * Falls back to an ungated (universal) template if no tag-specific match.
	 */
	private async assignDashboardTemplate(
		db: Database,
		userId: string,
		onboardingTags: string[]
	): Promise<void> {
		try {
			// Compute effective user tags (plan + onboarding-assigned)
			let planTags: string[] = [];
			try {
				const userRow = await db.query.users.findFirst({
					where: eq(users.id, userId),
					columns: { plan: true }
				});
				if (userRow?.plan) {
					const planRow = await db.query.planPackages.findFirst({
						where: eq(planPackages.id, userRow.plan),
						columns: { grantedTags: true }
					});
					planTags = (planRow?.grantedTags as string[]) ?? [];
				}
			} catch {
				// User may not have a plan yet
			}
			const userTags = getUserTags({ granted_tags: planTags }, { tags: onboardingTags });

			const template = await resolveDashboardTemplate(db, userTags);
			if (!template) {
				this.log.info('no_dashboard_template_found', { userId });
				return;
			}

			const result = await instantiateDashboardFromTemplate(db, userId, template, userTags);
			if (result) {
				this.log.info('dashboard_assigned', {
					userId,
					templateId: template.id,
					templateName: template.name,
					...result
				});
			}
		} catch (error) {
			this.log.error('dashboard_assignment_failed', { userId, ...formatError(error) });
		}
	}

	/**
	 * Store onboarding profiler data to graph via MemoryGraphService
	 * Creates FACT nodes linked to user with HAS_FACT edges (legacy, kept for backward compat)
	 * Also writes structured PROFILE_SECTION nodes for the new profiler system (dual-write)
	 * Also stores captured location as "home" location facts
	 */
	private async storeOnboardingToGraph(
		userId: string,
		profilerData: ProfilerData[],
		capturedLocation?: {
			country?: string;
			timezone?: string;
			continent?: string;
			city?: string;
		}
	): Promise<void> {
		const graph = new MemoryGraphService(await this.getDatabase(), userId);

		const now = new Date().toISOString();
		const userNodeId = `user::${userId}`;

		const nodes: GraphNode[] = [];
		const edges: GraphEdge[] = [];

		// Ensure user node exists
		nodes.push({
			id: userNodeId,
			type: 'USER',
			data: { userId },
			createdAt: now
		});

		// Store captured location as "home" facts (auto-detected at onboarding start)
		if (capturedLocation) {
			const locationFacts: Array<{ key: string; label: string; value: string | undefined }> = [
				{ key: 'residence_country', label: 'Residence Country', value: capturedLocation.country },
				{ key: 'home_timezone', label: 'Home Timezone', value: capturedLocation.timezone },
				{ key: 'home_continent', label: 'Home Continent', value: capturedLocation.continent },
				{ key: 'home_city', label: 'Home City', value: capturedLocation.city }
			];

			for (const { key, label, value } of locationFacts) {
				if (!value) continue; // Skip undefined values

				const factId = `fact::location::${key}`;

				nodes.push({
					id: factId,
					type: 'FACT',
					data: {
						text: `${label}: ${value}`,
						category: 'location',
						source: 'auto_detected',
						factKey: key,
						factLabel: label,
						rawValue: value,
						share_with_manager: true,
						share_with_agent: true,
						auto_detected: true, // Flag that this was auto-detected, not user-provided
						detected_at: now
					},
					confidence: 0.9, // High confidence but not 1.0 since it's IP-based
					createdAt: now
				});

				edges.push({
					source: userNodeId,
					target: factId,
					relationship: 'HAS_FACT',
					createdAt: now
				});
			}

			this.log.debug('location_facts_stored', {
				facts: locationFacts.filter((f) => f.value).map((f) => f.key)
			});
		}

		// Create FACT nodes for each onboarding answer
		for (const fact of profilerData) {
			// Skip the AI personalization meta question
			if (fact.factKey === 'enable_ai_personalization') continue;

			const factId = `fact::onboarding::${fact.factKey}`;

			nodes.push({
				id: factId,
				type: 'FACT',
				data: {
					text: `${fact.factLabel}: ${this.formatAnswer(fact.answer)}`,
					category: 'onboarding',
					source: 'onboarding',
					factKey: fact.factKey,
					factLabel: fact.factLabel,
					rawValue: fact.answer,
					share_with_manager: true,
					share_with_agent: true
				},
				confidence: 1.0, // User-provided = high confidence
				createdAt: now
			});

			edges.push({
				source: userNodeId,
				target: factId,
				relationship: 'HAS_FACT',
				createdAt: now
			});
		}

		// Batch upsert to graph (legacy FACT nodes)
		await graph.batchUpsert(nodes, edges);
	}

	/**
	 * Format answer for display in fact text
	 */
	private formatAnswer(answer: OnboardingAnswerValue | undefined): string {
		if (answer === undefined || answer === null) return 'Not specified';
		if (Array.isArray(answer)) return answer.join(', ');
		return String(answer);
	}

	// ============================================================================
	// Question Fetching
	// ============================================================================

	private async fetchPresetQuestions(): Promise<Question[]> {
		const config = await this.getConfig();
		const ttl = config.cache_ttl_ms || DEFAULT_CACHE_TTL_MS;

		// Return cached if valid
		if (this.cachedQuestions && Date.now() - this.cachedQuestions.fetchedAt < ttl) {
			return this.cachedQuestions.presetQuestions;
		}

		try {
			const db = await this.getDatabase();
			const records = await loadOnboardingQuestionRecords(db);

			const questions: Question[] = records
				.map((record: any) => ({
					id: record.id || record.factKey,
					factKey: record.factKey,
					factLabel: record.sidebarTitle,
					type: normalizeQuestionType(record.type),
					question: record.question,
					sidebarTitle: record.sidebarTitle,
					description: record.description,
					options: Array.isArray(record.options)
						? record.options.map((option: any) => ({
								value: String(option.value ?? ''),
								label: String(option.label ?? option.value ?? ''),
								icon: option.icon ?? undefined,
								description: option.description ?? undefined,
								grantsTags: Array.isArray(option.grantsTags) ? option.grantsTags : []
							}))
						: [],
					required: record.required ?? true,
					order: Number(record.order ?? 0),
					enabled: record.enabled ?? true,
					group: record.group ?? undefined,
					showWhen: record.showWhen ?? null,
					metadata: record.metadata ?? null
				}))
				.filter((question) => question.enabled !== false);

			this.cachedQuestions = {
				presetQuestions: questions,
				fetchedAt: Date.now()
			};

			return questions;
		} catch {
			return [];
		}
	}

	// ============================================================================
	// Profile-Scoped Config Loading (new, coexists with legacy methods above)
	// ============================================================================

	private async getProfileConfig(profileId: string): Promise<OnboardingConfig> {
		if (this.cachedConfig) {
			const ttl = this.cachedConfig.config.cache_ttl_ms || DEFAULT_CACHE_TTL_MS;
			if (
				Date.now() - this.cachedConfig.fetchedAt < ttl &&
				this.cachedConfig.config.id === profileId
			) {
				return this.cachedConfig.config;
			}
		}

		const db = await this.getDatabase();
		const rows = await db
			.select({
				profile: configOnboardingProfiles,
				prompt: aiPrompts,
				model: aiAgentModels,
				provider: aiProviders
			})
			.from(configOnboardingProfiles)
			.leftJoin(aiPrompts, eq(configOnboardingProfiles.systemPrompt, aiPrompts.id))
			.leftJoin(aiAgentModels, eq(configOnboardingProfiles.model, aiAgentModels.id))
			.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
			.where(eq(configOnboardingProfiles.id, profileId));

		if (rows.length === 0) {
			throw new ConfigError('Onboarding profile not found', {
				code: 'PROFILE_NOT_FOUND',
				context: { profileId }
			});
		}

		const config = buildProfileConfig(rows[0]);
		this.cachedConfig = { config, fetchedAt: Date.now() };
		return config;
	}

	private async fetchProfileQuestions(profileId: string): Promise<Question[]> {
		const db = await this.getDatabase();
		const rows = await db
			.select()
			.from(configOnboardingProfileQuestions)
			.where(
				and(
					eq(configOnboardingProfileQuestions.profile, profileId),
					eq(configOnboardingProfileQuestions.enabled, true)
				)
			)
			.orderBy(asc(configOnboardingProfileQuestions.order));

		return buildProfileQuestions(rows);
	}

	private async getSessionConfig(): Promise<OnboardingConfig> {
		return this.session?.profileId
			? this.getProfileConfig(this.session.profileId)
			: this.getConfig();
	}

	private async fetchSessionPresetQuestions(): Promise<Question[]> {
		return this.session?.profileId
			? this.fetchProfileQuestions(this.session.profileId)
			: this.fetchPresetQuestions();
	}

	private getAIPromptQuestion(): Question {
		return {
			id: 'ai-personalization-prompt',
			factKey: 'enable_ai_personalization',
			factLabel: 'AI Personalization',
			type: 'checkbox',
			question: '✨ Want a more personalized experience?',
			sidebarTitle: 'Personalize',
			description:
				'We can ask a few more tailored questions to better understand your goals, needs, and preferences.',
			required: true,
			options: [
				{
					value: 'yes',
					label: 'Yes, personalize my experience',
					icon: 'ph:sparkle-duotone',
					description: 'Get AI-powered personalized questions'
				},
				{
					value: 'no',
					label: 'No, continue with basics',
					icon: 'ph:x-circle-duotone',
					description: 'Skip to dashboard'
				}
			]
		};
	}

	// ============================================================================
	// AI Question Generation
	// ============================================================================

	private async generateAIQuestion(config: OnboardingConfig): Promise<Question | null> {
		if (!this.session) {
			this.log.error('ai_question_no_session');
			return null;
		}

		// Build all profiler data for system prompt context
		const profilerEntries = this.session.profilerData.filter(
			(data) => data.factKey !== 'enable_ai_personalization'
		);

		// All Q&A pairs for context — onboarding is ≤10 questions, no need to truncate
		const allAnswers = profilerEntries
			.map((data) => `Q: ${data.question}\nA: ${this.formatAnswer(data.answer)}`)
			.join('\n\n');

		const context = allAnswers
			? `Previous questions and answers:\n${allAnswers}`
			: 'This is the first AI-generated question.';

		const userPrompt = interpolatePrompt(ONBOARDING_QUESTION_USER, { context });

		try {
			// Get system prompt from config or use default, then interpolate template variables
			const hasProfilePrompt = !!config.promptTemplate?.trim();
			const rawPrompt = hasProfilePrompt
				? config.promptTemplate!
				: this.session.profileId
					? GENERIC_PROFILE_ONBOARDING_SYSTEM_PROMPT
					: DEFAULT_SYSTEM_PROMPT;
			if (this.session.profileId && !hasProfilePrompt) {
				this.log.warn('profile_prompt_missing_for_ai_question', {
					profileId: this.session.profileId
				});
			}

			const systemPrompt = interpolatePrompt(rawPrompt, {
				profiler_data: allAnswers || 'No profile data collected yet.',
				previous_answers: allAnswers || 'No previous answers yet.'
			});
			const finalSystemPrompt = buildOnboardingQuestionSystemPrompt(systemPrompt);

			const db = await this.getDatabase();
			const { model, provider, modelName, source, modelConfig } =
				await resolveOnboardingAIQuestionModel({
					db,
					env: this.env,
					config
				});

			this.log.debug('ai_question_start', {
				provider,
				modelName,
				modelSource: source,
				context
			});

			this.log.debug('ai_question_model_obtained', { provider, modelName, modelSource: source });

			const { output, usage } = await generateText({
				model,
				output: Output.object({ schema: aiQuestionResponseSchema }),
				system: finalSystemPrompt,
				prompt: userPrompt,
				timeout: 30_000
			});

			// Track cost at system level (onboarding is platform overhead)
			try {
				const pricing = modelConfig
					? undefined
					: await import('../utils/billing').then((b) => b.getPricingForModel(db, modelName));
				const sessionUserId = this.session?.userId;

				await trackInferenceCost({
					db,
					...(modelConfig ? { modelConfig } : { modelId: modelName, pricing }),
					usage,
					purpose: 'onboarding_ai_question',
					recordContext: {
						userId: sessionUserId ?? 'unknown',
						messageId: `onboarding::question::${sessionUserId ?? 'unknown'}`
					},
					extraMetadata: { billing_context: 'system_onboarding', model_source: source }
				});
			} catch (costErr) {
				this.log.warn('ai_question_cost_tracking_failed', { ...formatError(costErr as Error) });
			}

			this.log.info('ai_question_generated', {
				questionId: output!.question.id,
				factKey: output!.question.factKey
			});

			// Transform nullable fields to optional (AI schema uses null, Question type uses undefined)
			const q = output!.question;
			return {
				...q,
				description: q.description ?? undefined,
				options: q.options.map((o) => ({
					...o,
					icon: o.icon ?? undefined,
					description: o.description ?? undefined
				}))
			};
		} catch (error) {
			// Log detailed error information
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : '';
			this.log.error('ai_question_failed', { message: errorMessage, stack: errorStack });

			const fallbackQuestion = this.getFallbackAIQuestion(config);

			// Return a configured profile fallback question, then generic safety fallback if absent.
			this.log.warn('ai_question_fallback');
			return fallbackQuestion;
		}
	}

	/**
	 * Fallback question when AI generation fails.
	 * Ensures the user can still complete personalized onboarding.
	 */
	private getFallbackAIQuestion(config: OnboardingConfig): Question | null {
		return selectFallbackAIQuestion(
			this.session?.profilerData ?? [],
			config.aiFallbackQuestions?.length ? config.aiFallbackQuestions : undefined
		);
	}

	private replaceLegacyFinanceFallbackQuestion(config: OnboardingConfig): boolean {
		if (!this.session?.currentQuestion) return false;
		if (!isLegacyFinanceFallbackQuestion(this.session.currentQuestion)) return false;

		const replacement = selectFallbackAIQuestion(
			this.session.profilerData,
			config.aiFallbackQuestions?.length ? config.aiFallbackQuestions : undefined
		);
		this.session.currentQuestion = replacement;
		this.session.lastActivityAt = Date.now();

		this.log.debug('legacy_finance_fallback_replaced', {
			profileId: this.session.profileId,
			replacementQuestionId: replacement?.id ?? null,
			replacementSource: config.aiFallbackQuestions?.length ? 'profile_config' : 'generic_safety',
			profileFallbackQuestionCount: config.aiFallbackQuestions?.length ?? 0
		});

		return true;
	}

	// ============================================================================
	// Profiler Data Management
	// ============================================================================

	private updateProfilerData(question: Question, answer: OnboardingAnswerValue): void {
		if (!this.session) return;
		if (answer === null || answer === undefined) return;

		const newEntry: ProfilerData = {
			question_id: question.id,
			factKey: question.factKey,
			factLabel: question.factLabel ?? question.sidebarTitle ?? question.question,
			question: question.question,
			answer
		};

		const existingIndex = this.session.profilerData.findIndex(
			(item) => item.factKey === newEntry.factKey
		);

		if (existingIndex >= 0) {
			this.session.profilerData[existingIndex] = newEntry;
		} else {
			this.session.profilerData.push(newEntry);
		}
	}

	private updateTranscript(
		question: Question,
		answer: Parameters<typeof buildTranscriptEvent>[1]
	): void {
		if (!this.session) return;
		const phase = this.session.phase === 'ai-personalized' ? 'ai_personalized' : 'manual';
		const event = buildTranscriptEvent(question, answer, phase);
		const existing = this.session.transcript ?? [];
		const next = existing.filter((item) => item.questionId !== event.questionId);
		next.push(event);
		this.session.transcript = next;

		// Fire-and-forget audit event for the answer
		void this.writeAuditEvent('question_answered', {
			questionId: question.id,
			factKey: question.factKey,
			prompt: question.question,
			answer: String(event.answer),
			answerText: event.answerText,
			phase
		});
	}

	private getAnsweredFacts(): Array<{ label: string; value: string }> {
		return (this.session?.profilerData ?? []).map((fact) => ({
			label: fact.factLabel,
			value: this.formatAnswer(fact.answer)
		}));
	}

	private validateAnswer(question: Question, answer: unknown): OnboardingAnswerValue | null {
		if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
			if (question.required) {
				throw new ValidationError(`Answer is required for: ${question.question}`, {
					field: question.factKey
				});
			}
			return null;
		}

		return normalizeOnboardingAnswer(question, answer).value;
	}

	// ============================================================================
	// Audit Trail
	// ============================================================================

	private async writeAuditEvent(
		eventType: string,
		extra: {
			status?: string;
			questionId?: string;
			factKey?: string;
			prompt?: string;
			answer?: string;
			answerText?: string;
			phase?: string;
			metadata?: Record<string, unknown>;
		} = {}
	): Promise<void> {
		if (!this.session) return;
		try {
			const db = await this.getDatabase();
			const now = new Date().toISOString();
			await db.insert(userOnboardingAuditEvents).values({
				id: generateId(),
				user: this.session.userId,
				profile: this.session.profileId ?? null,
				assignment: this.session.assignmentId ?? null,
				eventType,
				status: extra.status ?? this.session.status ?? null,
				questionId: extra.questionId ?? null,
				factKey: extra.factKey ?? null,
				prompt: extra.prompt ?? null,
				answer: extra.answer ?? null,
				answerText: extra.answerText ?? null,
				phase: extra.phase ?? this.session.phase ?? null,
				metadata: extra.metadata ?? null,
				created: now,
				updated: now
			});
		} catch (error) {
			this.log.error('audit_write_failed', { eventType, ...formatError(error) });
		}
	}

	// ============================================================================
	// Persistence
	// ============================================================================

	private async persist(timeoutMs?: number): Promise<void> {
		this.setState({ session: cloneSession(this.session) });

		if (this.session) {
			if (
				this.session.status === 'profile_extraction_pending' &&
				this.session.nextRetryAt &&
				this.session.transcript?.length
			) {
				await this.ctx.storage.setAlarm(this.session.nextRetryAt);
				return;
			}

			const timeout = timeoutMs || DEFAULT_SESSION_TIMEOUT_MS;
			await this.ctx.storage.setAlarm(Date.now() + timeout);
			return;
		}

		await this.ctx.storage.deleteAlarm();
	}

	async alarm(): Promise<void> {
		configurePostHogLogger(this.env);
		this.ensureSessionLoaded();

		if (this.session?.status === 'profile_extraction_pending') {
			try {
				const db = await this.getDatabase();
				this.session.status = 'extracting_profile';
				this.session.profileExtractionStatus = 'running';
				await this.persist();
				await this.extractProfileFromTranscript(
					db,
					this.session.userId,
					this.session.transcript ?? [],
					this.session.finalTags ?? [],
					this.session.capturedLocation
				);
				this.log.info('profile_extraction_retry_succeeded', { userId: this.session.userId });
				await this.clearPersistedSession();
				return;
			} catch (error) {
				this.log.error('profile_extraction_retry_failed', { ...formatError(error) });
				if (this.session) {
					this.session.status = 'profile_extraction_pending';
					this.session.profileExtractionStatus = 'pending_retry';
					this.session.nextRetryAt = Date.now() + 30 * 60 * 1000;
					await this.persist();
					return;
				}
			}
		}

		this.log.info('session_expired');
		await this.clearPersistedSession();
	}

	// ============================================================================
	// Helpers
	// ============================================================================

	private jsonResponse(data: OnboardingResponse | any, status = 200): Response {
		return new Response(JSON.stringify(data), {
			status,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	private errorResponse(error: unknown, status = 500): Response {
		const message = error instanceof Error ? error.message : String(error);
		return this.jsonResponse({ success: false, error: message }, status);
	}

	private async parseBody<T>(request: Request): Promise<T> {
		try {
			return await request.json<T>();
		} catch {
			throw new ValidationError('Invalid JSON in request body');
		}
	}
}

// Keep the existing export name so current wrangler bindings and remote consumers
// do not need a disruptive class-name migration while the implementation moves to Agent.
export { OnboardingAgent as OnboardingSessionDO };
