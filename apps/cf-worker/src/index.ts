import { routeAgentRequest } from 'agents';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { generateText } from 'ai';
import { OnboardingAgent, OnboardingSessionDO } from './durable/onboarding-session';
import { getDb } from './lib/db';
import type { Database } from '@repo/db/types';
import {
	aiAgents,
	aiAgentFlows,
	aiAgentModels,
	aiProviders,
	aiTools,
	analyticalTools,
	configFeatureFlags,
	dashboardTemplates,
	dashboardWidgets,
	dataSources,
	planPackages,
	userCustomization,
	userDataSources,
	users
} from '@repo/db/schema';
import { eq, and, asc, ne, inArray } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { handleDevRpc } from './lib/dev-rpc-handler';
import { QuantPMAgent } from './agent/chat-agent';
import { MemoryGraphService } from './graph/memory-graph-service';
import {
	generateProfileSummary,
	saveProfileSummary,
	getCachedSuggestions as getCachedSuggestionsImpl
} from './graph/suggestion-engine';
import { FileServiceEntrypoint } from './services/file-service';
import { processDocument, type DocumentProcessingParams } from './services/document-processor';
import { scheduledHandler as reminderScheduledHandler } from './services/reminder-scheduler';
import { syncModelsToDb, type SyncResult } from './services/model-sync';
import { Env } from './types';
import { loadGlobalProfileSchema } from './utils/schema-loader';
import {
	createCostTracker,
	trackTranscription,
	recordCostEventsFromArray,
	getPricingForModel
} from './utils/billing';
import {
	getModel,
	getModelConfig,
	getModelFromConfig,
	getConfigPricing
} from './utils/model-factory';
import { trackInferenceCost } from './utils/cost-tracker';
import { interpolatePrompt, NOTE_CATEGORIZATION, PROFILE_SCHEMA_GENERATION } from './utils/prompts';
import {
	filterVisibleAgents as filterVisibleAgentsByTags,
	splitAgentsByShelf,
	filterVisibleByTags
} from './utils/tag-visibility';
import { getUserTags } from './utils/tag-resolver';
import { resolveUserTags } from './utils/resolve-user-tags';
import { resolveEnabledFeatures } from './utils/feature-flags';
import { createLogger, formatError } from './utils/logger';
import { configurePostHogLogger } from './utils/posthog-logger';
import { rpcSafe, resolveVisibleItems } from './utils/rpc-safe';
import { resolveDataSource } from './services/data-resolver';
import { executeAnalyticalTool as runAnalyticalTool } from './services/analytical-tool-engine';
import { parseUploadedFile } from './services/file-import';
import { resolveProfilerPlanForUser } from './services/profiler-routing';
import { evaluateTagRule } from './utils/tag-rule-engine';
import {
	createCheckoutSession,
	createPortalSession,
	getAvailablePlans,
	handleWebhook
} from './services/payment-service';
import { validateFlow, compileFlow } from './utils/flow';
import type {
	ValidateAndCompileResult,
	ValidationResult,
	CompilationContext,
	CompiledFlowConfig,
	FlowData,
	TagRule
} from '@repo/shared/types';
import { getPinnedModelInfo, type PinnedModelInfo } from '@repo/shared/utils';
import type { OrionWorkerRpc } from '@repo/shared/types';

// Export Durable Objects, Workflows, and Entrypoints so Cloudflare can find them
export { FileServiceEntrypoint, OnboardingAgent, OnboardingSessionDO, QuantPMAgent };

export default class extends WorkerEntrypoint<Env> implements OrionWorkerRpc {
	async fetch(request: Request): Promise<Response> {
		configurePostHogLogger(this.env);
		return this.handleRequest(request);
	}

	private async handleRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			// ========================================
			// Health Check - Always available
			// ========================================
			if (path === '/health') {
				return Response.json({
					status: 'ok',
					service: 'QuantPM Orion Worker',
					timestamp: new Date().toISOString(),
					mode: this.env.IS_DEV === 'true' ? 'development' : 'production'
				});
			}

			// ========================================
			// Dev RPC Proxy (development only)
			// Allows SvelteKit apps to call worker/DO/FileService methods via HTTP
			// ========================================
			if (path.startsWith('/dev-rpc/')) {
				return handleDevRpc(request, this.env, path, {
					transcribeAudio: (args) => this.transcribeAudio(args),
					regenerateProfileSummary: (args) => this.regenerateProfileSummary(args),
					getVisibleAgents: (args) => this.getVisibleAgents(args),
					getEnabledFeatures: (args) => this.getEnabledFeatures(args),
					getVisibleTemplates: (args) => this.getVisibleTemplates(args),
					getVisibleWidgets: (args) => this.getVisibleWidgets(args),
					resolveWidgetData: (args) => this.resolveWidgetData(args),
					getTemplateById: (args) => this.getTemplateById(args),
					filterTemplateWidgets: (args) => this.filterTemplateWidgets(args),
					categorizeNote: (args) => this.categorizeNote(args),
					validateAndCompileFlow: (args) => this.validateAndCompileFlow(args),
					createCheckoutSession: (args) => this.createCheckoutSession(args),
					createPortalSession: (args) => this.createPortalSession(args),
					getAvailablePlans: () => this.getAvailablePlans(),
					generateProfileSchema: (args) => this.generateProfileSchema(args),
					generateOnboardingProfileConfig: (args) => this.generateOnboardingProfileConfig(args),
					getProfilerSchemas: (args) => this.getProfilerSchemas(args),
					getVisibleAnalyticalTools: (args) => this.getVisibleAnalyticalTools(args),
					executeAnalyticalTool: (args) => this.executeAnalyticalTool(args),
					getToolResults: (args) => this.getToolResults(args),
					getAvailableDataSources: (args) => this.getAvailableDataSources(args),
					importFile: (args) => this.importFile(args),
					syncModelsFromOpenRouter: () => this.syncModelsFromOpenRouter(),
					getCachedSuggestions: (args) => this.getCachedSuggestions(args)
				});
			}

			// ========================================
			// Stripe Webhook
			// ========================================
			if (request.method === 'POST' && path === '/api/stripe/webhook') {
				const signature = request.headers.get('stripe-signature');
				if (!signature) {
					return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 });
				}
				const db = await getDb(this.env);
				const rawBody = await request.text();
				try {
					await handleWebhook(this.env, db, rawBody, signature);
				} catch (err) {
					// Log but return 200 — Stripe retries on 5xx, causing duplicate processing
					const log = createLogger('StripeWebhook');
					log.error('webhook_handler_failed', { ...formatError(err) });
				}
				return Response.json({ received: true });
			}

			// ========================================
			// Agent Routes
			// ========================================
			if (path.startsWith('/agents/')) {
				// Profiler events SSE: /agents/{chatId}/profiler-events
				// Must be handled before routeAgentRequest — the Agents SDK
				// interprets the URL as /agents/{namespace}/{name} which doesn't
				// match any DO binding when chatId is the first segment.
				const profilerMatch = path.match(/^\/agents\/([^/]+)\/profiler-events$/);
				if (profilerMatch && request.method === 'GET') {
					const chatId = profilerMatch[1];
					const doId = this.env.QuantPMAgent.idFromName(chatId);
					const stub = this.env.QuantPMAgent.get(doId);
					// Rewrite URL to a simple path so the Agents SDK base class
					// doesn't try to parse /agents/{chatId}/profiler-events as
					// its own /agents/{namespace}/{name} routing scheme.
					const rewritten = new Request(
						new URL(`/profiler-events?chatId=${chatId}`, request.url),
						request
					);
					return stub.fetch(rewritten);
				}

				// SDK's routeAgentRequest handles routing to the correct DO instance
				const agentResponse = await routeAgentRequest(request, this.env, { cors: true });
				if (agentResponse) {
					return agentResponse;
				}
				return Response.json({ error: 'Agent not found' }, { status: 404 });
			}

			// ========================================
			// Root - API Info
			// ========================================
			return Response.json({
				name: 'QuantPM Orion Worker',
				version: '1.0.0',
				note: 'Use RPC via service bindings for all operations',
				availableRpc: ['transcribeAudio', 'getVisibleAgents', 'categorizeNote'],
				devRpc:
					this.env.IS_DEV === 'true' ? '/dev-rpc/{worker|file|graph|agent}/:method' : undefined
			});
		} catch (error) {
			const log = createLogger('Worker');
			log.error('worker_error', { ...formatError(error) });
			return Response.json({ error: String(error) }, { status: 500 });
		}
	}

	// ============================================================================
	// Audio Transcription RPC Method
	// ============================================================================

	/**
	 * RPC: Transcribe audio to text using Whisper
	 * Used by: Chat voice input (web and admin apps)
	 *
	 * Supports multiple Whisper models:
	 * - @cf/openai/whisper-large-v3-turbo (recommended): $0.00051/min, base64 input, returns duration
	 * - @cf/openai/whisper: $0.00045/min, array input
	 *
	 * @param params.userId - User ID for cost tracking
	 * @param params.audioBase64 - Base64 encoded audio data
	 * @param params.audioDurationMs - Optional audio duration in milliseconds (fallback for cost calc)
	 * @param params.messageId - Optional message ID for ledger context
	 * @returns Transcribed text and optional VTT subtitles
	 */
	async transcribeAudio(params: {
		userId: string;
		audioBase64: string;
		audioDurationMs?: number;
		messageId?: string;
		chatId?: string;
	}): Promise<{
		text: string;
		vtt?: string;
		words?: Array<{ word: string; start: number; end: number }>;
	}> {
		const { userId, audioBase64, audioDurationMs, messageId, chatId } = params;

		// Get database client and cost tracker
		const db = await getDb(this.env);
		const costTracker = createCostTracker();

		// Run transcription with cost tracking
		// Pass base64 directly - trackTranscription handles format conversion based on model
		const result = await trackTranscription(
			this.env,
			audioBase64,
			{
				db,
				userId,
				messageId,
				costTracker,
				audioDurationMs,
				purpose: 'voice_transcription'
			},
			'transcription_model'
		);

		// Record costs to ledger
		if (costTracker.events.length > 0) {
			await recordCostEventsFromArray(db, costTracker.events, {
				userId,
				messageId: messageId || `voice-input-${Date.now()}`,
				chatId
			});
		}

		return {
			text: result.text,
			vtt: result.vtt,
			words: result.words
		};
	}

	/**
	 * RPC: Force regeneration of a user's profile summary.
	 * Used by: Admin user details refresh action.
	 */
	async regenerateProfileSummary(params: { userId: string }): Promise<{
		success: boolean;
		regenerating: boolean;
	}> {
		const db = await getDb(this.env);
		const graph = new MemoryGraphService(db, params.userId);

		const deps = {
			env: this.env,
			graph,
			userId: params.userId
		};

		const summary = await generateProfileSummary(deps, params.userId);

		if (summary && summary.trim().length > 0) {
			await saveProfileSummary(deps, db, params.userId, summary);
			const log = createLogger('SuggestionEngine', { userId: params.userId });
			log.info('background_profile_regen_complete');
		}

		return {
			success: true,
			regenerating: true
		};
	}

	// ============================================================================
	// Suggestions RPC Method
	// ============================================================================

	/**
	 * RPC: Get cached suggestions for an agent, with background generation.
	 * Used by: Chat landing page when switching agents.
	 */
	async getCachedSuggestions(params: {
		userId: string;
		agentId: string;
		agentName?: string;
		agentDescription?: string;
	}): Promise<{
		suggestions: Array<{ title: string; description: string; prompt: string; icon: string }>;
		fromCache: boolean;
		regenerating: boolean;
	}> {
		const db = await getDb(this.env);
		const graph = new MemoryGraphService(db, params.userId);

		const deps = {
			env: this.env,
			graph,
			userId: params.userId,
			ctx: this.ctx
		};

		return getCachedSuggestionsImpl(deps, params);
	}

	// ============================================================================
	// Agent Visibility RPC Methods
	// ============================================================================

	/**
	 * RPC: Get visible agents for a user
	 * Uses tag_rule (OR/AND groups) for visibility gating
	 * Used by: Web app chat pages
	 */
	async getVisibleAgents(params: { userId: string; cfHeaders?: Record<string, string> }): Promise<{
		agents: Array<{
			id: string;
			name: string;
			description: string | null;
			avatar_url: string | null;
			status: string;
			is_universal: boolean;
			pinnedModelInfo: PinnedModelInfo | null;
		}>;
		shelfAgentIds: string[];
		hasShelf: boolean;
	}> {
		const { userId } = params;
		return rpcSafe(
			this.env,
			'get_visible_agents',
			{
				agents: [] as Array<{
					id: string;
					name: string;
					description: string | null;
					avatar_url: string | null;
					status: string;
					is_universal: boolean;
					pinnedModelInfo: PinnedModelInfo | null;
				}>,
				shelfAgentIds: [] as string[],
				hasShelf: false as boolean
			},
			async (db) => {
				const userTags = await resolveUserTags(userId, db);

				// Fetch active agents with current_flow join for pinned model info
				const agentRows = await db
					.select({
						id: aiAgents.id,
						name: aiAgents.name,
						description: aiAgents.description,
						avatar: aiAgents.avatar,
						status: aiAgents.status,
						is_universal: aiAgents.isUniversal,
						tag_rule: aiAgents.tagRule,
						compiled_config: aiAgentFlows.compiledConfig,
						flow_data: aiAgentFlows.flowData
					})
					.from(aiAgents)
					.leftJoin(aiAgentFlows, eq(aiAgents.currentFlow, aiAgentFlows.id))
					.where(and(eq(aiAgents.status, 'active'), ne(aiAgents.purpose, 'discovery')))
					.orderBy(asc(aiAgents.name));

				// Map to the shape filterVisibleAgentsByTags expects
				const agentRecords = agentRows.map((r) => ({
					id: r.id,
					name: r.name ?? '',
					description: r.description,
					avatar: r.avatar,
					status: r.status ?? 'active',
					is_universal: r.is_universal ?? false,
					tag_rule: r.tag_rule as TagRule | null,
					compiledConfig: (r.compiled_config as CompiledFlowConfig | null) ?? null,
					flowData: (r.flow_data as FlowData | null) ?? null
				}));

				// Filter by tag-based visibility
				const visibleAgents = filterVisibleAgentsByTags(agentRecords, userTags);

				// Fetch agent shelf from user_customization
				let shelfAgentIds: string[] = [];
				try {
					const shelf = await db.query.userCustomization.findFirst({
						where: and(
							eq(userCustomization.user, userId),
							eq(userCustomization.key, 'agent_shelf')
						),
						columns: { value: true }
					});
					shelfAgentIds = (shelf?.value as { agent_ids?: string[] })?.agent_ids ?? [];
				} catch (err) {
					createLogger('Worker').warn('load_agent_shelf_failed', { userId, ...formatError(err) });
				}

				// Split and order agents (shelf first)
				const { shelfAgents, otherAgents } = splitAgentsByShelf(visibleAgents, shelfAgentIds);
				const orderedAgents = [...shelfAgents, ...otherAgents];

				return {
					agents: orderedAgents.map((a) => ({
						id: a.id,
						name: a.name || '',
						description: a.description || null,
						avatar_url: a.avatar ? `/api/agent-avatar/${a.id}` : null,
						status: a.status || 'active',
						is_universal: a.is_universal || false,
						pinnedModelInfo: getPinnedModelInfo(a.compiledConfig, a.flowData)
					})),
					shelfAgentIds,
					hasShelf: shelfAgentIds.length > 0
				};
			},
			{ userId }
		);
	}

	// ============================================================================
	// Feature Flags RPC Method
	// ============================================================================

	/**
	 * RPC: Get enabled feature flags for a user
	 * is_enabled=true → restriction active, tag_rule evaluated
	 * is_enabled=false → restriction inactive, feature available to everyone
	 * Used by: Web app (app) layout for page/route gating
	 */
	async getEnabledFeatures(params: { userId: string }): Promise<{ features: string[] }> {
		const { userId } = params;
		return rpcSafe(
			this.env,
			'get_enabled_features',
			{ features: [] },
			async (db) => {
				const [userTags, flagRecords] = await Promise.all([
					resolveUserTags(userId, db),
					db
						.select({
							flagKey: configFeatureFlags.flagKey,
							isEnabled: configFeatureFlags.isEnabled,
							tagRule: configFeatureFlags.tagRule
						})
						.from(configFeatureFlags)
				]);

				return { features: resolveEnabledFeatures(flagRecords, userTags) };
			},
			{ userId }
		);
	}

	// ============================================================================
	// Dashboard Visibility RPCs
	// ============================================================================

	/**
	 * RPC: Get dashboard templates visible to a user (tag-gated)
	 * Used by: Web app profile selection / onboarding
	 */
	async getVisibleTemplates(params: { userId: string }): Promise<{
		templates: Array<{
			id: string;
			name: string;
			description: string;
			category: string;
			icon: string;
			default_widgets: unknown;
		}>;
	}> {
		const { userId } = params;
		return rpcSafe(
			this.env,
			'get_visible_templates',
			{ templates: [] },
			async (db) => {
				const templates = await resolveVisibleItems(
					userId,
					db,
					(db) =>
						db
							.select()
							.from(dashboardTemplates)
							.where(eq(dashboardTemplates.isActive, true))
							.orderBy(asc(dashboardTemplates.name)),
					(t) => t.tagRule as TagRule | null,
					(t) => ({
						id: t.id,
						name: t.name ?? '',
						description: t.description || '',
						category: t.category || '',
						icon: t.icon || '',
						default_widgets: t.defaultWidgets
					})
				);
				return { templates };
			},
			{ userId }
		);
	}

	/**
	 * RPC: Get dashboard widgets visible to a user (tag-gated)
	 * Used by: Web app widget catalog
	 */
	async getVisibleWidgets(params: { userId: string }): Promise<{
		widgets: Array<{
			id: string;
			name: string;
			widget_type: string;
			description: string;
			category: string;
			icon: string;
			default_size: string;
			default_config: unknown;
			base_type: string;
		}>;
	}> {
		const { userId } = params;
		return rpcSafe(
			this.env,
			'get_visible_widgets',
			{ widgets: [] },
			async (db) => {
				const widgets = await resolveVisibleItems(
					userId,
					db,
					(db) =>
						db
							.select()
							.from(dashboardWidgets)
							.where(eq(dashboardWidgets.isActive, true))
							.orderBy(asc(dashboardWidgets.name)),
					(w) => w.tagRule as TagRule | null,
					(w) => ({
						id: w.id,
						name: w.name ?? '',
						widget_type: w.widgetType ?? '',
						description: w.description || '',
						category: w.category || '',
						icon: w.icon || '',
						default_size: w.defaultSize || 'md',
						default_config: w.defaultConfig,
						base_type: w.baseType || ''
					})
				);
				return { widgets };
			},
			{ userId }
		);
	}

	// ============================================================================
	// Data Resolver RPC
	// ============================================================================

	/**
	 * RPC: Resolve a DataSourceRef to tabular data for a widget.
	 * Used by: Web app chart/data widgets that reference dynamic data sources.
	 */
	async resolveWidgetData(params: {
		userId: string;
		dataSourceRef: { type: string; source_id: string; params?: Record<string, unknown> };
	}): Promise<{ data: import('@repo/shared/types').ResolvedData | null }> {
		const { userId, dataSourceRef } = params;
		return rpcSafe(
			this.env,
			'resolve_widget_data',
			{ data: null },
			async (db) => {
				const data = await resolveDataSource(
					dataSourceRef as import('@repo/shared/types').DataSourceRef,
					{ userId, db }
				);
				return { data };
			},
			{ userId }
		);
	}

	// ============================================================================
	// File Import RPC
	// ============================================================================

	/**
	 * RPC: Import a user-uploaded file (CSV/JSON) into user_data_sources.
	 * Returns a DataSourceRef the caller can use to reference the parsed data.
	 */
	async importFile(params: {
		userId: string;
		fileContent: string;
		mimeType: string;
		fileName: string;
	}): Promise<{
		dataSourceRef: import('@repo/shared/types').DataSourceRef;
		recordId: string;
		columnCount: number;
		rowCount: number;
	}> {
		const { userId, fileContent, mimeType, fileName } = params;
		const db = await getDb(this.env);

		const data = parseUploadedFile(fileContent, mimeType, fileName);

		const now = new Date().toISOString();
		const recordId = generateId();
		await db.insert(userDataSources).values({
			id: recordId,
			user: userId,
			sourceKey: `upload-${crypto.randomUUID()}`,
			displayName: fileName.replace(/\.[^.]+$/, ''),
			data,
			createdBy: 'upload',
			created: now,
			updated: now
		});

		return {
			dataSourceRef: { type: 'user-upload' as const, source_id: recordId },
			recordId,
			columnCount: data.columns.length,
			rowCount: data.rows.length
		};
	}

	// ============================================================================
	// Available Data Sources Catalog RPC
	// ============================================================================

	/**
	 * RPC: Return all data sources the user can reference — admin-managed + user-owned.
	 * Used by: DashboardShell to populate the data source selector dropdown.
	 */
	async getAvailableDataSources(params: { userId: string }): Promise<{
		sources: import('@repo/shared/types').DataSourceCatalogItem[];
	}> {
		const { userId } = params;
		return rpcSafe(
			this.env,
			'get_available_data_sources',
			{ sources: [] },
			async (db) => {
				const [adminSources, userSources] = await Promise.all([
					db
						.select({
							sourceKey: dataSources.sourceKey,
							displayName: dataSources.displayName,
							description: dataSources.description,
							sourceType: dataSources.sourceType
						})
						.from(dataSources)
						.where(eq(dataSources.isActive, true))
						.orderBy(asc(dataSources.displayName)),
					db
						.select({
							id: userDataSources.id,
							displayName: userDataSources.displayName,
							createdBy: userDataSources.createdBy,
							updated: userDataSources.updated
						})
						.from(userDataSources)
						.where(eq(userDataSources.user, userId))
						.orderBy(userDataSources.updated)
				]);

				const sources: import('@repo/shared/types').DataSourceCatalogItem[] = [
					...adminSources.map((s) => ({
						source_id: s.sourceKey!,
						type: (s.sourceType ?? 'static') as import('@repo/shared/types').DataSourceType,
						label: s.displayName!,
						description: s.description ?? undefined
					})),
					...userSources.map((s) => ({
						source_id: s.id,
						type: (s.createdBy === 'upload'
							? 'user-upload'
							: s.createdBy === 'tool'
								? 'analytical-tool'
								: 'agent-generated') as import('@repo/shared/types').DataSourceType,
						label: s.displayName!,
						created_by: s.createdBy as import('@repo/shared/types').DataSourceCreatedBy,
						updated_at: s.updated ?? undefined
					}))
				];

				return { sources };
			},
			{ userId }
		);
	}

	// ============================================================================
	// OpenRouter Model Sync RPC
	// ============================================================================

	/**
	 * RPC: Trigger model catalog sync from OpenRouter API.
	 * Called by: daily cron (0 6 * * *), admin "Sync Now" button via service binding.
	 */
	async syncModelsFromOpenRouter(): Promise<SyncResult> {
		const db = await getDb(this.env);
		return syncModelsToDb(db);
	}

	// ============================================================================
	// Template Fetch & Widget Filtering RPCs
	// ============================================================================

	/**
	 * RPC: Fetch a single dashboard template by ID (admin auth).
	 * Used by: Web app addDashboardFromTemplate to bypass collection-level read rules.
	 */
	async getTemplateById(params: { templateId: string }): Promise<{
		template: {
			id: string;
			name: string;
			description: string;
			icon: string;
			category: string;
			default_widgets: unknown;
		} | null;
	}> {
		return rpcSafe(
			this.env,
			'get_template_by_id',
			{ template: null },
			async (db) => {
				const t = await db.query.dashboardTemplates.findFirst({
					where: eq(dashboardTemplates.id, params.templateId)
				});
				if (!t) return { template: null };
				return {
					template: {
						id: t.id,
						name: t.name ?? '',
						description: t.description || '',
						icon: t.icon || '',
						category: t.category || '',
						default_widgets: t.defaultWidgets
					}
				};
			},
			{ templateId: params.templateId }
		);
	}

	/**
	 * RPC: Filter template widgets by user tag_rules.
	 * Used by: Web app addDashboardFromTemplate to scope widgets at instantiation.
	 */
	async filterTemplateWidgets(params: {
		userId: string;
		widgets: unknown[];
	}): Promise<{ filteredWidgets: unknown[] }> {
		const { userId, widgets } = params;
		return rpcSafe(
			this.env,
			'filter_template_widgets',
			{ filteredWidgets: widgets },
			async (db) => {
				const userTags = await resolveUserTags(userId, db);

				const filtered = (
					widgets as Array<{
						tag_rule?: import('@repo/shared/types').TagRule | null;
						[k: string]: unknown;
					}>
				).filter((w) => {
					if (!w.tag_rule || !w.tag_rule.groups || w.tag_rule.groups.length === 0) return true;
					return evaluateTagRule(w.tag_rule, userTags);
				});

				return { filteredWidgets: filtered };
			},
			{ userId }
		);
	}

	// ============================================================================
	// Note Categorization RPC Method
	// ============================================================================

	/**
	 * RPC: Auto-categorize note content using AI
	 * Used by: Web app when saving chat messages as notes
	 *
	 * Uses a lightweight Cloudflare Workers AI model to generate
	 * a category label and keyword tags from note content.
	 *
	 * @param args.content - The note content to categorize
	 * @param args.agentName - Optional agent name for context
	 * @returns Category label and up to 5 keyword tags
	 */
	async categorizeNote(args: {
		content: string;
		agentName?: string;
		userId?: string;
		chatId?: string;
	}): Promise<{ category: string; tags: string[] }> {
		const { content, agentName, userId, chatId } = args;
		return rpcSafe(
			this.env,
			'categorize_note',
			{ category: 'General', tags: [] },
			async (db) => {
				const config = await getModelConfig(db, 'llm_model');
				const modelId = config.model_id;
				const model = getModelFromConfig(config, this.env);

				const agentContext = agentName
					? ` The note was produced by an AI agent named "${agentName}".`
					: '';

				const prompt = interpolatePrompt(NOTE_CATEGORIZATION, {
					agentContext,
					noteContent: content.substring(0, 2000)
				});

				const { text, usage } = await generateText({
					model,
					prompt,
					timeout: 15_000
				});

				// Track cost
				if (userId) {
					try {
						await trackInferenceCost({
							db,
							modelConfig: config,
							usage,
							purpose: 'note_categorization',
							pricing: getConfigPricing(config) ?? (await getPricingForModel(db, modelId)),
							recordContext: { userId, messageId: `note::${Date.now()}`, chatId }
						});
					} catch (costErr) {
						const log = createLogger('Worker');
						log.warn('categorize_note_cost_tracking_failed', { ...formatError(costErr as Error) });
					}
				}

				// Parse the JSON response
				const cleaned = text.trim().replace(/```json\n?|\n?```/g, '');
				const parsed = JSON.parse(cleaned);

				return {
					category:
						typeof parsed.category === 'string' ? parsed.category.substring(0, 100) : 'General',
					tags: Array.isArray(parsed.tags)
						? parsed.tags.filter((t: unknown) => typeof t === 'string').slice(0, 5)
						: []
				};
			},
			{ userId }
		);
	}

	// ============================================================================
	// Profile Schema Generation RPC Method
	// ============================================================================

	/**
	 * RPC: Return the active profile schema for a specific user.
	 * Used by: web/admin profile views and markdown rendering.
	 */
	async getProfilerSchemas(args?: { userId?: string }): Promise<{
		sections: Array<{
			section_id: string;
			label: string;
			icon: string;
			order: number;
			fields: Array<{
				key: string;
				label: string;
				type: 'text' | 'number' | 'date' | 'list';
				description?: string;
			}>;
		}>;
	}> {
		return rpcSafe(
			this.env,
			'get_profiler_schemas',
			{ sections: [] },
			async (db) => {
				const schema = await loadGlobalProfileSchema(db);
				if (!args?.userId) {
					return { sections: schema };
				}

				const plan = await resolveProfilerPlanForUser(db, args.userId);
				return { sections: plan.visibleSchema };
			},
			args?.userId ? { userId: args.userId } : undefined
		);
	}

	/**
	 * RPC: Generate a profile schema from a system prompt using AI
	 * Used by: Admin profiler editor "Generate Schema" button
	 */
	async generateProfileSchema(args: {
		systemPrompt: string;
		modelId: string;
	}): Promise<{ success: boolean; schema?: string; error?: string }> {
		const log = createLogger('Worker');

		try {
			const db = await getDb(this.env);
			const modelRow = await db.query.aiAgentModels.findFirst({
				where: eq(aiAgentModels.id, args.modelId),
				columns: { id: true, modelId: true, displayName: true },
				with: { aiProvider: { columns: { providerKey: true } } }
			});

			if (!modelRow?.aiProvider?.providerKey) {
				return { success: false, error: 'Model has no provider configured' };
			}

			const model = getModel(modelRow.aiProvider.providerKey, modelRow.modelId!, this.env);

			const prompt = interpolatePrompt(PROFILE_SCHEMA_GENERATION, {
				systemPrompt: args.systemPrompt
			});

			const { text } = await generateText({
				model,
				prompt,
				maxOutputTokens: 2000,
				temperature: 0.3,
				timeout: 30_000
			});

			const content = text.trim();
			if (!content) return { success: false, error: 'Empty LLM response' };

			JSON.parse(content);
			return { success: true, schema: content };
		} catch (error) {
			log.error('generate_profile_schema_failed', { ...formatError(error) });
			if (error instanceof SyntaxError) {
				return { success: false, error: 'LLM returned invalid JSON' };
			}
			return { success: false, error: (error as Error).message };
		}
	}

	/**
	 * RPC: Generate an onboarding profile config from loose markdown using AI.
	 * Used by: Admin onboarding profile markdown import fallback.
	 */
	async generateOnboardingProfileConfig(args: {
		modelId: string;
		system: string;
		context: string;
		user: string;
	}): Promise<{ success: boolean; output?: unknown; error?: string }> {
		const log = createLogger('Worker');

		try {
			const db = await getDb(this.env);
			const modelRow = await db.query.aiAgentModels.findFirst({
				where: eq(aiAgentModels.id, args.modelId),
				columns: { id: true, modelId: true, displayName: true },
				with: { aiProvider: { columns: { providerKey: true } } }
			});

			if (!modelRow?.aiProvider?.providerKey || !modelRow.modelId) {
				return { success: false, error: 'Model has no provider configured' };
			}

			const model = getModel(modelRow.aiProvider.providerKey, modelRow.modelId, this.env);
			const prompt = `${args.system}\n\n${args.context}\n\n## Source Markdown\n${args.user}\n\nReturn only valid JSON. Do not include markdown fences.`;

			const { text } = await generateText({
				model,
				prompt,
				maxOutputTokens: 4000,
				temperature: 0.2,
				timeout: 45_000
			});

			const content = text
				.trim()
				.replace(/^```(?:json)?\s*/i, '')
				.replace(/\s*```$/i, '');
			if (!content) return { success: false, error: 'Empty LLM response' };

			return { success: true, output: JSON.parse(content) };
		} catch (error) {
			log.error('generate_onboarding_profile_config_failed', { ...formatError(error) });
			if (error instanceof SyntaxError) {
				return { success: false, error: 'LLM returned invalid JSON' };
			}
			return { success: false, error: (error as Error).message };
		}
	}

	// ============================================================================
	// Flow Validation & Compilation RPC Method
	// ============================================================================

	/**
	 * RPC: Validate and compile a flow configuration
	 * Used by: Admin app when saving flow versions
	 *
	 * This method is the single source of truth for flow validation and compilation.
	 * The admin app calls this RPC, receives the result, and handles DB persistence.
	 *
	 * @param args.agentId - The agent ID (for context, not used for fetching)
	 * @param args.flowData - The flow data with nodes and edges
	 * @returns ValidateAndCompileResult with validation status, errors, and compiled config
	 */
	async validateAndCompileFlow(args: {
		agentId: string;
		flowData: { nodes: unknown[]; edges: unknown[] };
	}): Promise<ValidateAndCompileResult> {
		const { agentId, flowData } = args;
		const log = createLogger('Worker', { agentId });

		try {
			const db = await getDb(this.env);

			// Fetch active models and tools for validation context
			const [models, tools] = await Promise.all([
				db
					.select({
						id: aiAgentModels.id,
						modelId: aiAgentModels.modelId,
						displayName: aiAgentModels.displayName,
						currentPricing: aiAgentModels.currentPricing,
						contextWindow: aiAgentModels.contextWindow,
						maxOutputTokens: aiAgentModels.maxOutputTokens,
						defaultOptions: aiAgentModels.defaultOptions,
						capabilities: aiAgentModels.capabilities,
						configKey: aiAgentModels.configKey,
						providerId: aiProviders.id,
						providerKey: aiProviders.providerKey
					})
					.from(aiAgentModels)
					.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
					.where(
						and(
							eq(aiAgentModels.isActive, true),
							eq(aiAgentModels.isEnabled, true),
							eq(aiAgentModels.configKey, '')
						)
					),
				db
					.select({
						id: aiTools.id,
						toolKey: aiTools.toolKey,
						displayName: aiTools.displayName,
						description: aiTools.description,
						toolType: aiTools.toolType,
						sdkToolName: aiTools.sdkToolName,
						defaultConfig: aiTools.defaultConfig,
						providerId: aiProviders.id,
						providerKey: aiProviders.providerKey
					})
					.from(aiTools)
					.leftJoin(aiProviders, eq(aiTools.provider, aiProviders.id))
					.where(and(eq(aiTools.isActive, true), eq(aiTools.isEnabled, true)))
			]);

			// Build validation context
			const validationContext = {
				availableModelIds: models.map((m) => m.id),
				availableToolIds: tools.map((t) => t.id)
			};

			// Validate the flow
			const validationResult: ValidationResult = validateFlow(
				flowData as { nodes: any[]; edges: any[] },
				validationContext
			);

			// Build compilation context
			const compilationContext: CompilationContext = {
				models: models.map((m) => ({
					id: m.id,
					model_id: m.modelId!,
					display_name: m.displayName!,
					provider: {
						id: m.providerId ?? '',
						provider_key: m.providerKey ?? 'unknown'
					},
					current_pricing: m.currentPricing as string | undefined,
					context_window: m.contextWindow ? Number(m.contextWindow) : undefined,
					max_output_tokens: m.maxOutputTokens ? Number(m.maxOutputTokens) : undefined,
					default_options: m.defaultOptions as Record<string, unknown> | undefined,
					capabilities: m.capabilities as Record<string, unknown> | undefined
				})),
				tools: tools.map((t) => ({
					id: t.id,
					tool_key: t.toolKey!,
					display_name: t.displayName!,
					description: t.description ?? undefined,
					tool_type: t.toolType as 'sdk' | 'builtin',
					sdk_tool_name: t.sdkToolName ?? undefined,
					default_config: t.defaultConfig as Record<string, unknown> | undefined,
					provider: t.providerId
						? {
								id: t.providerId,
								provider_key: t.providerKey!
							}
						: undefined
				}))
			};

			// Compile the flow (only if valid or has warnings)
			let compiledConfig = undefined;
			if (validationResult.status !== 'invalid') {
				try {
					compiledConfig = compileFlow(
						flowData as { nodes: any[]; edges: any[] },
						compilationContext
					);
				} catch (error) {
					// If compilation fails, mark as invalid
					validationResult.status = 'invalid';
					validationResult.errors.push({
						code: 'MISSING_REQUIRED_FIELD',
						message: `Compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
						severity: 'error'
					});
				}
			}

			log.info('flow_validated_and_compiled', {
				status: validationResult.status,
				errorCount: validationResult.errors.length,
				hasCompiledConfig: !!compiledConfig
			});

			return {
				validationStatus: validationResult.status,
				validationErrors: validationResult.errors,
				compiledConfig
			};
		} catch (error) {
			log.error('validate_and_compile_flow_failed', { ...formatError(error) });
			return {
				validationStatus: 'invalid',
				validationErrors: [
					{
						code: 'MISSING_REQUIRED_FIELD',
						message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
						severity: 'error'
					}
				]
			};
		}
	}

	// ============================================================================
	// Payment RPC Methods
	// ============================================================================

	async createCheckoutSession(params: {
		userId: string;
		packageId: string;
	}): Promise<{ url: string }> {
		const db = await getDb(this.env);
		return createCheckoutSession(this.env, db, {
			userId: params.userId,
			packageId: params.packageId,
			returnUrl: this.env.STRIPE_PORTAL_RETURN_URL
		});
	}

	async createPortalSession(params: { userId: string }): Promise<{ url: string }> {
		const db = await getDb(this.env);
		return createPortalSession(this.env, db, {
			userId: params.userId,
			returnUrl: this.env.STRIPE_PORTAL_RETURN_URL
		});
	}

	async getAvailablePlans(): Promise<unknown[]> {
		const db = await getDb(this.env);
		return getAvailablePlans(db);
	}

	/**
	 * RPC: Debug a user's resolved tags and visibility
	 * Returns raw plan data, user customization, effective tags, and visible agents.
	 * Critical for diagnosing "why can't I see agent X?" issues.
	 */
	async debugUserTags(params: { userId: string }): Promise<{
		planData: { id: string; title: string; type: string; granted_tags: unknown } | null;
		userCustomization: { id: string; tags: unknown } | null;
		effectiveTags: string[];
		visibleAgents: Array<{
			id: string;
			name: string;
			tag_rule: import('@repo/shared/types').TagRule | null;
		}>;
		totalActiveAgents: number;
		diagnostics: string[];
	}> {
		const { userId } = params;
		const db = await getDb(this.env);
		const diagnostics: string[] = [];

		// 1. Fetch plan + user tags in parallel
		const [userResult, userTagsResult] = await Promise.allSettled([
			db
				.select({
					planId: users.plan,
					planTitle: planPackages.title,
					planType: planPackages.type,
					grantedTags: planPackages.grantedTags
				})
				.from(users)
				.leftJoin(planPackages, eq(users.plan, planPackages.id))
				.where(eq(users.id, userId))
				.limit(1)
				.then((rows) => rows[0] ?? null),
			db
				.select({ id: userCustomization.id, value: userCustomization.value })
				.from(userCustomization)
				.where(and(eq(userCustomization.user, userId), eq(userCustomization.key, 'tags')))
				.limit(1)
				.then((rows) => rows[0] ?? null)
		]);

		// 2. Extract raw plan data
		let planData: { id: string; title: string; type: string; granted_tags: unknown } | null = null;
		if (userResult.status === 'fulfilled' && userResult.value?.planId) {
			const p = userResult.value;
			planData = {
				id: p.planId!,
				title: p.planTitle ?? '',
				type: p.planType ?? '',
				granted_tags: p.grantedTags ?? null
			};

			if (!p.grantedTags) {
				diagnostics.push('Plan has no granted_tags');
			} else if (typeof p.grantedTags === 'string') {
				diagnostics.push('granted_tags is a JSON string (not array) — will be parsed defensively');
			}
		} else {
			diagnostics.push('No plan attached to user');
		}

		// 3. Extract raw user customization
		let userCustomizationData: { id: string; tags: unknown } | null = null;
		if (userTagsResult.status === 'fulfilled' && userTagsResult.value) {
			const rec = userTagsResult.value;
			const val = rec.value as { tags?: unknown } | null;
			userCustomizationData = { id: rec.id, tags: val?.tags ?? null };

			if (!val?.tags) {
				diagnostics.push('user_customization tags record exists but value.tags is empty');
			} else if (typeof val.tags === 'string') {
				diagnostics.push('user tags is a JSON string (not array) — will be parsed defensively');
			}
		} else {
			diagnostics.push('No user_customization tags record found');
		}

		// 4. Compute effective tags
		const plan = planData ? { granted_tags: planData.granted_tags as string[] | null } : null;
		const userCust = userCustomizationData
			? { tags: userCustomizationData.tags as string[] }
			: null;
		const effectiveTags = getUserTags(plan, userCust);

		if (!effectiveTags.some((t) => t.startsWith('geo:'))) {
			diagnostics.push('No geo tag found — onboarding geo capture may have failed');
		}
		if (!effectiveTags.some((t) => t.startsWith('tier:'))) {
			diagnostics.push('No tier tag found — plan may not grant tier tags');
		}

		// 5. Fetch all active agents and filter
		const agentRecords = await db
			.select({
				id: aiAgents.id,
				name: aiAgents.name,
				is_universal: aiAgents.isUniversal,
				tag_rule: aiAgents.tagRule
			})
			.from(aiAgents)
			.where(eq(aiAgents.status, 'active'))
			.orderBy(asc(aiAgents.name));

		const visibleAgents = filterVisibleAgentsByTags(
			agentRecords.map((a) => ({
				...a,
				name: a.name ?? '',
				is_universal: a.is_universal ?? false,
				tag_rule: a.tag_rule as import('@repo/shared/types').TagRule | null
			})),
			effectiveTags
		);

		return {
			planData,
			userCustomization: userCustomizationData,
			effectiveTags,
			visibleAgents: visibleAgents.map((a) => ({
				id: a.id,
				name: a.name,
				tag_rule: a.tag_rule
			})),
			totalActiveAgents: agentRecords.length,
			diagnostics
		};
	}

	// ============================================================================
	// Analytical Tools RPCs
	// ============================================================================

	async getVisibleAnalyticalTools(params: { userId: string }): Promise<{
		tools: Array<{
			id: string;
			tool_key: string;
			display_name: string;
			description: string;
			category: string;
			icon: string;
			input_schema: unknown;
			output_config: unknown;
		}>;
	}> {
		const { userId } = params;
		return rpcSafe(
			this.env,
			'get_visible_analytical_tools',
			{ tools: [] },
			async (db) => {
				const tools = await resolveVisibleItems(
					userId,
					db,
					(db) =>
						db
							.select()
							.from(analyticalTools)
							.where(eq(analyticalTools.isActive, true))
							.orderBy(asc(analyticalTools.displayName)),
					(t) => t.tagRule as TagRule | null,
					(t) => ({
						id: t.id,
						tool_key: t.toolKey ?? '',
						display_name: t.displayName ?? '',
						description: t.description || '',
						category: t.category || '',
						icon: t.icon || '',
						input_schema: t.inputSchema,
						output_config: t.outputConfig
					})
				);
				return { tools };
			},
			{ userId }
		);
	}

	async executeAnalyticalTool(params: {
		userId: string;
		toolKey: string;
		inputParams: Record<string, unknown>;
	}): Promise<{
		success: boolean;
		result?: import('@repo/shared/types').ToolExecutionResult;
		error?: string;
	}> {
		const { userId, toolKey, inputParams } = params;
		return rpcSafe(
			this.env,
			'execute_analytical_tool',
			{ success: false, error: 'Internal error' } as {
				success: boolean;
				result?: import('@repo/shared/types').ToolExecutionResult;
				error?: string;
			},
			async (db) => {
				const result = await runAnalyticalTool(
					{ tool_key: toolKey, input_params: inputParams, user_id: userId },
					{ userId, db }
				);
				return { success: true, result };
			},
			{ userId, toolKey }
		);
	}

	async getToolResults(params: { userId: string; toolKey?: string }): Promise<{
		results: Array<{
			id: string;
			tool_key: string;
			display_name: string;
			created: string;
			data: unknown;
		}>;
	}> {
		const { userId, toolKey } = params;
		return rpcSafe(
			this.env,
			'get_tool_results',
			{ results: [] },
			async (db) => {
				const conditions = [
					eq(userDataSources.user, userId),
					eq(userDataSources.createdBy, 'tool')
				];
				if (toolKey) conditions.push(eq(userDataSources.toolKey, toolKey));

				const records = await db
					.select({
						id: userDataSources.id,
						toolKey: userDataSources.toolKey,
						displayName: userDataSources.displayName,
						created: userDataSources.created,
						data: userDataSources.data
					})
					.from(userDataSources)
					.where(and(...conditions));

				return {
					results: records.map((r) => ({
						id: r.id,
						tool_key: r.toolKey || '',
						display_name: r.displayName!,
						created: r.created!,
						data: r.data
					}))
				};
			},
			{ userId }
		);
	}

	/**
	 * Scheduled handler for Cloudflare Cron Triggers.
	 * Dispatches to: reminder notifications (every 15 min) and model sync (daily 06:00 UTC).
	 */
	async scheduled(controller: ScheduledController): Promise<void> {
		configurePostHogLogger(this.env);
		if (controller.cron === '0 6 * * *') {
			const log = createLogger('ModelSyncCron');
			try {
				const result = await this.syncModelsFromOpenRouter();
				log.info('model_sync_cron_complete', { ...result });
			} catch (e) {
				log.error('model_sync_cron_failed', { ...formatError(e) });
			}
		} else {
			await reminderScheduledHandler(
				{ scheduledTime: controller.scheduledTime, cron: controller.cron } as ScheduledEvent,
				this.env,
				this.ctx
			);
		}
	}

	/**
	 * Queue consumer handler for document processing.
	 * Each message gets its own invocation with generous time limits (up to 15 min),
	 * solving the waitUntil() timeout issue.
	 * Retries are handled by the queue (max_retries: 2, then dead-letter queue).
	 */
	async queue(batch: MessageBatch<DocumentProcessingParams>): Promise<void> {
		configurePostHogLogger(this.env);
		const log = createLogger('QueueConsumer');

		for (const message of batch.messages) {
			const params = message.body;
			log.info('processing_start', { fileId: params.fileId, fileName: params.fileName });

			try {
				await processDocument(this.env, params);
				message.ack();
				log.info('processing_complete', { fileId: params.fileId });
			} catch (err) {
				log.error('processing_failed', {
					fileId: params.fileId,
					attempt: message.attempts,
					...formatError(err)
				});
				// Don't ack — the queue will retry (up to max_retries),
				// then route to dead-letter queue.
				message.retry();
			}
		}
	}
}
