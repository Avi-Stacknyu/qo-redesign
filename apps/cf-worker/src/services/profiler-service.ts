/**
 * Profiler Service
 *
 * Replaces fact/intent extraction from ExtractionService with structured
 * profile updates. Runs post-message (every N messages + session end)
 * alongside the session summarizer.
 *
 * Flow: conversation messages → profiler LLM → ProfilerResult → graph.applyProfileUpdates()
 */

import type { Database } from '@repo/db/types';
import {
	profilerAgents,
	profilerExtractionLog,
	profilerModelChain,
	profilerSchemaProposals
} from '@repo/db/schema';
import { generateId } from '@repo/db/id';
import { asc, eq } from 'drizzle-orm';
import type { Env, GraphNode } from '../types';
import type {
	StructuredExtractionOutput,
	ExtractionAttempt,
	MemoryObservation,
	ProfileFieldMeta,
	SchemaProposal,
	SourceType,
	WriteDecision
} from '../types/extraction';
import {
	buildExtractionSchema,
	type SchemaSection as ExtractionSchemaSection
} from './extraction-schema-builder';
import { buildLogEntry, summarizeAttempts, type ExtractionLogInput } from './extraction-ledger';
import { buildRetryPlan, classifyErrorForChain, shouldAbort } from './fallback-chain-executor';
import {
	evaluateWrite,
	type ExistingFieldMeta,
	type IncomingFieldUpdate
} from './profile-write-controller';
import {
	generateDeterministicNodeId,
	buildGraphNode,
	shouldSkipDuplicate
} from './memory-write-controller';
import type { FlowCostTracker } from '../types/flow';
import type { ProfilerResult, ProfileSchemaSection, ProfileSectionData } from '../types/profiler';
import { loadGlobalProfileSchema } from '../utils/schema-loader';
import type { MessagePair } from './session-summarizer';
import { getModel, getModelConfigWithFallback, getModelFromConfig } from '../utils/model-factory';
import type { PricingRate } from '../utils/model-factory';
import { generateText, Output } from 'ai';
import {
	canonicalizeProfileUpdates,
	findProfileField,
	sameProfileField,
	type ProfileSections
} from '@repo/shared/utils';
import { interpolatePrompt, PROFILE_EXTRACTION } from '../utils/prompts';
import { getCreditsPerUsd, computeInferenceCost, mapDrizzlePricing } from '../utils/billing';
import { createLogger, formatError } from '../utils/logger';
import { classifyProviderError } from '../utils/errors';
import { safeParseLLMJson } from '../utils/json-repair';
import { createKeyedTTLCache } from '../utils/ttl-cache';
import { filterSchemaByFocusSections, normalizeFocusSections } from './profiler-routing';

// ============================================================================
// Types
// ============================================================================

export interface ProfilerContext {
	env: Env;
	db: Database;
	userId: string;
	sessionId: string;
	agentId: string;
	profilerAgentId: string;
	costTracker?: FlowCostTracker;
}

export interface ProfilerUpdateOptions {
	source?: 'onboarding' | 'chat';
	schema?: ProfileSchemaSection[];
	/** Seed schema sections for prompt guidance, not a hard write boundary. */
	ownedSectionIds?: string[];
}

/** Drizzle-joined profiler agent with model, provider, and pricing. */
interface ProfilerAgentData {
	id: string;
	status: string | null;
	systemPrompt: string | null;
	maxTokens: string | null;
	focusSections: unknown;
	model: {
		modelId: string | null;
		currentPricing: string | null;
		provider: { providerKey: string | null } | null;
		pricing: PricingRate | null;
	} | null;
}

interface ResolvedModelChainEntry {
	id: string;
	modelId: string;
	provider: string;
	displayName: string;
	priority: number;
	temperature: number;
	maxTokens: number;
	timeoutMs: number;
	retryCount: number;
	pricingRateId: string | null;
	pricing: PricingRate | null;
}

import { MemoryGraphService } from '../graph/memory-graph-service';

function labelFromKey(value: string): string {
	return value
		.split(/[_\-\s]+/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function snakeCase(value: string | undefined, fallback: string): string {
	const normalized = (value ?? '')
		.trim()
		.toLowerCase()
		.replace(/['"]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.replace(/_{2,}/g, '_');
	return normalized || fallback;
}

function buildMemoryProjection(observation: MemoryObservation, nodeId: string) {
	const sectionId = snakeCase(observation.category, 'graph_memory');
	const baseKey = observation.groupKey ?? observation.title ?? observation.text.slice(0, 80);
	const fieldKey = observation.groupKey
		? snakeCase(observation.groupKey, `memory_${nodeId.slice(0, 8)}`)
		: `${snakeCase(baseKey, observation.nodeType.toLowerCase())}_${nodeId.slice(0, 8)}`;

	return {
		sectionId,
		fieldKey,
		label: observation.title ?? labelFromKey(snakeCase(baseKey, observation.nodeType.toLowerCase()))
	};
}

// Per-request cache (5 min TTL)
const profilerAgentCache = createKeyedTTLCache<ProfilerAgentData>(5 * 60 * 1000);

export function clearProfilerCache(): void {
	profilerAgentCache.clear();
}

// ============================================================================
// Profiler Service
// ============================================================================

export class ProfilerService {
	private ctx: ProfilerContext;
	private log;

	constructor(ctx: ProfilerContext) {
		this.ctx = ctx;
		this.log = createLogger('ProfilerService', { userId: ctx.userId });
	}

	private getGraphService(): MemoryGraphService {
		return new MemoryGraphService(this.ctx.db, this.ctx.userId);
	}

	/**
	 * Load profiler agent record with joined model → provider + pricing.
	 * Cached per-request to avoid duplicate DB calls.
	 */
	private async getProfilerAgent(): Promise<ProfilerAgentData> {
		const cached = profilerAgentCache.get(this.ctx.profilerAgentId);
		if (cached) return cached;

		const row = await this.ctx.db.query.profilerAgents.findFirst({
			where: eq(profilerAgents.id, this.ctx.profilerAgentId),
			with: {
				aiAgentModel: {
					with: {
						aiProvider: true,
						aiPricingRate: true
					}
				}
			}
		});

		if (!row) throw new Error(`Profiler agent not found: ${this.ctx.profilerAgentId}`);

		const record: ProfilerAgentData = {
			id: row.id,
			status: row.status,
			systemPrompt: row.systemPrompt,
			maxTokens: row.maxTokens,
			focusSections: row.focusSections,
			model: row.aiAgentModel
				? {
						modelId: row.aiAgentModel.modelId,
						currentPricing: row.aiAgentModel.currentPricing,
						provider: row.aiAgentModel.aiProvider
							? { providerKey: row.aiAgentModel.aiProvider.providerKey }
							: null,
						pricing: row.aiAgentModel.aiPricingRate
							? mapDrizzlePricing(row.aiAgentModel.aiPricingRate)
							: null
					}
				: null
		};

		profilerAgentCache.set(this.ctx.profilerAgentId, record);
		return record;
	}

	/**
	 * Core method: analyze messages and update user profile.
	 */
	async updateProfile(messages: MessagePair[], options: ProfilerUpdateOptions = {}): Promise<void> {
		if (messages.length === 0) return;

		const profilerAgent = await this.getProfilerAgent();
		if (profilerAgent.status !== 'active') return;

		const graph = this.getGraphService();
		const requestedFocusSections = normalizeFocusSections(
			options.ownedSectionIds ?? profilerAgent.focusSections
		);

		// Seed the prompt with the profiler's scoped schema, but keep the global
		// schema available for canonicalization and section metadata.
		const globalSchema = await loadGlobalProfileSchema(this.ctx.db);
		const schema = options.ownedSectionIds
			? filterSchemaByFocusSections(options.schema ?? globalSchema, options.ownedSectionIds)
			: options.schema
				? options.schema
				: filterSchemaByFocusSections(globalSchema, profilerAgent.focusSections);
		if (requestedFocusSections.length > 0 && schema.length === 0) {
			this.log.warn('profiler_focus_sections_unresolved', {
				profilerAgentId: this.ctx.profilerAgentId,
				focusSections: requestedFocusSections
			});
			return;
		}

		const profileNodes = await graph.getProfile();

		// Serialize profile + conversation for LLM
		const profileContext = this.serializeProfileForPrompt(profileNodes, schema);
		const conversationText = messages
			.map((m, i) => `[${i + 1}] User: ${m.userMessage}\nAssistant: ${m.assistantResponse}`)
			.join('\n\n');

		const schemaDefinitions = this.serializeSchemaDefinitions(schema);

		const prompt = interpolatePrompt(PROFILE_EXTRACTION, {
			profilerSystemPrompt: profilerAgent.systemPrompt ?? '',
			schemaDefinitions,
			profileContext,
			messageCount: String(messages.length),
			conversationText
		});

		// Resolve model from profiler agent's joined model relation
		const modelRecord = profilerAgent.model;
		if (!modelRecord) {
			this.log.warn('profiler_no_model', { profilerAgentId: this.ctx.profilerAgentId });
			return;
		}

		const providerKey = modelRecord.provider?.providerKey ?? 'cloudflare';
		const maxTokens = Number(profilerAgent.maxTokens) || 800;

		// Try primary model, fall back to CF Workers AI on provider failure
		const result = await this.generateWithFallback(
			providerKey,
			modelRecord.modelId ?? '',
			prompt,
			maxTokens
		);
		if (!result) return;

		// Track cost (only for primary model — CF fallback is free)
		if (result.source === 'primary' && this.ctx.costTracker && modelRecord.currentPricing) {
			const pricing = modelRecord.pricing;
			if (pricing) {
				const { costUsd, tokens } = computeInferenceCost(pricing, result.result.usage);
				const creditsPerUsd = await getCreditsPerUsd(this.ctx.db);
				const credits = costUsd * creditsPerUsd;

				this.ctx.costTracker.addEvent({
					operation: 'inference',
					modelId: modelRecord.modelId ?? '',
					tokens: { input: tokens.input, output: tokens.output },
					costUsd,
					credits,
					pricingRateId: pricing.id,
					metadata: { purpose: 'profiler_extraction' }
				});
			}
		}

		// Parse LLM output (with repair for truncated JSON from token limits)
		const text = result.result.text || '{}';
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return;

		const profilerResult = safeParseLLMJson<ProfilerResult>(jsonMatch[0]);
		if (!profilerResult?.updates || profilerResult.updates.length === 0) return;

		// Sanitize section IDs — LLMs sometimes copy bracket formatting from the prompt
		for (const update of profilerResult.updates) {
			update.section = update.section.replace(/^\[|\]$/g, '');
		}

		const canonicalUpdates = canonicalizeProfileUpdates(profilerResult.updates, globalSchema);

		// Build section metadata map from the global schema so known sections keep
		// their configured labels/icons even when this profiler was seeded with a
		// narrower schema slice.
		const sectionMetaMap: Record<string, { label: string; icon: string; order: number }> = {};
		for (const section of globalSchema) {
			sectionMetaMap[section.section_id] = {
				label: section.label,
				icon: section.icon,
				order: section.order
			};
		}

		// Apply to graph
		await graph.applyProfileUpdates(
			this.ctx.userId,
			canonicalUpdates,
			options.source ?? 'chat',
			schema,
			sectionMetaMap
		);

		this.log.info('profile_updated', {
			source: result.source,
			sectionsUpdated: canonicalUpdates.length,
			fieldsUpdated: canonicalUpdates.reduce(
				(sum: number, update: { fields: Record<string, unknown> }) =>
					sum + Object.keys(update.fields).length,
				0
			)
		});
	}

	/**
	 * Try the primary model, and on provider-level failures (auth, rate_limit,
	 * provider_down) automatically retry with the configured fallback model.
	 * Content-filter or context-length errors are NOT retried (same prompt would fail again).
	 */
	private async generateWithFallback(
		providerKey: string,
		modelId: string,
		prompt: string,
		maxTokens: number
	): Promise<{
		result: Awaited<ReturnType<typeof generateText>>;
		source: 'primary' | 'fallback';
	} | null> {
		// Attempt primary model
		try {
			const model = getModel(providerKey, modelId, this.ctx.env);
			const result = await generateText({
				model,
				prompt,
				maxOutputTokens: maxTokens,
				timeout: 30_000
			});
			return { result, source: 'primary' };
		} catch (e) {
			const classified = classifyProviderError(e);
			this.log.warn('profiler_primary_failed', {
				provider: providerKey,
				modelId,
				category: classified.category,
				retriable: classified.retriable,
				...formatError(e)
			});

			// Only fall back on provider-level failures — retrying with a different
			// model won't help for content_filter or context_length errors.
			const retriableCategories = new Set(['auth', 'rate_limit', 'provider_down', 'unknown']);
			if (!retriableCategories.has(classified.category)) return null;
		}

		// Attempt configured profiler fallback model.
		try {
			const fallbackConfig = await getModelConfigWithFallback(
				this.ctx.db,
				'profiler_extraction_fallback_model'
			);
			const fallbackModel = getModelFromConfig(fallbackConfig, this.ctx.env);
			const result = await generateText({
				model: fallbackModel,
				prompt,
				maxOutputTokens: maxTokens,
				timeout: 30_000
			});
			this.log.info('profiler_fallback_succeeded', {
				fallbackModel: fallbackConfig.model_id,
				fallbackConfigKey: fallbackConfig.config_key
			});
			return { result, source: 'fallback' };
		} catch (fallbackErr) {
			const classified = classifyProviderError(fallbackErr);
			this.log.error('profiler_fallback_failed', {
				category: classified.category,
				...formatError(fallbackErr)
			});
			return null;
		}
	}

	/**
	 * Load the model chain configured for this profiler agent, ordered by priority.
	 */
	private async loadModelChain(): Promise<ResolvedModelChainEntry[]> {
		const rows = await this.ctx.db.query.profilerModelChain.findMany({
			where: eq(profilerModelChain.profilerAgentId, this.ctx.profilerAgentId),
			orderBy: [asc(profilerModelChain.priority)],
			with: {
				aiAgentModel: {
					with: {
						aiProvider: true,
						aiPricingRate: true
					}
				}
			}
		});

		const chain = rows
			.filter((row) => row.isActive !== false && row.aiAgentModel?.modelId)
			.map((row) => ({
				id: row.id,
				modelId: row.aiAgentModel?.modelId ?? row.modelId,
				provider: row.aiAgentModel?.aiProvider?.providerKey ?? 'cloudflare',
				displayName: row.aiAgentModel?.modelId ?? row.modelId,
				priority: row.priority ?? 0,
				temperature: Number(row.temperature) || 0.3,
				maxTokens: row.maxTokens ?? 2048,
				timeoutMs: row.timeoutMs ?? 30000,
				retryCount: row.retryCount ?? 1,
				pricingRateId: row.aiAgentModel?.currentPricing ?? null,
				pricing: row.aiAgentModel?.aiPricingRate
					? mapDrizzlePricing(row.aiAgentModel.aiPricingRate)
					: null
			}));

		if (chain.length > 0) return chain;

		const profilerAgent = await this.getProfilerAgent();
		const model = profilerAgent.model;
		if (!model?.modelId) return [];

		return [
			{
				id: `${this.ctx.profilerAgentId}:default`,
				modelId: model.modelId,
				provider: model.provider?.providerKey ?? 'cloudflare',
				displayName: model.modelId,
				priority: 0,
				temperature: 0.2,
				maxTokens: Number(profilerAgent.maxTokens) || 800,
				timeoutMs: 30000,
				retryCount: 1,
				pricingRateId: model.currentPricing,
				pricing: model.pricing
			}
		];
	}

	/**
	 * Deterministic extraction path. Uses the configured model chain when present,
	 * otherwise uses the profiler agent's configured model as a single-step chain.
	 */
	async extractStructured(
		messages: MessagePair[],
		schemaSections: ExtractionSchemaSection[],
		options: { source?: 'onboarding' | 'chat'; fullSchema?: ProfileSchemaSection[] } = {}
	): Promise<boolean> {
		const startTime = Date.now();
		const attempts: ExtractionAttempt[] = [];
		const source = options.source ?? 'chat';

		// 1. Load model chain
		const chain = await this.loadModelChain();
		if (chain.length === 0) {
			this.log.info('no_model_chain', { profilerAgentId: this.ctx.profilerAgentId });
			return false;
		}

		// 2. Build dynamic Zod schema
		const extractionSchema = buildExtractionSchema(schemaSections);
		const fullSchema = options.fullSchema ?? this.toProfileSchemaSections(schemaSections);
		const graph = this.getGraphService();
		const profileNodes = await graph.getProfile();
		const profileContext = this.serializeProfileForPrompt(profileNodes, fullSchema);
		const schemaDefinitions = this.serializeStructuredSchemaDefinitions(schemaSections);
		const conversationText = messages
			.map((m, i) => `[${i + 1}] User: ${m.userMessage}\nAssistant: ${m.assistantResponse}`)
			.join('\n\n');
		const prompt = this.buildStructuredExtractionPrompt({
			schemaDefinitions,
			profileContext,
			conversationText,
			messageCount: messages.length
		});

		// 3. Build retry plan
		const plan = buildRetryPlan(chain);
		let output: StructuredExtractionOutput | null = null;
		let successfulChainEntry: ResolvedModelChainEntry | null = null;

		// 4. Execute with fallback chain
		for (const step of plan) {
			const attemptStart = Date.now();
			const chainEntry = chain.find(
				(entry) =>
					entry.modelId === step.modelId &&
					entry.provider === step.provider &&
					entry.priority === step.priority
			);
			if (!chainEntry) continue;

			try {
				const model = getModel(step.provider, step.modelId, this.ctx.env);
				const result = await generateText({
					model,
					output: Output.object({
						schema: extractionSchema,
						name: 'profile_extraction',
						description: 'Conservative profile and memory extraction from explicit user evidence.'
					}),
					prompt,
					maxOutputTokens: step.maxTokens,
					temperature: step.temperature,
					timeout: step.timeoutMs
				});

				output = result.output as StructuredExtractionOutput;
				const { costUsd, tokens } = computeInferenceCost(chainEntry.pricing, result.usage);
				attempts.push({
					modelId: step.modelId,
					provider: step.provider,
					priority: step.priority,
					attempt: step.attempt,
					durationMs: Date.now() - attemptStart,
					tokenCountInput: tokens.input,
					tokenCountOutput: tokens.output,
					costUsd,
					status: 'success'
				});
				successfulChainEntry = chainEntry;

				if (this.ctx.costTracker && chainEntry.pricing && chainEntry.pricingRateId) {
					const creditsPerUsd = await getCreditsPerUsd(this.ctx.db);
					this.ctx.costTracker.addEvent({
						operation: 'inference',
						modelId: step.modelId,
						tokens: { input: tokens.input, output: tokens.output },
						costUsd,
						credits: costUsd * creditsPerUsd,
						pricingRateId: chainEntry.pricingRateId,
						metadata: { purpose: 'profiler_structured_extraction' }
					});
				}

				break;
			} catch (err) {
				const category = classifyErrorForChain(err);
				attempts.push({
					modelId: step.modelId,
					provider: step.provider,
					priority: step.priority,
					attempt: step.attempt,
					durationMs: Date.now() - attemptStart,
					tokenCountInput: 0,
					tokenCountOutput: 0,
					costUsd: 0,
					status: shouldAbort(category) ? 'failed' : 'retry',
					errorCategory: category,
					errorMessage: err instanceof Error ? err.message : String(err)
				});

				if (shouldAbort(category)) break;
			}
		}

		const logId = generateId();
		const writeResults = output
			? await this.applyStructuredWrites({
					graph,
					profileNodes,
					output,
					logId,
					source,
					schemaSections: fullSchema
				})
			: {
					profileFieldsWritten: [] as WriteDecision[],
					profileFieldsSkipped: [] as WriteDecision[],
					memoryNodesWritten: [] as string[],
					memoryNodesSkipped: [] as string[]
				};

		// 5. Log to extraction ledger
		const summary = summarizeAttempts(attempts);
		const logInput: ExtractionLogInput = {
			userId: this.ctx.userId,
			profilerAgentId: this.ctx.profilerAgentId,
			sourceType: source,
			sourceMessageIds: [],
			modelUsed: summary.successModel ?? 'none',
			providerUsed: summary.successProvider ?? 'none',
			rawOutput: output,
			profileFieldsWritten: writeResults.profileFieldsWritten,
			profileFieldsSkipped: writeResults.profileFieldsSkipped,
			memoryNodesWritten: writeResults.memoryNodesWritten,
			memoryNodesSkipped: writeResults.memoryNodesSkipped,
			schemaProposals: (output as StructuredExtractionOutput | null)?.schemaProposals ?? [],
			attempts,
			extractionDurationMs: Date.now() - startTime,
			tokenCountInput: summary.totalTokensInput,
			tokenCountOutput: summary.totalTokensOutput,
			costUsd: summary.totalCostUsd
		};

		const entry = buildLogEntry(logInput);
		entry.id = logId;
		await this.ctx.db.insert(profilerExtractionLog).values({
			...entry,
			extractionDurationMs: String(entry.extractionDurationMs),
			tokenCountInput: String(entry.tokenCountInput),
			tokenCountOutput: String(entry.tokenCountOutput),
			costUsd: String(entry.costUsd)
		});

		await this.persistSchemaProposals(logId, output?.schemaProposals ?? []);

		this.log.info('structured_extraction_complete', {
			profilerAgentId: this.ctx.profilerAgentId,
			model: successfulChainEntry?.displayName ?? 'none',
			profileFieldsWritten: writeResults.profileFieldsWritten.length,
			profileFieldsSkipped: writeResults.profileFieldsSkipped.length,
			memoryNodesWritten: writeResults.memoryNodesWritten.length,
			memoryNodesSkipped: writeResults.memoryNodesSkipped.length
		});

		const shouldRunLegacyFallback =
			!output ||
			(fullSchema.length > 0 &&
				!this.profileNodesHaveFields(profileNodes) &&
				writeResults.profileFieldsWritten.length === 0);

		return !shouldRunLegacyFallback;
	}

	private profileNodesHaveFields(profileNodes: GraphNode[]): boolean {
		return profileNodes.some((node) => {
			const data = node.data as Partial<ProfileSectionData>;
			return data.fields ? Object.keys(data.fields).length > 0 : false;
		});
	}

	private buildStructuredExtractionPrompt(input: {
		schemaDefinitions: string;
		profileContext: string;
		conversationText: string;
		messageCount: number;
	}): string {
		return `${input.schemaDefinitions}

${input.profileContext}

---
CONVERSATION (${input.messageCount} exchanges):
${input.conversationText}
---

Extract only stable profile facts that the user explicitly states in the conversation. Assistant guesses, generic advice, or facts that merely sound plausible are not evidence.

Rules:
- profileUpdates may use the schema sections and field keys listed above, or discovered sections/fields when the schema does not cover explicit useful profile data.
- Use exact schema section IDs and field keys when the fact matches them.
- For facts that do not fit the schema, add a discovered field to the best existing section, or create a new snake_case sectionId with sectionLabel.
- Put explicit durable profile facts in profileUpdates, not memoryObservations.
- Do not infer family status, debt, assets, investment experience, income, or preferences unless the user states them directly.
- Leave unchanged fields out of profileUpdates.
- Use confidence below 0.3 when evidence is weak; those writes will be skipped.
- memoryObservations are for durable graph facts and relationships; they are mirrored into visible profile sections as non-schema fields. Do not duplicate exact profileUpdates as memoryObservations.
- memoryObservations should not be summaries of assistant advice.`;
	}

	private serializeStructuredSchemaDefinitions(schema: ExtractionSchemaSection[]): string {
		if (schema.length === 0) {
			return 'PROFILE SCHEMA: no predefined schema fields. Create discovered profile sections and fields for explicit durable profile facts.';
		}

		const lines = [
			'PREFERRED PROFILE SCHEMA (use exact keys when facts fit; discovered fields are allowed):'
		];
		for (const section of schema) {
			lines.push(`\nSection: ${section.sectionId}`);
			for (const field of section.fields) {
				lines.push(`  ${field.key} (${field.type}): "${field.label}"`);
			}
		}
		return lines.join('\n');
	}

	private toProfileSchemaSections(schema: ExtractionSchemaSection[]): ProfileSchemaSection[] {
		return schema.map((section, index) => ({
			section_id: section.sectionId,
			label: section.sectionId,
			icon: 'user',
			order: index + 1,
			fields: section.fields.map((field) => ({
				key: field.key,
				label: field.label,
				type: field.type === 'array' ? 'list' : field.type === 'number' ? 'number' : 'text'
			}))
		}));
	}

	private async applyStructuredWrites(input: {
		graph: MemoryGraphService;
		profileNodes: GraphNode[];
		output: StructuredExtractionOutput;
		logId: string;
		source: 'onboarding' | 'chat';
		schemaSections: ProfileSchemaSection[];
	}): Promise<{
		profileFieldsWritten: WriteDecision[];
		profileFieldsSkipped: WriteDecision[];
		memoryNodesWritten: string[];
		memoryNodesSkipped: string[];
	}> {
		const profileFieldsWritten: WriteDecision[] = [];
		const profileFieldsSkipped: WriteDecision[] = [];
		const memoryNodesWritten: string[] = [];
		const memoryNodesSkipped: string[] = [];
		const sectionById = new Map(
			input.schemaSections.map((section) => [section.section_id, section])
		);
		const profileNodeBySection = new Map(
			input.profileNodes.map((node) => [node.id.split('::').pop() ?? node.id, node])
		);
		const now = new Date().toISOString();
		const sourceType: SourceType = input.source;

		for (const update of input.output.profileUpdates) {
			const schemaSection = sectionById.get(update.sectionId);
			const sectionId = schemaSection?.section_id ?? update.sectionId;
			const fieldByKey = new Map(schemaSection?.fields.map((field) => [field.key, field]) ?? []);
			const nodeId = `profile::${this.ctx.userId}::${sectionId}`;
			const existingNode = profileNodeBySection.get(sectionId);
			const sectionData: ProfileSectionData = existingNode
				? ({
						...(existingNode.data as ProfileSectionData),
						fields: { ...(existingNode.data.fields ?? {}) }
					} as ProfileSectionData)
				: {
						label: schemaSection?.label ?? update.sectionLabel ?? labelFromKey(sectionId),
						icon: schemaSection?.icon ?? update.icon ?? 'layers',
						order: schemaSection?.order ?? update.order ?? 99,
						fields: {}
					};
			let changed = false;

			for (const [fieldKey, fieldUpdate] of Object.entries(update.fields)) {
				const schemaField = fieldByKey.get(fieldKey);

				const existingField = sectionData.fields[fieldKey] as ProfileFieldMeta | undefined;
				const incoming: ProfileFieldMeta = {
					value: fieldUpdate.value,
					label: schemaField?.label ?? fieldUpdate.label ?? labelFromKey(fieldKey),
					confidence: fieldUpdate.confidence,
					source: sourceType,
					extractionLogId: input.logId,
					isSchema: Boolean(schemaField),
					updatedAt: now
				};
				const writeInput: IncomingFieldUpdate = {
					fieldKey,
					sectionId: update.sectionId,
					value: incoming.value,
					confidence: incoming.confidence,
					source: incoming.source,
					extractionLogId: incoming.extractionLogId
				};
				const decision = evaluateWrite(writeInput, this.normalizeExistingField(existingField));

				if (decision.action === 'skip') {
					profileFieldsSkipped.push(decision);
					continue;
				}

				if (decision.action === 'update_timestamp' && existingField) {
					sectionData.fields[fieldKey] = { ...existingField, updatedAt: now } as never;
				} else {
					sectionData.fields[fieldKey] = incoming as never;
				}
				profileFieldsWritten.push(decision);
				changed = true;
			}

			if (changed) {
				await input.graph.upsertNode({
					id: nodeId,
					type: 'PROFILE_SECTION',
					data: sectionData as unknown as Record<string, unknown>,
					confidence: 1.0
				});
				await input.graph.connectNodes(`user::${this.ctx.userId}`, nodeId, 'HAS_PROFILE_SECTION');
			}
		}

		for (const observation of input.output.memoryObservations) {
			const nodeId = await generateDeterministicNodeId(
				this.ctx.userId,
				observation.nodeType,
				observation.text
			);
			const existing = await input.graph.getNode(nodeId);
			const duplicateCandidate = existing
				? { confidence: existing.confidence ?? 0, data: existing.data }
				: null;
			const duplicateSkipped = shouldSkipDuplicate(duplicateCandidate, observation.confidence);
			if (duplicateSkipped) {
				memoryNodesSkipped.push(nodeId);
			} else {
				const node = buildGraphNode(this.ctx.userId, observation, input.logId);
				await input.graph.upsertNode({
					...node,
					id: nodeId,
					type: observation.nodeType
				});
				await input.graph.connectNodes(`user::${this.ctx.userId}`, nodeId, 'HAS_FACT', {
					source: `extraction::${input.logId}`
				});
				memoryNodesWritten.push(nodeId);
			}

			const projectionDecision = await this.projectMemoryObservationToProfile({
				graph: input.graph,
				observation,
				nodeId,
				logId: input.logId,
				source: input.source,
				schemaSections: input.schemaSections,
				now
			});

			if (projectionDecision.action === 'skip') {
				profileFieldsSkipped.push(projectionDecision);
			} else {
				profileFieldsWritten.push(projectionDecision);
			}
		}

		return { profileFieldsWritten, profileFieldsSkipped, memoryNodesWritten, memoryNodesSkipped };
	}

	private async projectMemoryObservationToProfile(input: {
		graph: MemoryGraphService;
		observation: MemoryObservation;
		nodeId: string;
		logId: string;
		source: 'onboarding' | 'chat';
		schemaSections: ProfileSchemaSection[];
		now: string;
	}): Promise<WriteDecision> {
		const projection = buildMemoryProjection(input.observation, input.nodeId);
		const schemaSection = input.schemaSections.find(
			(section) => section.section_id === projection.sectionId
		);
		const profileNodeId = `profile::${this.ctx.userId}::${projection.sectionId}`;
		const existingNode = await input.graph.getNode(profileNodeId);
		const sectionData: ProfileSectionData = existingNode
			? ({
					...(existingNode.data as ProfileSectionData),
					fields: { ...((existingNode.data as ProfileSectionData).fields ?? {}) }
				} as ProfileSectionData)
			: {
					label: schemaSection?.label ?? labelFromKey(projection.sectionId),
					icon: schemaSection?.icon ?? 'brain',
					order: schemaSection?.order ?? 1000,
					fields: {}
				};

		const existingField = sectionData.fields[projection.fieldKey] as ProfileFieldMeta | undefined;
		const incoming: ProfileFieldMeta = {
			value: input.observation.text,
			label: existingField?.label ?? projection.label,
			confidence: input.observation.confidence,
			source: input.source,
			extractionLogId: input.logId,
			isSchema: false,
			updatedAt: input.now
		};
		const decision = evaluateWrite(
			{
				fieldKey: projection.fieldKey,
				sectionId: projection.sectionId,
				value: incoming.value,
				confidence: incoming.confidence,
				source: incoming.source,
				extractionLogId: incoming.extractionLogId
			},
			this.normalizeExistingField(existingField)
		);

		if (decision.action === 'skip') return decision;

		if (decision.action === 'update_timestamp' && existingField) {
			sectionData.fields[projection.fieldKey] = { ...existingField, updatedAt: input.now } as never;
		} else {
			sectionData.fields[projection.fieldKey] = incoming as never;
		}

		await input.graph.upsertNode({
			id: profileNodeId,
			type: 'PROFILE_SECTION',
			data: sectionData as unknown as Record<string, unknown>,
			confidence: 1.0
		});
		await input.graph.connectNodes(
			`user::${this.ctx.userId}`,
			profileNodeId,
			'HAS_PROFILE_SECTION'
		);

		return decision;
	}

	private normalizeExistingField(field: ProfileFieldMeta | undefined): ExistingFieldMeta | null {
		if (!field) return null;
		const rawSource = field.source;
		const source: SourceType = ['user_edit', 'onboarding', 'chat_confirmed', 'chat'].includes(
			rawSource
		)
			? rawSource
			: 'chat';

		return {
			value: field.value,
			confidence: field.confidence,
			source,
			updatedAt: field.updatedAt,
			extractionLogId: field.extractionLogId ?? ''
		};
	}

	private async persistSchemaProposals(
		extractionLogId: string,
		proposals: SchemaProposal[]
	): Promise<void> {
		const rows = proposals
			.filter((proposal) => proposal.confidence >= 0.3)
			.map((proposal) => ({
				id: generateId(),
				userId: this.ctx.userId,
				extractionLogId,
				organizationId: null,
				suggestedKey: proposal.suggestedKey,
				suggestedSection: proposal.suggestedSection,
				label: proposal.label,
				exampleValues: [],
				reason: proposal.reason,
				confidence: String(proposal.confidence),
				status: 'pending'
			}));

		if (rows.length === 0) return;
		await this.ctx.db.insert(profilerSchemaProposals).values(rows);
	}

	/**
	 * Serialize current profile for LLM context.
	 * Shows schema fields first (with null placeholders for missing), then discovered fields.
	 */
	serializeProfileForPrompt(profileNodes: GraphNode[], schema: ProfileSchemaSection[]): string {
		if (profileNodes.length === 0 && schema.length === 0) {
			return 'Current profile: (empty — no information collected yet)';
		}

		// Build map of existing section data
		const sectionMap = new Map<string, ProfileSectionData>();
		const profileSections: ProfileSections = {};
		for (const node of profileNodes) {
			const sectionId = node.id.split('::').pop()!;
			const sectionData = node.data as ProfileSectionData;
			sectionMap.set(sectionId, sectionData);
			profileSections[sectionId] = { fields: sectionData.fields ?? {} };
		}

		const lines: string[] = ['Current profile:'];
		const consumedFields = new Set<string>();

		// Render schema sections first
		for (const schemaSection of schema) {
			const data = sectionMap.get(schemaSection.section_id);
			const fields = data?.fields ?? {};

			lines.push(`\nSection: ${schemaSection.section_id} (schema fields)`);

			// Schema fields (show null for missing)
			for (const field of schemaSection.fields) {
				const knownField = findProfileField(profileSections, schemaSection.section_id, field.key);
				if (knownField) {
					consumedFields.add(`${knownField.sectionId}:${knownField.key}`);
					lines.push(`  ${field.key} = "${knownField.value}"`);
				} else {
					lines.push(`  ${field.key} = null ← not yet collected`);
				}
			}

			// Discovered fields in this section
			const discoveredFields = Object.entries(fields).filter(
				([key]) =>
					!consumedFields.has(`${schemaSection.section_id}:${key}`) &&
					!schemaSection.fields.some((f) => sameProfileField(f.key, key))
			);
			if (discoveredFields.length > 0) {
				lines.push(`Section: ${schemaSection.section_id} (discovered)`);
				for (const [key, field] of discoveredFields) {
					lines.push(`  ${key} = "${field.value}"`);
				}
			}

			sectionMap.delete(schemaSection.section_id);
		}

		// Remaining sections not in any schema (fully discovered)
		for (const [sectionId, data] of sectionMap) {
			const discoveredEntries = Object.entries(data.fields).filter(
				([key]) => !consumedFields.has(`${sectionId}:${key}`)
			);
			if (discoveredEntries.length === 0) continue;

			lines.push(`\nSection: ${sectionId} (discovered)`);
			for (const [key, field] of discoveredEntries) {
				lines.push(`  ${key} = "${field.value}"`);
			}
		}

		return lines.join('\n');
	}

	/**
	 * Serialize schema field definitions for the LLM.
	 */
	private serializeSchemaDefinitions(schema: ProfileSchemaSection[]): string {
		if (schema.length === 0) return '';

		const lines: string[] = ['PROFILE SCHEMA (use these exact keys when applicable):'];

		for (const section of schema) {
			lines.push(`\nSection: ${section.section_id} — ${section.label}`);
			for (const field of section.fields) {
				const desc = field.description ? ` — ${field.description}` : '';
				lines.push(`  ${field.key} (${field.type}): "${field.label}"${desc}`);
			}
		}

		return lines.join('\n');
	}
}

// ============================================================================
// Factory Function
// ============================================================================

export function createProfilerService(ctx: ProfilerContext): ProfilerService {
	return new ProfilerService(ctx);
}
