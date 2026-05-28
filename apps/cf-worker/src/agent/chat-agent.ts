/**
 * QuantPM Agent
 *
 * A Cloudflare Agents SDK-powered chat agent that combines:
 * - Flow Executor for customizable AI flows
 * - RAG Service for hybrid search and context building
 * - Extraction Service for post-chat knowledge graph updates
 *
 * Built on the Agents SDK using the `onRequest` method for SSE streaming.
 */

import { Agent } from 'agents';
import {
	createUIMessageStream,
	createUIMessageStreamResponse,
	generateId,
	type UIMessage
} from 'ai';

import type { Env, SearchResult } from '../types';
import type { Database } from '@repo/db/types';
import { chatMessages, chatMessagesDebug, aiAgents, aiAgentFlows } from '@repo/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { generateId as generateDbId } from '@repo/db/id';
import type {
	CompiledFlowConfig,
	StartNodeData,
	Message,
	MessageAttachment,
	UIStreamWriter,
	ContextManagementConfig
} from '../types/flow';
import type { GraphNode } from '../types';

import { createFlowExecutor, loadUserConfig } from './flow-executor';
import {
	getSystemDefaultModel,
	getAvailableModelsForUser,
	clearModelResolverCache
} from '../utils/model-resolver';
import {
	RAGService,
	createRAGService,
	DEFAULT_RAG_CONFIG,
	type RAGConfig,
	type BuiltContext
} from '../services/rag-service';
import {
	createExtractionService,
	EXTRACTION_MESSAGE_THRESHOLD,
	SESSION_TIMEOUT_SECONDS,
	type MessagePair
} from '../services/session-summarizer';
import { clearProfilerCache } from '../services/profiler-service';
import { createProfilerDispatcher } from '../services/profiler-dispatcher';
import { resolveProfilerPlanForUser } from '../services/profiler-routing';
import { loadGlobalProfileSchema, clearGlobalSchemaCache } from '../utils/schema-loader';
import { clearConfigCache } from '../utils/model-factory';
import type { ModelPreference, ResolvedModel } from '../types/flow';
import { createCostTracker, recordCostEventsToLedger } from '../utils/billing';
import { checkCreditGate } from '../utils/tier-resolver';
import type { UserTierContext } from '../utils/tier-resolver';
import { resolveUserTags, resolveUserTagsAndTier } from '../utils/resolve-user-tags';
import { getPromptWithFallback } from '../utils/prompts';
import { createDebugLogger, type DebugLogger } from '../utils/debug-logger';
import { generateChatTitle, shouldGenerateTitle } from '../utils/title-generator';
import { getDb } from '../lib/db';
import {
	buildManagedContext,
	formatManagedContextForPrompt,
	getChatMeta,
	updateChatMeta,
	DEFAULT_CONTEXT_CONFIG,
	type ManagedContext,
	type SummaryState
} from '../utils/context-manager';
import { resolveAllAttributes, filterAttributesForUsage } from '../utils/attribute-resolver';
import { buildProfileContext } from '../utils/context-builder';
import { MemoryGraphService } from '../graph/memory-graph-service';
import { createLogger, formatError } from '../utils/logger';
import { configurePostHogLogger } from '../utils/posthog-logger';
import { waitUntil } from 'cloudflare:workers';
import { ConfigError, classifyProviderError } from '../utils/errors';
import { ProfilerEventHub, formatSseEvent, type ProfilerEvent } from './profiler-events';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent state for conversation and extraction tracking
 */
interface AgentState {
	/** Messages pending extraction, keyed by chatId */
	pendingMessages: Record<string, MessagePair[]>;
	/** Last activity timestamp per chat for session timeout */
	lastActivity: Record<string, number>;
	/** Conversation history cache (keyed by chatId) */
	conversationCache: Record<string, Message[]>;
	/** In-memory summary state per chat — only persisted to DB on session timeout */
	contextSummaries: Record<string, SummaryState>;
	/** Initial RAG context cache (built once per chat) */
	initialContextCache: Record<string, BuiltContext>;
	/** Track file IDs for detecting new attachments */
	lastAttachedFileIds: Record<string, string[]>;
	/** Track active schedule taskIds per chat */
	activeScheduleIds: Record<string, string>;
	/**
	 * DO instance name (= chatId). Persisted so alarm-woken fresh instances
	 * can skip the ensureNamePersisted write (CF issue #2240 workaround).
	 */
	instanceName?: string;
}

interface AttachedFile {
	id: string;
	name: string;
	type: string;
	size: number;
}

interface ChatRequest {
	message: string;
	userId: string;
	sessionId?: string;
	agentId?: string;
	chatId?: string;
	attachedFiles?: AttachedFile[];
	ragConfig?: Partial<RAGConfig>;
	agentStatus?: 'active' | 'inactive' | 'development';
	cfHeaders?: Record<string, string>;
	/** Per-chat model override record ID (from chats.model_override) */
	modelOverrideId?: string;
	/** Tool results from HIL tools (provided by client after addToolOutput) */
	toolResults?: Array<{
		toolCallId: string;
		toolName: string;
		args: unknown;
		output: unknown;
		providerMetadata?: Record<string, unknown>;
	}>;
	/** The assistant's text content before tool calls (for tool result resend context) */
	assistantText?: string;
	/** The client-side message ID to reuse for the response (prevents duplicate messages) */
	respondMessageId?: string;
}

// Cached agent record — uses Drizzle camelCase field shapes
type CachedAgent = typeof aiAgents.$inferSelect & {
	currentFlowRecord: typeof aiAgentFlows.$inferSelect | null;
};

// ============================================================================
// QuantPM Agent Class
// ============================================================================

export class QuantPMAgent extends Agent<Env, AgentState> {
	// Per-request caches (cleared after each request)
	private dbInstance: Database | null = null;
	private flowConfig: CompiledFlowConfig | null = null;
	private ragConfig: RAGConfig | null = null;
	private cachedAgentRecord: CachedAgent | null = null;
	private readonly profilerEventHub = new ProfilerEventHub();

	// Request queue per chat to prevent race conditions
	private chatRequestQueues = new Map<string, Promise<void>>();

	// ============================================================================
	// State Initialization
	// ============================================================================

	initialState: AgentState = {
		pendingMessages: {},
		lastActivity: {},
		conversationCache: {},
		contextSummaries: {},
		initialContextCache: {},
		lastAttachedFileIds: {},
		activeScheduleIds: {}
	};

	// ============================================================================
	// Scheduled Task Handlers
	// ============================================================================

	/**
	 * Handle scheduled session timeouts for batched extraction
	 */
	async onSessionTimeout(payload: {
		chatId: string;
		userId: string;
		agentId: string;
		sessionId: string;
	}) {
		const { chatId, userId, agentId, sessionId } = payload;

		// CF #2240: ensure name is hydrated for alarm-woken instances
		await this.ensureNamePersisted(chatId);

		const log = createLogger('ChatAgent', { chatId, userId });
		log.info('session_timeout', { agentId, sessionId });

		// Capture state BEFORE cleanup — we need pending messages and summary for background work
		const summaryState = this.state.contextSummaries?.[chatId];
		const pending = this.state.pendingMessages[chatId];
		const hasPending = pending && pending.length > 0;

		// Clean up DO state FIRST to avoid storage timeout.
		// Heavy extraction + profiler work runs in background via waitUntil.
		this.cleanupChatState(chatId);

		// Run summary persistence + extraction + profiler as background work
		// so the alarm handler returns quickly and avoids DO storage timeout.
		const backgroundWork = async () => {
			// Persist in-memory summary to DB before cleanup.
			if (summaryState) {
				try {
					const db = await this.getDatabase();
					await updateChatMeta(db, chatId, {
						summary: summaryState.summary,
						summaryMessageCount: summaryState.summarizedMessageCount,
						lastSummarizedAt: summaryState.lastSummarizedAt
					});
					log.info('summary_persisted', {
						chatId,
						summarizedMessageCount: summaryState.summarizedMessageCount
					});
				} catch (e) {
					log.error('summary_persist_failed', { chatId, ...formatError(e) });
				}
			}

			if (!hasPending) return;

			try {
				const db = await this.getDatabase();
				const extractionService = createExtractionService({
					env: this.env,
					db,
					userId,
					sessionId,
					agentId
				});
				await extractionService.extractFromBatch(pending, true);

				// Run profiler dispatcher on session end (best-effort)
				try {
					const userTags = await resolveUserTags(userId, db);
					this.emitProfilerEvent({
						type: 'profiler-started',
						chatId,
						reason: 'session_timeout'
					});
					const dispatcher = createProfilerDispatcher({
						env: this.env,
						db,
						userId,
						sessionId,
						agentId,
						userTags
					});
					await dispatcher.dispatch(pending);
					this.emitProfilerEvent({
						type: 'profiler-complete',
						chatId,
						reason: 'session_timeout'
					});
				} catch (profErr) {
					log.error('profiler_session_end_failed', { chatId, ...formatError(profErr) });
					this.emitProfilerEvent({
						type: 'profiler-failed',
						chatId,
						reason: 'session_timeout',
						error: profErr instanceof Error ? profErr.message : String(profErr)
					});
				}
			} catch (e) {
				log.error('extraction_failed', { chatId, ...formatError(e) });
			}
		};

		waitUntil(backgroundWork());
	}

	private cleanupChatState(chatId: string): void {
		const { [chatId]: _p, ...restPending } = this.state.pendingMessages || {};
		const { [chatId]: _a, ...restActivity } = this.state.lastActivity || {};
		const { [chatId]: _s, ...restSchedules } = this.state.activeScheduleIds || {};
		const { [chatId]: _cs, ...restSummaries } = this.state.contextSummaries || {};

		this.setState({
			...this.state,
			pendingMessages: restPending,
			lastActivity: restActivity,
			activeScheduleIds: restSchedules,
			contextSummaries: restSummaries
		});
	}

	// ============================================================================
	// Error Handling
	// ============================================================================

	/**
	 * Override partyserver's default onError to suppress noisy "Override onError"
	 * log spam. The main offender is CF #2240: alarms on DOs that were created
	 * before ensureNamePersisted was deployed will crash in the SDK alarm handler
	 * (which reads `this.name` before our code runs). These are transient — once
	 * every active DO has had at least one RPC call with the fix, alarms work.
	 */
	onError(connectionOrError: unknown, maybeError?: unknown): void | Promise<void> {
		configurePostHogLogger(this.env);
		const error = maybeError ?? connectionOrError;
		const msg = error instanceof Error ? error.message : String(error);
		const log = createLogger('ChatAgent', { instanceName: this.state?.instanceName });
		if (msg.includes('#2240') || msg.includes('.name')) {
			log.warn('alarm_name_not_set', { error: msg });
		} else {
			log.error('unhandled_error', { error: msg });
		}
	}

	// ============================================================================
	// HTTP Endpoints (SSE)
	// ============================================================================

	async onRequest(request: Request): Promise<Response> {
		configurePostHogLogger(this.env);
		const url = new URL(request.url);
		const path = url.pathname;

		if (
			request.method === 'GET' &&
			(path === '/profiler-events' || path.endsWith('/profiler-events'))
		) {
			const chatId =
				url.searchParams.get('chatId') ??
				this.extractInstanceIdFromPath(path) ??
				this.state.instanceName ??
				'unknown';
			return this.handleProfilerEvents(chatId);
		}

		// Health check
		if (request.method === 'GET' && (path === '/health' || path.endsWith('/health'))) {
			return Response.json({ status: 'ok', agent: this.state?.instanceName ?? 'unknown' });
		}

		// Available models endpoint
		if (request.method === 'GET' && (path === '/models' || path.endsWith('/models'))) {
			const userId = url.searchParams.get('userId');
			return this.handleGetModels(userId ?? undefined);
		}

		// Chat endpoint with SSE streaming
		if (request.method === 'POST' && (path === '/chat' || path.endsWith('/chat'))) {
			return this.handleChat(request);
		}

		return Response.json({ error: 'Not found' }, { status: 404 });
	}

	private async handleChat(request: Request): Promise<Response> {
		const body = (await request.json()) as ChatRequest;

		// Either a user message or tool results must be provided
		if (
			(!body.message || !body.message.trim()) &&
			(!body.toolResults || body.toolResults.length === 0)
		) {
			return Response.json({ error: 'message or toolResults required' }, { status: 400 });
		}
		if (!body.userId) {
			return Response.json({ error: 'userId required' }, { status: 400 });
		}

		// Extract CF headers for attribute resolution
		const cfHeaders: Record<string, string> = {};
		for (const [key, value] of request.headers) {
			const lowerKey = key.toLowerCase();
			if (lowerKey.startsWith('cf-') || lowerKey === 'accept-language') {
				cfHeaders[lowerKey] = value;
			}
		}

		return this.chat({ ...body, cfHeaders });
	}

	/**
	 * Immediately flush pending messages for extraction + profiler.
	 * Called by the frontend (via RPC) when the user navigates away from a chat.
	 */
	async flushPending(params: {
		chatId: string;
		userId: string;
		agentId: string;
	}): Promise<{ flushed: number }> {
		const { chatId, userId, agentId } = params;

		// CF #2240: initialize partyserver name for RPC cold starts
		await this.ensureNamePersisted(chatId);

		const pending = this.state.pendingMessages?.[chatId];
		if (!pending || pending.length === 0) {
			return { flushed: 0 };
		}

		const log = createLogger('ChatAgent', { chatId, userId });
		log.info('flush_pending', { messageCount: pending.length });

		const messagesToFlush = [...pending];
		const currentPending = { ...this.state.pendingMessages };
		currentPending[chatId] = [];
		this.setState({ ...this.state, pendingMessages: currentPending });

		try {
			const db = await this.getDatabase();
			const sessionId = `session::${agentId}::flush`;

			// Run extraction (non-blocking)
			const extractionService = createExtractionService({
				env: this.env,
				db,
				userId,
				sessionId,
				agentId
			});
			extractionService.extractFromBatch(messagesToFlush, false).catch((e) => {
				log.error('flush_extraction_failed', { ...formatError(e) });
			});

			// Run profiler dispatcher (non-blocking)
			resolveUserTags(userId, db)
				.then((userTags) => {
					this.emitProfilerEvent({
						type: 'profiler-started',
						chatId,
						reason: 'flush'
					});
					const dispatcher = createProfilerDispatcher({
						env: this.env,
						db,
						userId,
						sessionId,
						agentId,
						userTags
					});
					dispatcher
						.dispatch(messagesToFlush)
						.then(() => {
							this.emitProfilerEvent({
								type: 'profiler-complete',
								chatId,
								reason: 'flush'
							});
						})
						.catch((e) => {
							log.error('flush_profiler_failed', { ...formatError(e) });
							this.emitProfilerEvent({
								type: 'profiler-failed',
								chatId,
								reason: 'flush',
								error: e instanceof Error ? e.message : String(e)
							});
						});
				})
				.catch((e) => {
					log.error('flush_profiler_tags_failed', { ...formatError(e) });
					this.emitProfilerEvent({
						type: 'profiler-failed',
						chatId,
						reason: 'flush',
						error: e instanceof Error ? e.message : String(e)
					});
				});
		} catch (e) {
			log.error('flush_pending_failed', { ...formatError(e) });
		}

		return { flushed: messagesToFlush.length };
	}

	private emitProfilerEvent(event: Omit<ProfilerEvent, 'occurredAt'>): void {
		this.profilerEventHub.emit({
			...event,
			occurredAt: new Date().toISOString()
		});
	}

	private extractInstanceIdFromPath(path: string): string | null {
		const parts = path.split('/').filter(Boolean);
		const agentsIndex = parts.indexOf('agents');
		if (agentsIndex === -1) return null;
		return parts[agentsIndex + 1] ?? null;
	}

	private handleProfilerEvents(chatId: string): Response {
		const encoder = new TextEncoder();
		let unsubscribe = () => {};
		let heartbeat: ReturnType<typeof setInterval> | undefined;

		const cleanup = () => {
			unsubscribe();
			if (heartbeat) {
				clearInterval(heartbeat);
				heartbeat = undefined;
			}
		};

		const stream = new ReadableStream<Uint8Array>({
			start: (controller) => {
				const enqueue = (chunk: string) => {
					controller.enqueue(encoder.encode(chunk));
				};

				enqueue(
					formatSseEvent('connected', {
						chatId,
						occurredAt: new Date().toISOString()
					})
				);

				unsubscribe = this.profilerEventHub.subscribe((event) => {
					try {
						enqueue(formatSseEvent(event.type, event));
					} catch {
						cleanup();
						try {
							controller.close();
						} catch {
							// Stream already closed
						}
					}
				});

				heartbeat = setInterval(() => {
					try {
						enqueue(': keepalive\n\n');
					} catch {
						cleanup();
						try {
							controller.close();
						} catch {
							// Stream already closed
						}
					}
				}, 25_000);
			},
			cancel: () => {
				cleanup();
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache, no-transform',
				Connection: 'keep-alive'
			}
		});
	}

	/**
	 * Returns the list of AI models available for the user-facing model picker.
	 */
	private async handleGetModels(userId?: string): Promise<Response> {
		try {
			const db = await this.getDatabase();
			let tierCtx: UserTierContext | undefined;
			let userTags: string[] = [];
			if (userId) {
				try {
					const result = await resolveUserTagsAndTier(userId, db);
					userTags = result.userTags;
					tierCtx = result.tierContext;
				} catch (err) {
					createLogger('ChatAgent').warn('get_models_tier_resolution_failed', {
						userId,
						...formatError(err)
					});
				}
			}
			const models = await getAvailableModelsForUser(db, tierCtx, userTags);
			return Response.json({
				models,
				...(tierCtx && {
					tier: {
						hasCredits: tierCtx.hasCredits,
						hasSubscription: tierCtx.hasSubscription,
						fallbackModel: tierCtx.fallbackModel
					}
				})
			});
		} catch (error) {
			const log = createLogger('ChatAgent');
			log.error('get_models_failed', { ...formatError(error) });
			return Response.json({ error: 'Failed to load models' }, { status: 500 });
		}
	}

	// ============================================================================
	// Core Chat Method
	// ============================================================================

	async chat(params: ChatRequest): Promise<Response> {
		const {
			message,
			userId,
			sessionId,
			agentId,
			chatId,
			attachedFiles = [],
			ragConfig: ragOverrides,
			agentStatus,
			cfHeaders = {},
			modelOverrideId,
			toolResults,
			assistantText,
			respondMessageId
		} = params;

		// CF #2240: initialize partyserver name before anything touches this.name
		if (chatId) await this.ensureNamePersisted(chatId);

		const isToolResultResend = toolResults && toolResults.length > 0 && !message?.trim();
		const effectiveMessage = isToolResultResend ? '' : message || '';

		const agentType = agentId || this.getAgentType();
		const currentSessionId = sessionId || `session::${agentType}::${Date.now()}`;
		const isDevMode = agentStatus === 'development';
		const attachedFileIds = attachedFiles.map((f) => f.id);
		const startTime = Date.now();

		// Serialize requests per chat to prevent race conditions
		const queueKey = chatId || currentSessionId;
		const previousRequest = this.chatRequestQueues.get(queueKey) || Promise.resolve();
		let resolveCurrentRequest: () => void;
		const currentRequestPromise = new Promise<void>((resolve) => {
			resolveCurrentRequest = resolve;
		});
		this.chatRequestQueues.set(queueKey, currentRequestPromise);

		// Construct originalMessages so the SDK enters "persistence mode".
		// This ensures multi-step tool calls (e.g., display_chart → text summary)
		// are merged into a SINGLE assistant message instead of creating duplicates.
		// See: https://ai-sdk.dev/docs/troubleshooting/repeated-assistant-messages
		let originalMessages: UIMessage[];
		if (isToolResultResend) {
			// Tool result resend: the last assistant message had tool calls that the client
			// filled in via addToolOutput. Build originalMessages with the tool results
			// so the model can continue from the tool call.
			// Include a dummy assistant message with the client's message ID so the server
			// reuses the same ID in the response stream — this prevents the client from
			// pushing a duplicate message (it replaces the existing one instead).
			originalMessages = respondMessageId
				? [
						{
							id: respondMessageId,
							role: 'assistant' as const,
							parts: [{ type: 'text' as const, text: '' }]
						}
					]
				: [];
		} else {
			originalMessages = [
				{
					id: generateId(),
					role: 'user' as const,
					parts: [{ type: 'text' as const, text: effectiveMessage }]
				}
			];
		}

		return createUIMessageStreamResponse({
			stream: createUIMessageStream({
				originalMessages,
				execute: async ({ writer }) => {
					await previousRequest;

					// Prevent DO hibernation while streaming
					const disposeKeepAlive = await this.keepAlive();

					// Helper to write data-* parts to stream
					const sendDataEvent = (eventType: string, data: unknown) => {
						writer.write({ type: `data-${eventType}` as `data-${string}`, data } as any);
					};

					// Create a sendEvent adapter for debug logger (bridges writer to legacy interface)
					const sendEvent = async (event: string, data: unknown) => {
						sendDataEvent(event, data);
					};

					const debug = createDebugLogger(sendEvent, isDevMode);
					const db = await this.getDatabase();
					const costTracker = createCostTracker();
					let agentRecordId: string | undefined;

					// Resolve user tier for credit gating + model/tool restrictions
					let tierContext: UserTierContext | undefined;
					try {
						const result = await resolveUserTagsAndTier(userId, db);
						tierContext = result.tierContext;
					} catch (err) {
						createLogger('ChatAgent').warn('chat_tier_resolution_failed', {
							userId,
							...formatError(err)
						});
					}

					// Credit gate: reject non-subscribers with zero credits before any work
					if (tierContext && !tierContext.hasCredits && !tierContext.hasSubscription) {
						sendDataEvent('status', { type: 'credits-exhausted' });
						writer.write({
							type: 'error',
							error: 'Insufficient credit balance. Please top up to continue.'
						} as any);
						return;
					}
					let userMsgId: string | undefined;
					if (chatId && !isToolResultResend) {
						try {
							const now = new Date().toISOString();
							const msgId = generateDbId();
							await db.insert(chatMessages).values({
								id: msgId,
								chat: chatId,
								role: 'user',
								message: effectiveMessage.trim(),
								meta: attachedFiles.length > 0 ? { attachments: attachedFiles } : undefined,
								created: now,
								updated: now
							});
							userMsgId = msgId;
							sendDataEvent('user_message_saved', { userMessageId: msgId });
						} catch (err) {
							const log = createLogger('ChatAgent');
							log.error('user_message_save_failed', { chatId, ...formatError(err) });
						}
					}

					try {
						// PHASE 0: Load flow configuration
						const flowConfig = await this.getFlowConfig(agentType);
						if (!flowConfig) {
							throw new ConfigError(`Agent "${agentType}" has no flow configuration`, {
								code: 'NO_FLOW_CONFIG',
								configKey: agentType
							});
						}

						const contextConfig =
							flowConfig.global_config?.context_management ?? DEFAULT_CONTEXT_CONFIG;

						// PHASE 1: Build conversation history
						let conversationHistory: Message[] = [];
						let managedContext: ManagedContext | null = null;
						const effectiveChatId = chatId || currentSessionId;

						if (isToolResultResend && chatId) {
							// Tool result resend: load existing history from PB, then append
							// proper tool call + tool result messages so the LLM sees the full
							// tool invocation cycle and can continue naturally.
							conversationHistory = await this.loadOrCacheConversation(
								chatId,
								'', // No new user message text
								[]
							);
							// Remove the trailing empty user message that loadOrCacheConversation adds
							if (
								conversationHistory.length > 0 &&
								conversationHistory[conversationHistory.length - 1].role === 'user' &&
								!conversationHistory[conversationHistory.length - 1].content.trim()
							) {
								conversationHistory.pop();
							}

							// The last assistant message only has text (no tool call info).
							// Replace it with a full message that includes both text and tool calls.
							const lastAssistantIdx = conversationHistory.findLastIndex(
								(m) => m.role === 'assistant'
							);

							// Only include HIL tools (no execute) in the reconstructed conversation.
							// Auto-executed tools (display_chart, display_table) were already resolved
							// within the previous streamText multi-step execution. Including them here
							// creates duplicate functionCall/functionResponse pairs in the conversation.
							const hilToolNames = ['ask_confirmation', 'request_input'];
							const hilToolResults = toolResults!.filter((tr) =>
								hilToolNames.includes(tr.toolName)
							);

							const buildToolCalls = () =>
								hilToolResults.map((tr) => ({
									toolCallId: tr.toolCallId,
									toolName: tr.toolName,
									args: tr.args ?? {},
									providerMetadata: tr.providerMetadata
								}));

							// Only reconstruct the assistant+tool message pair when we actually
							// have HIL tool results. If all tool results were auto-executed
							// (display_chart etc.), skip — the flow executor will continue from
							// the existing conversation history without stale empty messages.
							if (hilToolResults.length > 0) {
								if (lastAssistantIdx >= 0) {
									conversationHistory[lastAssistantIdx] = {
										role: 'assistant',
										content: assistantText ?? conversationHistory[lastAssistantIdx].content,
										toolCalls: buildToolCalls()
									};
								} else {
									// No assistant message found — add one with tool calls
									conversationHistory.push({
										role: 'assistant',
										content: assistantText ?? '',
										toolCalls: buildToolCalls()
									});
								}
								// Add tool result message (HIL tools only)
								conversationHistory.push({
									role: 'tool',
									content: '',
									toolResults: hilToolResults.map((tr) => ({
										toolCallId: tr.toolCallId,
										toolName: tr.toolName,
										result: tr.output
									}))
								});
							}

							// Apply context management to tool resend path too (hard ceiling).
							// The trailing assistant+tool messages are preserved since they're
							// the most recent and sliding window keeps the tail.
							if (conversationHistory.length > 1) {
								const result = await this.applyContextManagement({
									db,
									chatId,
									userId,
									conversationHistory,
									contextConfig,
									flowConfig,
									costTracker,
									debug,
									path: 'tool_resend'
								});
								conversationHistory = result.conversationHistory;
								managedContext = result.managedContext;
							}
						} else if (chatId) {
							conversationHistory = await this.loadOrCacheConversation(
								chatId,
								effectiveMessage,
								attachedFiles
							);

							// Always build managed context — enforces hard ceiling even when
							// context management is disabled, and applies sliding window / hybrid
							// strategy when enabled. The returned recentMessages REPLACE the
							// full history for the executor.
							if (conversationHistory.length > 1) {
								sendDataEvent('status', { phase: 'restoring_context' });
								const result = await this.applyContextManagement({
									db,
									chatId,
									userId,
									conversationHistory,
									contextConfig,
									flowConfig,
									costTracker,
									debug,
									path: 'normal',
									emitSummaryDebug: true
								});
								conversationHistory = result.conversationHistory;
								managedContext = result.managedContext;
							}
						} else {
							conversationHistory = [
								{
									role: 'user',
									content: effectiveMessage,
									attachments:
										attachedFiles.length > 0
											? attachedFiles.map((f) => ({
													id: f.id,
													name: f.name,
													type: f.type,
													size: f.size
												}))
											: undefined
								}
							];
						}

						// PHASE 2: Build RAG context
						sendDataEvent('status', { phase: 'building_context' });
						const contextTimer = debug.startTimer();

						await debug.log('context_start', {
							query: message?.substring(0, 500) || effectiveMessage.substring(0, 500),
							conversationLength: conversationHistory.length,
							hasAttachments: attachedFiles.length > 0,
							isToolResultResend
						});

						const ragConfig = await this.getRAGConfig(agentType, ragOverrides);
						const agentKnowledgeFileIds = this.getKnowledgeFileIds(flowConfig);

						// Only run RAG search if rag_enabled is true (default: true for backward compat)
						const ragEnabled = flowConfig.global_config?.rag_enabled !== false;
						const ragService = ragEnabled
							? await createRAGService(db, this.env, userId, ragConfig, costTracker, {
									chatId,
									attachedFileIds,
									agentKnowledgeFileIds
								})
							: null;

						const context = ragService
							? await this.buildOrGetCachedContext(
									effectiveChatId,
									attachedFileIds,
									ragService,
									isToolResultResend ? assistantText || '' : message || ''
								)
							: null;

						await debug.log('context_complete', {
							durationMs: contextTimer(),
							factsCount: context?.userContext?.facts?.length || 0,
							attachedFilesCount: context?.attachedFileSummaries.length || 0,
							docsCount: context?.relevantDocs.length || 0,
							knowledgeCount: context?.relevantKnowledge.length || 0
						});

						sendDataEvent('context', {
							factsCount: context?.userContext?.facts?.length || 0,
							attachedFilesCount: context?.attachedFileSummaries.length || 0,
							docsCount: context?.relevantDocs.length || 0,
							knowledgeCount: context?.relevantKnowledge.length || 0
						});

						// PHASE 3: Generate streaming response
						sendDataEvent('status', { phase: 'generating' });

						const userConfig = await loadUserConfig(db, userId);
						agentRecordId = await this.getAgentRecordId(agentType);

						// Resolve model preference + system default for the priority chain
						const userModelPreferenceId = (
							userConfig.preferences?.model_preference as ModelPreference | undefined
						)?.model_id;

						let systemDefaultModel: ResolvedModel | undefined;
						try {
							systemDefaultModel = await getSystemDefaultModel(db);
						} catch (err) {
							createLogger('ChatAgent').debug('system_default_model_unavailable', {
								...formatError(err)
							});
						}

						let ragContextString = '';
						if (managedContext) {
							ragContextString += formatManagedContextForPrompt(managedContext);
						}
						if (context) {
							ragContextString += this.formatRAGContext(context);
						}
						ragContextString += `\n${await this.getInstructions(db)}\n`;

						// Load user profile via shared context builder
						const profilerSchema = await this.getProfilerSchema(userId);
						let profileMarkdown = '';
						let currentProfileNodes: GraphNode[] = [];
						try {
							const graph = new MemoryGraphService(db, userId);
							const profileResult = await buildProfileContext(graph, profilerSchema);
							profileMarkdown = profileResult.profileMarkdown;
							currentProfileNodes = profileResult.profileNodes;
						} catch (err) {
							createLogger('ChatAgent').warn('profile_load_failed', {
								userId,
								...formatError(err)
							});
						}

						const resolvedAttributes = await this.resolveAttributesForPrompt(
							db,
							userId,
							cfHeaders,
							(context?.userContext?.facts ?? []) as GraphNode[],
							currentProfileNodes
						);

						const executor = await createFlowExecutor({
							db,
							env: this.env,
							flow: flowConfig,
							userConfig,
							costTracker,
							ragService: ragService ?? undefined,
							modelOverrideId,
							userModelPreferenceId,
							systemDefaultModel,
							tierContext,
							context: {
								userId,
								chatId,
								agentId: agentType,
								agentRecordId,
								sessionId: currentSessionId,
								userMessage: isToolResultResend ? '' : message || '',
								conversationHistory,
								attachedFiles,
								cfHeaders,
								resolvedAttributes,
								variables: {
									rag_context: ragContextString,
									// Profile markdown for static prefix injection (flow-executor)
									profile_markdown: profileMarkdown,
									// Cold start directive data (used by flow-executor)
									...(profilerSchema && {
										profiler_schema: profilerSchema.map((s) => ({
											section_id: s.section_id,
											label: s.label,
											fields: s.fields.map((f) => ({ key: f.key, label: f.label }))
										})),
										current_profile: currentProfileNodes.map((n) => ({
											id: n.id,
											data: { fields: (n.data as any)?.fields ?? {} }
										}))
									})
								}
							},
							// Pass the AI SDK writer for native streaming
							writer: writer as unknown as UIStreamWriter
						});

						const llmTimer = debug.startTimer();

						// Log chat state and LLM call start for debugging
						await debug.log('chat_state', {
							messageCount: conversationHistory.length,
							messages: conversationHistory.slice(-5).map((m) => ({
								role: m.role,
								contentPreview:
									typeof m.content === 'string'
										? m.content.substring(0, 200)
										: '[structured content]'
							})),
							ragContextLength: ragContextString.length
						});

						await debug.log('llm_call_start', {
							agentType
						});

						const flowResult = await executor.execute();

						await debug.log('llm_call_complete', {
							durationMs: llmTimer(),
							inputTokens: flowResult.totalTokens.input,
							outputTokens: flowResult.totalTokens.output,
							costUsd: flowResult.totalCost.usd
						});

						await debug.log('full_response', {
							responseLength: flowResult.response?.length || 0,
							responsePreview: flowResult.response?.substring(0, 500),
							hasToolCalls:
								flowResult.parts?.some((p: any) => p.type?.startsWith('tool-')) || false,
							partsCount: flowResult.parts?.length || 0,
							model: flowResult.debug?.modelId
						});

						// Save debug log for admin visibility
						if (chatId && flowResult.debug) {
							await this.saveDebugLog(
								db,
								chatId,
								userId,
								agentRecordId,
								message,
								flowResult,
								context,
								conversationHistory.length,
								sendDataEvent
							);
						}

						// PHASE 4: Post-processing
						// Skip non-essential post-processing when flow failed (error already emitted)
						if (flowResult.success === false) {
							// Still record any costs incurred before the error
							await recordCostEventsToLedger(db, costTracker, {
								userId,
								messageId: currentSessionId,
								agentId: agentRecordId,
								chatId
							});
							const costSummary = costTracker.getSummary();
							sendDataEvent('done', {
								sessionId: currentSessionId,
								cost: costSummary,
								userMessageId: userMsgId,
								assistantMessageId: undefined
							});
							return;
						}

						sendDataEvent('status', { phase: 'post_processing' });

						await this.trackPendingMessage(
							effectiveChatId,
							message,
							flowResult.response,
							userId,
							agentType,
							currentSessionId
						);

						if (chatId) {
							await this.maybeGenerateTitle(
								db,
								chatId,
								message,
								flowResult.response,
								costTracker,
								debug,
								sendDataEvent
							);
						}

						await recordCostEventsToLedger(db, costTracker, {
							userId,
							messageId: currentSessionId,
							agentId: agentRecordId,
							chatId
						});

						const costSummary = costTracker.getSummary();

						// Log cost event for real-time debug display
						await debug.log('cost_event', {
							inputTokens: costSummary.totalInputTokens,
							outputTokens: costSummary.totalOutputTokens,
							totalTokens: costSummary.totalInputTokens + costSummary.totalOutputTokens,
							costUsd: costSummary.totalCostUsd,
							credits: costSummary.totalCredits
						});

						// PHASE 5: Persist assistant message
						const assistantMessageId = chatId
							? await this.persistAssistantMessage({
									db,
									chatId,
									userMsgId,
									flowResult,
									costSummary,
									isToolResultResend: !!isToolResultResend,
									toolResults
								})
							: undefined;

						sendDataEvent('done', {
							sessionId: currentSessionId,
							cost: costSummary,
							userMessageId: userMsgId,
							assistantMessageId
						});
					} catch (error) {
						const log = createLogger('ChatAgent');
						const classified = classifyProviderError(error);
						log.error('stream_error', {
							category: classified.category,
							...formatError(error)
						});
						// Write user-friendly error to the stream
						writer.write({
							type: 'error',
							errorText: classified.userMessage
						} as any);

						// Record any cost events accumulated before the error
						// (RAG embeddings, summarization, etc. still cost money)
						try {
							if (costTracker.events.length > 0) {
								await recordCostEventsToLedger(db, costTracker, {
									userId,
									messageId: currentSessionId,
									agentId: agentRecordId,
									chatId
								});
							}
						} catch (costErr) {
							log.error('cost_recording_on_error_failed', { ...formatError(costErr) });
						}
					} finally {
						disposeKeepAlive();
						this.clearRequestContext();
						resolveCurrentRequest!();
						// Clean up queue entry if no newer request replaced it
						if (this.chatRequestQueues.get(queueKey) === currentRequestPromise) {
							this.chatRequestQueues.delete(queueKey);
						}
					}
				},
				onError: (error) => {
					const log = createLogger('ChatAgent');
					const classified = classifyProviderError(error);
					log.error('stream_error', {
						category: classified.category,
						...formatError(error)
					});
					return classified.userMessage;
				}
			})
		});
	}

	// ============================================================================
	// Helper Methods
	// ============================================================================

	/**
	 * Shared context management: builds managed context, logs stats, persists summary state.
	 * Used by both the normal chat path and the tool-resend path.
	 */
	private async applyContextManagement(opts: {
		db: Database;
		chatId: string;
		userId: string;
		conversationHistory: Message[];
		contextConfig: ContextManagementConfig;
		flowConfig: CompiledFlowConfig;
		costTracker: ReturnType<typeof createCostTracker>;
		debug: DebugLogger;
		path: string;
		emitSummaryDebug?: boolean;
	}): Promise<{ conversationHistory: Message[]; managedContext: ManagedContext }> {
		const {
			db,
			chatId,
			userId,
			contextConfig,
			flowConfig,
			costTracker,
			debug,
			path,
			emitSummaryDebug
		} = opts;
		let { conversationHistory } = opts;

		const cachedSummary = this.state.contextSummaries?.[chatId] ?? null;
		const ctxMgmtTimer = debug.startTimer();
		const managedContext = await buildManagedContext(
			{ db, env: this.env, chatId, config: contextConfig, flowConfig, costTracker },
			conversationHistory,
			cachedSummary
		);
		conversationHistory = managedContext.recentMessages;

		// Server-side log (always visible in wrangler terminal)
		const ctxLog = createLogger('ChatAgent', { chatId, userId });
		const ctxDuration = ctxMgmtTimer();
		ctxLog.info('context_management', {
			durationMs: ctxDuration,
			strategy: managedContext.stats.strategy,
			totalMessages: managedContext.stats.totalMessages,
			recentCount: managedContext.stats.recentCount,
			summarizedCount: managedContext.stats.summarizedCount,
			wasSummarized: managedContext.wasSummarized,
			hardCeilingApplied: managedContext.hardCeilingApplied,
			hasCachedSummary: !!cachedSummary,
			path
		});
		if (managedContext.wasSummarized) {
			ctxLog.info('summary_status', {
				action: 'generated',
				summarizedMessageCount: managedContext.summaryState?.summarizedMessageCount,
				summaryLength: managedContext.summary?.length ?? 0,
				modelId: contextConfig.summarization?.model_id
			});
		} else if (cachedSummary) {
			ctxLog.info('summary_status', {
				action: 'cached',
				summarizedMessageCount: cachedSummary.summarizedMessageCount,
				lastSummarizedAt: cachedSummary.lastSummarizedAt
			});
		} else {
			ctxLog.info('summary_status', { action: 'none' });
		}

		// SSE debug event (only in dev mode)
		await debug.log('context_management', {
			durationMs: ctxDuration,
			strategy: managedContext.stats.strategy,
			totalMessages: managedContext.stats.totalMessages,
			recentCount: managedContext.stats.recentCount,
			summarizedCount: managedContext.stats.summarizedCount,
			wasSummarized: managedContext.wasSummarized,
			hardCeilingApplied: managedContext.hardCeilingApplied,
			hasCachedSummary: !!cachedSummary,
			summaryPreview: managedContext.summary?.substring(0, 200) ?? null,
			path
		});

		// Emit detailed summary debug events (normal chat path only)
		if (emitSummaryDebug) {
			if (managedContext.wasSummarized) {
				await debug.log('summary_generated', {
					summarizedMessageCount: managedContext.summaryState?.summarizedMessageCount,
					summaryLength: managedContext.summary?.length ?? 0,
					modelId: contextConfig.summarization?.model_id,
					promptKey: contextConfig.summarization?.prompt_key
				});
			} else if (cachedSummary) {
				await debug.log('summary_cached', {
					summarizedMessageCount: cachedSummary.summarizedMessageCount,
					lastSummarizedAt: cachedSummary.lastSummarizedAt
				});
			}
		}

		// Save updated summary state to DO memory
		if (managedContext.summaryState) {
			this.setState({
				...this.state,
				contextSummaries: {
					...(this.state.contextSummaries || {}),
					[chatId]: managedContext.summaryState
				}
			});
		}

		return { conversationHistory, managedContext };
	}

	private getAgentType(): string {
		try {
			return this.name.split('_')[0] || 'general';
		} catch {
			return this.state?.instanceName?.split('_')[0] || 'general';
		}
	}

	/**
	 * Cloudflare issue #2240 workaround.
	 *
	 * When the DO is invoked via native RPC (not routeAgentRequest), partyserver's
	 * `_initAndFetch` is never called, so `this.name` (a getter backed by a private
	 * `#_name` field) is never hydrated and throws on access.
	 *
	 * `setName()` is partyserver's public API that:
	 *  1. Sets the in-memory `#_name` so `this.name` works immediately
	 *  2. Persists `__ps_name` to DO storage for future cold starts (alarm path)
	 *  3. Calls `#ensureInitialized()` → `onStart()` if not yet started
	 *
	 * Must be called at the top of every RPC-accessible method before any code
	 * that reads `this.name`.
	 */
	private async ensureNamePersisted(chatId: string): Promise<void> {
		if (this.state.instanceName === chatId) return;
		try {
			await this.setName(chatId);
		} catch {
			// setName throws if already set to a different value; safe to ignore
			// since the DO identity is derived from chatId anyway.
		}
		this.setState({ ...this.state, instanceName: chatId });
	}

	private async getDatabase(): Promise<Database> {
		if (this.dbInstance) return this.dbInstance;
		this.dbInstance = await getDb(this.env);
		return this.dbInstance;
	}

	/**
	 * Persist assistant message and update HIL tool parts on previous message.
	 * Returns the new assistant message ID if created.
	 */
	private async persistAssistantMessage(opts: {
		db: Database;
		chatId: string;
		userMsgId?: string;
		flowResult: {
			response: string;
			parts?: Array<Record<string, unknown>>;
			debug?: { modelId?: string };
			duration_ms?: number;
		};
		costSummary: {
			totalInputTokens: number;
			totalOutputTokens: number;
			totalCostUsd: number;
			totalCredits: number;
		};
		isToolResultResend: boolean;
		toolResults?: ChatRequest['toolResults'];
	}): Promise<string | undefined> {
		const { db, chatId, userMsgId, flowResult, costSummary, isToolResultResend, toolResults } =
			opts;
		let assistantMessageId: string | undefined;

		// Save assistant response (text or HIL-only parts)
		if (flowResult.response || flowResult.parts?.length) {
			try {
				const now = new Date().toISOString();
				const msgId = generateDbId();
				await db.insert(chatMessages).values({
					id: msgId,
					chat: chatId,
					role: 'assistant',
					message: flowResult.response,
					meta: {
						...(userMsgId && { user_message_id: userMsgId }),
						tokens: {
							input: costSummary.totalInputTokens,
							output: costSummary.totalOutputTokens
						},
						cost_usd: costSummary.totalCostUsd,
						credits: costSummary.totalCredits,
						model: flowResult.debug?.modelId,
						latency_ms: flowResult.duration_ms,
						...(flowResult.parts?.length && { parts: flowResult.parts })
					},
					created: now,
					updated: now
				});
				assistantMessageId = msgId;
			} catch (err) {
				const log = createLogger('ChatAgent');
				log.error('assistant_message_save_failed', { chatId, ...formatError(err) });
			}
		}

		// For tool result resends, update previous assistant message's HIL parts
		if (isToolResultResend && toolResults && toolResults.length > 0) {
			try {
				const prevRows = await db
					.select()
					.from(chatMessages)
					.where(and(eq(chatMessages.chat, chatId), eq(chatMessages.role, 'assistant')))
					.orderBy(desc(chatMessages.created))
					.limit(2);

				let prevMsg = prevRows[0];
				if (assistantMessageId && prevMsg?.id === assistantMessageId) {
					prevMsg = prevRows[1];
				}

				if (prevMsg) {
					const meta = (prevMsg.meta as Record<string, unknown>) || {};
					const parts = (meta.parts as Array<Record<string, unknown>>) || [];

					if (parts.length > 0) {
						const toolResultMap = new Map(toolResults.map((tr) => [tr.toolCallId, tr]));
						const updatedParts = parts.map((p) => {
							const toolCallId = p.toolCallId as string;
							if (
								toolCallId &&
								toolResultMap.has(toolCallId) &&
								(p.state === 'input-available' || !p.state)
							) {
								const tr = toolResultMap.get(toolCallId)!;
								return { ...p, state: 'output-available', output: tr.output };
							}
							return p;
						});
						await db
							.update(chatMessages)
							.set({ meta: { ...meta, parts: updatedParts }, updated: new Date().toISOString() })
							.where(eq(chatMessages.id, prevMsg.id));
					}
				}
			} catch (err) {
				const log = createLogger('ChatAgent');
				log.error('hil_parts_update_failed', { chatId, ...formatError(err) });
			}
		}

		return assistantMessageId;
	}

	private async getFlowConfig(agentId: string): Promise<CompiledFlowConfig | null> {
		if (this.flowConfig) return this.flowConfig;

		const db = await this.getDatabase();
		const log = createLogger('ChatAgent', { agentId });

		try {
			const agent = await db.query.aiAgents.findFirst({
				where: eq(aiAgents.id, agentId)
			});
			if (!agent || !agent.currentFlow || agent.status === 'inactive') return null;

			// Fetch the flow record
			const flow = await db.query.aiAgentFlows
				.findFirst({
					where: eq(aiAgentFlows.id, agent.currentFlow)
				})
				.then((r) => r ?? null);

			// Cache the agent record with expanded relations
			this.cachedAgentRecord = {
				...agent,
				currentFlowRecord: flow
			};

			const compiledConfig = flow?.compiledConfig as CompiledFlowConfig | undefined;

			if (compiledConfig) {
				// Lightweight runtime validation
				const validationIssues = this.validateCompiledConfig(compiledConfig);
				if (validationIssues.length > 0) {
					log.warn('flow_config_validation_issues', { issues: validationIssues });
				}

				this.flowConfig = compiledConfig;
				return this.flowConfig;
			}

			return null;
		} catch (error) {
			log.error('flow_config_load_failed', { ...formatError(error) });
			return null;
		}
	}

	/**
	 * Lightweight runtime validation for compiled flow config
	 * Catches corrupt data or direct API manipulation
	 */
	private validateCompiledConfig(config: CompiledFlowConfig): string[] {
		const issues: string[] = [];

		// Check version
		if (config.version !== '2.0') {
			issues.push(`Unexpected config version: ${config.version}`);
		}

		// Check start node exists
		if (!config.start_node_id) {
			issues.push('Missing start_node_id');
		} else if (!config.nodes[config.start_node_id]) {
			issues.push(`Start node ${config.start_node_id} not found in nodes`);
		}

		// Check all node references are valid
		const nodeIds = new Set(Object.keys(config.nodes));
		for (const [nodeId, node] of Object.entries(config.nodes)) {
			// Check next node references
			for (const nextId of node.next) {
				if (!nodeIds.has(nextId)) {
					issues.push(`Node ${nodeId} references non-existent node ${nextId}`);
				}
			}

			// Check next_mapping references (for classifiers)
			if (node.next_mapping) {
				for (const [category, targetId] of Object.entries(node.next_mapping)) {
					if (!nodeIds.has(targetId)) {
						issues.push(
							`Node ${nodeId} classifier mapping ${category} references non-existent node ${targetId}`
						);
					}
				}
			}

			// Check fallback_node_id if present
			if (node.fallback_node_id && !nodeIds.has(node.fallback_node_id)) {
				issues.push(
					`Node ${nodeId} fallback references non-existent node ${node.fallback_node_id}`
				);
			}
		}

		// Check at least one end node exists
		const hasEndNode = Object.values(config.nodes).some((n) => n.type === 'end');
		if (!hasEndNode) {
			issues.push('No end node found in compiled config');
		}

		// Warn about unresolved model references (stale data)
		for (const node of Object.values(config.nodes)) {
			if (node.type === 'llm' || node.type === 'classifier') {
				const modelId = (node.config as { model_id?: string }).model_id;
				if (modelId && !config.resolved.models[modelId]) {
					issues.push(`Node ${node.id} references unresolved model ${modelId}`);
				}
			}
			if (node.type === 'llm') {
				const tools = (node.config as { tools?: string[] }).tools;
				if (tools) {
					for (const toolId of tools) {
						if (!config.resolved.tools[toolId]) {
							issues.push(`Node ${node.id} references unresolved tool ${toolId}`);
						}
					}
				}
			}
		}

		return issues;
	}

	private async getRAGConfig(agentId: string, overrides?: Partial<RAGConfig>): Promise<RAGConfig> {
		if (this.ragConfig && !overrides) return this.ragConfig;

		if (!this.cachedAgentRecord) {
			await this.getFlowConfig(agentId);
		}

		// Note: no per-agent RAG overrides stored in DB yet; uses defaults + caller overrides
		const ragConfig = { ...DEFAULT_RAG_CONFIG, ...overrides };
		this.ragConfig = ragConfig;

		return ragConfig;
	}

	private async getAgentRecordId(agentName: string): Promise<string | undefined> {
		if (this.cachedAgentRecord?.id) return this.cachedAgentRecord.id;
		await this.getFlowConfig(agentName);
		return this.cachedAgentRecord?.id;
	}

	private async getProfilerSchema(
		userId: string
	): Promise<import('../types/profiler').ProfileSchemaSection[] | undefined> {
		const db = await this.getDatabase();
		const plan = await resolveProfilerPlanForUser(db, userId);
		const visibleSchema = plan.visibleSchema;
		return visibleSchema.length > 0 ? visibleSchema : undefined;
	}

	private getKnowledgeFileIds(flowConfig: CompiledFlowConfig): string[] | undefined {
		if (!flowConfig.start_node_id) return undefined;
		const startNode = flowConfig.nodes[flowConfig.start_node_id];
		const startData = startNode?.config as StartNodeData;
		return startData?.knowledge_base && startData.knowledge_base.length > 0
			? startData.knowledge_base
			: undefined;
	}

	private async getInstructions(db: Database): Promise<string> {
		try {
			const template = await getPromptWithFallback(db, 'agent_instructions', {});
			if (template?.trim()) return template;
		} catch (err) {
			createLogger('ChatAgent').warn('get_instructions_failed', { ...formatError(err) });
		}

		return `## Instructions:
1. Use the context above to provide personalized, informed responses.
2. If you reference specific numbers or facts, cite where they came from.
3. Be proactive - if you see connections between different pieces of information, mention them.
4. If you need more specific information, ask the user.`;
	}

	private async loadOrCacheConversation(
		chatId: string,
		currentMessage: string,
		attachedFiles: AttachedFile[]
	): Promise<Message[]> {
		const currentCache = this.state.conversationCache || {};

		if (currentCache[chatId]) {
			const history = [...currentCache[chatId]];
			const userMsg: Message = {
				role: 'user',
				content: currentMessage,
				attachments:
					attachedFiles.length > 0
						? attachedFiles.map((f) => ({ id: f.id, name: f.name, type: f.type, size: f.size }))
						: undefined
			};
			history.push(userMsg);

			this.setState({
				...this.state,
				conversationCache: { ...currentCache, [chatId]: [...history] }
			});

			return history;
		}

		// Fetch from DB (bounded to last 200 messages)
		const db = await this.getDatabase();
		try {
			const rows = await db
				.select({ role: chatMessages.role, message: chatMessages.message, meta: chatMessages.meta })
				.from(chatMessages)
				.where(eq(chatMessages.chat, chatId))
				.orderBy(desc(chatMessages.created))
				.limit(200);

			const history: Message[] = rows.reverse().map((m) => ({
				role: (m.role ?? 'user') as 'user' | 'assistant' | 'system',
				content: m.message || '',
				attachments: this.extractAttachments(m.meta)
			}));

			// Load existing summary from DB on cache miss (session resume).
			// This seeds the in-memory contextSummaries so we don't lose
			// summary state between sessions.
			const currentSummaries = { ...(this.state.contextSummaries || {}) };
			if (!currentSummaries[chatId]) {
				const chatMeta = await getChatMeta(db, chatId);
				if (chatMeta?.summary) {
					currentSummaries[chatId] = {
						summary: chatMeta.summary,
						summarizedMessageCount: chatMeta.summaryMessageCount ?? 0,
						lastSummarizedAt: chatMeta.lastSummarizedAt ?? new Date().toISOString()
					};
				}
			}

			this.setState({
				...this.state,
				conversationCache: { ...currentCache, [chatId]: [...history] },
				contextSummaries: currentSummaries
			});

			return history;
		} catch (err) {
			createLogger('ChatAgent').warn('load_conversation_failed', { ...formatError(err) });
			const userMsg: Message = {
				role: 'user',
				content: currentMessage,
				attachments:
					attachedFiles.length > 0
						? attachedFiles.map((f) => ({ id: f.id, name: f.name, type: f.type, size: f.size }))
						: undefined
			};
			this.setState({
				...this.state,
				conversationCache: { ...currentCache, [chatId]: [userMsg] }
			});
			return [userMsg];
		}
	}

	private extractAttachments(meta: unknown): MessageAttachment[] | undefined {
		if (!meta || typeof meta !== 'object') return undefined;
		const m = meta as Record<string, unknown>;
		if (Array.isArray(m.attachments) && m.attachments.length > 0) {
			return m.attachments.map((a: Record<string, unknown>) => ({
				id: String(a.id),
				name: String(a.name),
				type: String(a.type),
				size: Number(a.size)
			}));
		}
		return undefined;
	}

	private async buildOrGetCachedContext(
		chatId: string,
		attachedFileIds: string[],
		ragService: RAGService,
		message: string
	): Promise<BuiltContext> {
		const currentCache = this.state.initialContextCache || {};
		const currentFileIds = this.state.lastAttachedFileIds || {};

		const cachedContext = currentCache[chatId];
		const previousFileIds = currentFileIds[chatId] || [];
		const hasNewFiles = attachedFileIds.some((id) => !previousFileIds.includes(id));

		if (cachedContext && !hasNewFiles) {
			return cachedContext;
		}

		// Build full context with query-relevant loading
		const context = await ragService.buildContext(message, { query: message });

		this.setState({
			...this.state,
			initialContextCache: { ...currentCache, [chatId]: context },
			lastAttachedFileIds: { ...currentFileIds, [chatId]: attachedFileIds }
		});

		return context;
	}

	private formatRAGContext(context: BuiltContext): string {
		let formatted = '';

		if (context.attachedFileSummaries.length) {
			formatted += `## Files Attached to This Chat:\n`;
			for (const file of context.attachedFileSummaries) {
				formatted += `### 📄 ${file.fileName}\n${file.summary}\n\n`;
			}
		}

		if (context.relevantDocs.length) {
			formatted += `## Relevant Document Excerpts:\n`;
			for (const doc of context.relevantDocs) {
				const relevance = doc.normalizedScore
					? ` (relevance: ${(doc.normalizedScore * 100).toFixed(0)}%)`
					: '';
				formatted += `[${doc.context || 'Document'}]${relevance}\n${doc.text}\n---\n`;
			}
			formatted += '\n';
		}

		if (context.relevantKnowledge.length) {
			formatted += `## Related Knowledge:\n`;
			for (const k of context.relevantKnowledge) {
				const relevance = k.normalizedScore
					? ` (relevance: ${(k.normalizedScore * 100).toFixed(0)}%)`
					: '';
				formatted += `[${k.context || 'Knowledge'}]${relevance} ${k.text}\n`;
			}
			formatted += '\n';
		}

		return formatted;
	}

	private async resolveAttributesForPrompt(
		db: Database,
		userId: string,
		cfHeaders: Record<string, string>,
		userFacts: GraphNode[],
		profileNodes: GraphNode[] = []
	): Promise<Record<string, string>> {
		try {
			const { attributes, definitions } = await resolveAllAttributes(
				db,
				userId,
				cfHeaders,
				userFacts,
				profileNodes
			);
			return await filterAttributesForUsage(db, attributes, 'prompt_injection', definitions);
		} catch (e) {
			const log = createLogger('ChatAgent', { userId });
			log.warn('attribute_resolve_failed', { ...formatError(e) });
			return {};
		}
	}

	private async saveDebugLog(
		db: Database,
		chatId: string,
		userId: string,
		agentRecordId: string | undefined,
		message: string,
		flowResult: {
			response: string;
			totalTokens: { input: number; output: number };
			totalCost: { usd: number };
			duration_ms: number;
			debug?: {
				systemPrompt?: string;
				messagesArray?: unknown[];
				modelId?: string;
				provider?: string;
			};
		},
		context: BuiltContext | null,
		sequenceNumber: number,
		sendDataEvent: (eventType: string, data: unknown) => void
	): Promise<void> {
		try {
			const now = new Date().toISOString();
			const debugId = generateDbId();
			await db.insert(chatMessagesDebug).values({
				id: debugId,
				chat: chatId,
				user: userId,
				agent: agentRecordId,
				role: 'assistant',
				userMessage: message,
				systemPrompt: flowResult.debug?.systemPrompt,
				fullMessagesJson: flowResult.debug?.messagesArray,
				assistantResponse: flowResult.response,
				modelId: flowResult.debug?.modelId || 'unknown',
				provider: flowResult.debug?.provider || 'unknown',
				inputTokens: String(flowResult.totalTokens.input),
				outputTokens: String(flowResult.totalTokens.output),
				costUsd: String(flowResult.totalCost.usd),
				latencyMs: String(flowResult.duration_ms),
				contextData: {
					factsCount: context?.userContext?.facts?.length || 0,
					attachedFilesCount: context?.attachedFileSummaries.length || 0,
					docsCount: context?.relevantDocs.length || 0,
					knowledgeCount: context?.relevantKnowledge.length || 0
				},
				sequenceNumber: String(sequenceNumber),
				created: now,
				updated: now
			});

			sendDataEvent('debug_message', {
				id: debugId,
				chatId,
				userId,
				agentId: agentRecordId,
				role: 'assistant',
				userMessage: message,
				systemPrompt: flowResult.debug?.systemPrompt,
				assistantResponse: flowResult.response,
				modelId: flowResult.debug?.modelId || 'unknown',
				provider: flowResult.debug?.provider || 'unknown',
				inputTokens: flowResult.totalTokens.input,
				outputTokens: flowResult.totalTokens.output,
				costUsd: flowResult.totalCost.usd,
				latencyMs: flowResult.duration_ms,
				created: now
			});
		} catch (err) {
			const log = createLogger('ChatAgent');
			log.error('debug_log_save_failed', { ...formatError(err) });
		}
	}

	private async trackPendingMessage(
		chatId: string,
		userMessage: string,
		assistantResponse: string,
		userId: string,
		agentId: string,
		sessionId: string
	): Promise<void> {
		const currentPending = { ...(this.state.pendingMessages || {}) };
		const currentActivity = { ...(this.state.lastActivity || {}) };
		const currentConvCache = { ...(this.state.conversationCache || {}) };

		if (!currentPending[chatId]) {
			currentPending[chatId] = [];
		}

		currentPending[chatId].push({ userMessage, assistantResponse });
		currentActivity[chatId] = Date.now();

		// Update conversation cache with assistant response
		if (currentConvCache[chatId]) {
			currentConvCache[chatId] = [
				...currentConvCache[chatId],
				{ role: 'assistant' as const, content: assistantResponse }
			];
		}

		this.setState({
			...this.state,
			pendingMessages: currentPending,
			lastActivity: currentActivity,
			conversationCache: currentConvCache
		});

		// Check if extraction threshold reached
		if (currentPending[chatId].length >= EXTRACTION_MESSAGE_THRESHOLD) {
			const db = await this.getDatabase();
			const extractionService = createExtractionService({
				env: this.env,
				db,
				userId,
				sessionId,
				agentId
			});

			const messagesToExtract = [...currentPending[chatId]];
			currentPending[chatId] = [];

			this.setState({ ...this.state, pendingMessages: currentPending });
			const log = createLogger('ChatAgent', { chatId, userId });
			extractionService.extractFromBatch(messagesToExtract, false).catch((e) => {
				log.error('threshold_extraction_failed', { ...formatError(e) });
			});

			// Run profiler dispatcher alongside extraction (non-blocking)
			resolveUserTags(userId, db)
				.then((userTags) => {
					this.emitProfilerEvent({
						type: 'profiler-started',
						chatId,
						reason: 'threshold'
					});
					const profilerDispatcher = createProfilerDispatcher({
						env: this.env,
						db,
						userId,
						sessionId,
						agentId,
						userTags
					});
					profilerDispatcher
						.dispatch(messagesToExtract)
						.then(() => {
							this.emitProfilerEvent({
								type: 'profiler-complete',
								chatId,
								reason: 'threshold'
							});
						})
						.catch((e) => {
							log.error('threshold_profiler_failed', { ...formatError(e) });
							this.emitProfilerEvent({
								type: 'profiler-failed',
								chatId,
								reason: 'threshold',
								error: e instanceof Error ? e.message : String(e)
							});
						});
				})
				.catch((e) => {
					log.error('threshold_profiler_tags_failed', { ...formatError(e) });
					this.emitProfilerEvent({
						type: 'profiler-failed',
						chatId,
						reason: 'threshold',
						error: e instanceof Error ? e.message : String(e)
					});
				});
		}

		// Schedule/reschedule session timeout
		await this.scheduleSessionTimeout(chatId, userId, agentId, sessionId);
	}

	private async scheduleSessionTimeout(
		chatId: string,
		userId: string,
		agentId: string,
		sessionId: string
	): Promise<void> {
		try {
			await this.ensureNamePersisted(chatId);

			const existingTaskId = this.state.activeScheduleIds?.[chatId];
			if (existingTaskId) {
				await this.cancelSchedule(existingTaskId);
			}

			const schedule = await this.schedule(SESSION_TIMEOUT_SECONDS, 'onSessionTimeout', {
				chatId,
				userId,
				agentId,
				sessionId
			});

			if (schedule?.id) {
				this.setState({
					...this.state,
					activeScheduleIds: { ...(this.state.activeScheduleIds || {}), [chatId]: schedule.id }
				});
			}
		} catch (e) {
			const log = createLogger('ChatAgent', { chatId });
			log.warn('schedule_timeout_failed', { ...formatError(e) });
		}
	}

	private async maybeGenerateTitle(
		db: Database,
		chatId: string,
		userMessage: string,
		assistantResponse: string,
		costTracker: ReturnType<typeof createCostTracker>,
		debug: DebugLogger,
		sendDataEvent: (eventType: string, data: unknown) => void
	): Promise<void> {
		const needsTitle = await shouldGenerateTitle(db, chatId);
		if (!needsTitle) return;

		await debug.log('flow_step', { nodeName: 'Title Generation', nodeType: 'background_task' });

		try {
			const title = await generateChatTitle({
				db,
				env: this.env,
				chatId,
				userMessage,
				assistantResponse,
				costTracker
			});
			if (title) {
				sendDataEvent('title', { chatId, title });
			}
		} catch (e) {
			const log = createLogger('ChatAgent', { chatId });
			log.error('title_generation_failed', { ...formatError(e) });
		}
	}

	private clearRequestContext(): void {
		this.flowConfig = null;
		this.ragConfig = null;
		this.cachedAgentRecord = null;
		clearConfigCache();
		clearModelResolverCache();
		clearProfilerCache();
		clearGlobalSchemaCache();
	}

	// ============================================================================
	// RPC Methods (for direct DO calls)
	// ============================================================================

	async getContext(params: { userId: string; message?: string }): Promise<BuiltContext> {
		const { userId, message = '' } = params;
		const db = await this.getDatabase();
		const ragConfig = await this.getRAGConfig(this.getAgentType());
		const ragService = await createRAGService(db, this.env, userId, ragConfig);
		return ragService.buildContext(message);
	}

	async hybridSearch(params: { query: string; userId: string; topK?: number }): Promise<{
		documents: SearchResult[];
		knowledge: SearchResult[];
	}> {
		const { query, userId, topK = 5 } = params;
		const db = await this.getDatabase();
		const ragConfig = await this.getRAGConfig(this.getAgentType());
		const ragService = await createRAGService(db, this.env, userId, {
			...ragConfig,
			rerankTopK: topK
		});
		const [documents, knowledge] = await Promise.all([
			ragService.hybridSearchDocuments(query),
			ragService.hybridSearchKnowledge(query)
		]);
		return { documents, knowledge };
	}
}

export { QuantPMAgent as default };
