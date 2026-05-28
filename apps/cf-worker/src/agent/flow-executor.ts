/**
 * Flow Executor v2.2
 *
 * AI SDK native streaming integration:
 * - streamText/generateText from Vercel AI SDK
 * - Native Data Stream Protocol via UIMessageStreamWriter
 * - Multi-provider support via shared model-factory (OpenAI, Anthropic, Google, xAI, Cloudflare)
 * - User personality injection from user_customization
 * - User location/timezone context
 * - Dynamic attribute injection via {{placeholder}} syntax
 * - End-to-end cost tracking via shared billing utilities
 * - SDK tools support (Google Search, Code Execution, Web Search, etc.)
 */

import { streamText, generateText, smoothStream, ModelMessage, stepCountIs } from 'ai';
import { findProfileField, type ProfileSections } from '@repo/shared/utils';

import type { Database } from '@repo/db/types';
import { userCustomization } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import type {
	CompiledFlowConfig,
	CompiledNode,
	ExecutionContext,
	FlowResult,
	NodeResult,
	StreamEvent,
	StartNodeData,
	LLMNodeData,
	ClassifierNodeData,
	EndNodeData,
	FlowCostTracker,
	UIStreamWriter,
	ResolvedModel
} from '../types/flow';
import {
	createCostTracker,
	loadInfraConfigs,
	getPricingForModel,
	getCreditsPerUsd
} from '../utils/billing';
import type { Env } from '../types';
import { ToolContext, getToolsForNode } from './tools';
import { type RAGService } from '../services/rag-service';
import {
	injectAttributesIntoPrompt,
	interpolatePrompt,
	CLASSIFIER_NODE_DEFAULT,
	CLASSIFIER_NODE_SUFFIX
} from '../utils/prompts';
import { getModel } from '../utils/model-factory';
import { trackInferenceCost } from '../utils/cost-tracker';
import { resolveNodeModel, fetchDynamicModels } from '../utils/model-resolver';
import type { UserTierContext } from '../utils/tier-resolver';
import { isModelAllowed } from '../utils/tier-resolver';
import { mapProviderOptions } from '../utils/param-mapper';
import { createLogger, formatError } from '../utils/logger';
import { AppError, AIModelError, ConfigError, classifyProviderError } from '../utils/errors';

// ============================================================================
// Types
// ============================================================================

export interface UserConfig {
	personality?: string;
	timezone?: string;
	location?: string;
	locale?: string;
	preferences?: Record<string, unknown>;
}

export interface FlowExecutorOptions {
	db: Database;
	env: Env;
	flow: CompiledFlowConfig;
	context: ExecutionContext;
	userConfig?: UserConfig;
	costTracker?: FlowCostTracker;
	ragService?: RAGService;
	/** AI SDK UIMessageStreamWriter for native Data Stream Protocol streaming */
	writer?: UIStreamWriter;
	/** Per-chat model override record ID (from chats.model_override) */
	modelOverrideId?: string;
	/** Global user model preference record ID */
	userModelPreferenceId?: string;
	/** System-wide default model. Falls back to first compiled model if not provided. */
	systemDefaultModel?: ResolvedModel;
	/** Tier context for model/tool gating and credit state */
	tierContext?: UserTierContext;
}

interface ExecutionState {
	nodeResults: Map<string, NodeResult>;
	variables: Record<string, unknown>;
	costTracker: FlowCostTracker;
	aborted: boolean;
	conversationHistory: ModelMessage[];
	toolContext: ToolContext;
	/** Per-chat model override record ID */
	modelOverrideId?: string;
	/** Global user model preference record ID */
	userModelPreferenceId?: string;
	/** System default (or first compiled model as fallback) */
	systemDefaultModel?: ResolvedModel;
	/** Models fetched at runtime for override/preference not in compiled config */
	dynamicModels: Record<string, ResolvedModel>;
	/** The model actually used by the last LLM/classifier node (for debug output) */
	lastResolvedModel?: ResolvedModel;
	/** Tier context for credit gate + model validation */
	tierContext?: UserTierContext;
}

// ============================================================================
// User Config Loader
// ============================================================================

export async function loadUserConfig(db: Database, userId: string): Promise<UserConfig> {
	const config: UserConfig = {};

	try {
		// Fetch all user customization records for this user
		const records = await db
			.select({ key: userCustomization.key, value: userCustomization.value })
			.from(userCustomization)
			.where(eq(userCustomization.user, userId));

		for (const record of records) {
			const key = record.key ?? '';
			const value = record.value;

			switch (key) {
				case 'ai_agent_personality':
					config.personality =
						typeof value === 'string' ? value : formatPersonalityToMarkdown(value);
					break;
				case 'timezone':
					config.timezone = String(value);
					break;
				case 'location':
					config.location = String(value);
					break;
				case 'locale':
					config.locale = String(value);
					break;
				default:
					// Store other preferences
					if (!config.preferences) config.preferences = {};
					config.preferences[key] = value;
			}
		}
	} catch (error) {
		const log = createLogger('FlowExecutor', { userId });
		log.error('user_config_load_failed', { ...formatError(error) });
	}

	return config;
}

/** Convert personality object into readable markdown for system prompt injection */
function formatPersonalityToMarkdown(value: unknown): string {
	if (!value || typeof value !== 'object') return String(value ?? '');
	const obj = value as Record<string, unknown>;
	const lines: string[] = [];

	// Toggle preferences
	if (obj.use_emojis) lines.push('- Use emojis in responses');
	if (obj.proactive) lines.push('- Be proactive — offer insights and tips without being asked');
	if (obj.ask_clarifications === false)
		lines.push('- Do not ask follow-up clarification questions');

	// Style preferences
	const toneMap: Record<string, string> = {
		professional: 'Professional',
		friendly: 'Friendly',
		balanced: 'Balanced'
	};
	if (obj.tone && obj.tone !== 'balanced')
		lines.push(`- Tone: ${toneMap[obj.tone as string] ?? obj.tone}`);

	const lengthMap: Record<string, string> = {
		concise: 'Keep responses concise',
		detailed: 'Provide detailed, thorough responses',
		balanced: ''
	};
	const lengthText = lengthMap[obj.response_length as string];
	if (lengthText) lines.push(`- ${lengthText}`);

	const formalityMap: Record<string, string> = {
		casual: 'Use casual, conversational language',
		formal: 'Use formal, polished language',
		standard: ''
	};
	const formalityText = formalityMap[obj.formality as string];
	if (formalityText) lines.push(`- ${formalityText}`);

	const styleMap: Record<string, string> = {
		technical: 'Use technical language and precise terminology',
		simple: 'Use simple, everyday language',
		eli5: 'Explain things as simply as possible (ELI5)',
		mixed: ''
	};
	const styleText = styleMap[obj.explanation_style as string];
	if (styleText) lines.push(`- ${styleText}`);

	// Custom prompt (user-written free-text)
	const customPrompt = typeof obj.custom_prompt === 'string' ? obj.custom_prompt.trim() : '';
	if (customPrompt) lines.push(`- ${customPrompt}`);

	return lines.length > 0
		? lines.join('\n')
		: 'Default settings (balanced tone, standard formality)';
}

// ============================================================================
// Flow Executor Class
// ============================================================================

export class FlowExecutor {
	private db: Database;
	private env: Env;
	private flow: CompiledFlowConfig;
	private context: ExecutionContext;
	private userConfig: UserConfig;
	private writer?: UIStreamWriter;
	private state: ExecutionState;
	private startTime: number;
	private creditsPerUsd: number = 1000;
	private textPartCounter: number = 0;

	private log;

	constructor(options: FlowExecutorOptions) {
		this.db = options.db;
		this.env = options.env;
		this.flow = options.flow;
		this.context = options.context;
		this.userConfig = options.userConfig ?? {};
		this.writer = options.writer;
		this.startTime = Date.now();
		this.log = createLogger('FlowExecutor', {
			userId: options.context.userId,
			sessionId: options.context.sessionId
		});

		// Use provided costTracker or create new one
		const costTracker = options.costTracker ?? createCostTracker();

		// Create tool context for all tools
		// webSearchEnabled is determined by whether web_search tool is in the flow's resolved tools
		const hasWebSearchTool = Object.values(this.flow.resolved.tools).some(
			(t) => t.tool_key === 'web_search'
		);
		const toolContext: ToolContext = {
			db: this.db,
			env: this.env,
			userId: this.context.userId,
			sessionId: this.context.sessionId,
			chatId: this.context.chatId,
			agentId: this.context.agentId,
			costTracker,
			timezone: this.userConfig.timezone,
			webSearchEnabled: hasWebSearchTool,
			// RAG service for proper hybrid search in document tools
			ragService: options.ragService,
			allowedToolIds: options.tierContext?.allowedToolKeys
		};

		// Compute effective system default: explicit option > first compiled model
		const firstCompiledModel = Object.values(this.flow.resolved.models)[0];

		this.state = {
			nodeResults: new Map(),
			variables: { ...options.context.variables },
			costTracker,
			aborted: false,
			conversationHistory: [],
			toolContext,
			modelOverrideId: options.modelOverrideId,
			userModelPreferenceId: options.userModelPreferenceId,
			systemDefaultModel: options.systemDefaultModel ?? firstCompiledModel,
			dynamicModels: {},
			tierContext: options.tierContext
		};
	}

	// ============================================================================
	// Main Execution
	// ============================================================================

	async execute(): Promise<FlowResult> {
		try {
			// Load configs
			await loadInfraConfigs(this.db);
			this.creditsPerUsd = await getCreditsPerUsd(this.db);

			// Pre-fetch dynamic models for override/preference not in compiled config
			if (this.state.modelOverrideId || this.state.userModelPreferenceId) {
				this.state.dynamicModels = await fetchDynamicModels(this.db, this.flow.resolved.models, [
					this.state.modelOverrideId,
					this.state.userModelPreferenceId
				]);
			}

			// Build initial conversation history
			// Format messages with per-message attachments so LLM knows which files belong to which message
			// Also handle tool call/result messages for HIL (Human-in-the-Loop) tool round-trips
			this.state.conversationHistory = this.context.conversationHistory.flatMap(
				(msg): ModelMessage[] => {
					// Handle tool result messages (role='tool')
					if (msg.role === 'tool' && msg.toolResults && msg.toolResults.length > 0) {
						const validResults = msg.toolResults.filter((tr) => {
							if (!tr.toolCallId || !tr.toolName) {
								this.log.warn('skipping_malformed_tool_result', {
									toolCallId: tr.toolCallId,
									toolName: tr.toolName,
									hasResult: tr.result !== undefined
								});
								return false;
							}
							return true;
						});
						if (validResults.length === 0) return [];
						return [
							{
								role: 'tool' as const,
								content: validResults.map((tr) => ({
									type: 'tool-result' as const,
									toolCallId: tr.toolCallId,
									toolName: tr.toolName,
									// AI SDK v6 ToolResultPart: output is the only result field
									// (no bare `result` property — providers like OpenAI reject extra keys)
									output: { type: 'json' as const, value: tr.result ?? null }
								}))
							} as ModelMessage
						];
					}

					let textContent = msg.content;

					// If this message has attachments, prepend a note about them
					if (msg.attachments && msg.attachments.length > 0) {
						const attachmentNote = msg.attachments
							.map((a) => `📎 [Attached: ${a.name}${a.type ? ` (${a.type})` : ''}]`)
							.join('\n');
						textContent = `${attachmentNote}\n\n${msg.content}`;
					}

					// Handle assistant messages with tool calls
					if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
						const parts: Array<
							| { type: 'text'; text: string }
							| {
									type: 'tool-call';
									toolCallId: string;
									toolName: string;
									input: unknown;
									providerOptions?: Record<string, unknown>;
							  }
						> = [];
						if (textContent.trim()) {
							parts.push({ type: 'text' as const, text: textContent });
						}
						for (const tc of msg.toolCalls) {
							const part: {
								type: 'tool-call';
								toolCallId: string;
								toolName: string;
								input: unknown;
								providerOptions?: Record<string, unknown>;
							} = {
								type: 'tool-call' as const,
								toolCallId: tc.toolCallId,
								toolName: tc.toolName,
								input: tc.args // AI SDK v6 uses 'input' not 'args'
							};
							// Preserve provider-specific metadata for round-trip fidelity
							if (tc.providerMetadata) {
								part.providerOptions = tc.providerMetadata;
							}
							parts.push(part);
						}
						return [
							{
								role: 'assistant' as const,
								content: parts
							} as ModelMessage
						];
					}

					// Skip tool-role messages that have no toolResults (would produce invalid ModelMessage)
					if (msg.role === 'tool') {
						return [];
					}

					return [
						{
							role: msg.role as 'user' | 'assistant' | 'system',
							content: textContent
						}
					];
				}
			);

			// Sanitize: strip empty-content messages that providers (especially OpenAI) reject.
			// - System messages with blank content are useless.
			// - User messages with blank content cause "blank messages in array" errors.
			// - Assistant messages with blank content AND no parts (tool-call) are invalid.
			// - Tool messages are already guaranteed to have ToolContent arrays above.
			this.state.conversationHistory = this.state.conversationHistory.filter((msg) => {
				if (msg.role === 'tool') return true; // always valid — built from toolResults above
				if (typeof msg.content === 'string') return msg.content.trim().length > 0;
				if (Array.isArray(msg.content)) return msg.content.length > 0;
				return true;
			});

			// Execute from start node
			const result: NodeResult & {
				endType?: 'success' | 'error' | 'handoff';
				handoffAgentId?: string;
			} = await this.executeNode(this.flow.start_node_id);

			// Note: Cost recording is done by the agent after flow execution
			// This allows RAG costs (embeddings, reranking) to be included with LLM costs

			// Build final result
			const costSummary = this.state.costTracker.getSummary();
			const nodeResults = Array.from(this.state.nodeResults.values());

			const totalTokens = nodeResults.reduce(
				(acc, nr) => ({
					input: acc.input + (nr.tokens?.input ?? 0),
					output: acc.output + (nr.tokens?.output ?? 0)
				}),
				{ input: 0, output: 0 }
			);

			// Use the model that was actually resolved at runtime (handles dynamic model switching).
			// Falls back to the first compiled model only if no LLM node executed.
			const actualModel =
				this.state.lastResolvedModel || Object.values(this.flow.resolved?.models || {})[0];

			// Serialize conversation history to simple format for debugging
			const serializeMessages = (
				messages: ModelMessage[]
			): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> => {
				return messages.map((msg) => {
					let content: string;
					if (typeof msg.content === 'string') {
						content = msg.content;
					} else if (Array.isArray(msg.content)) {
						// Extract text from parts (TextPart, ImagePart, etc.)
						content = (msg.content as Array<{ type: string; text?: string }>)
							.filter((part: any): part is { type: 'text'; text: string } => part.type === 'text')
							.map((part: { type: 'text'; text: string }) => part.text)
							.join('\n');
					} else {
						content = JSON.stringify(msg.content);
					}
					return {
						role: msg.role as 'user' | 'assistant' | 'system',
						content
					};
				});
			};

			const flowResult: FlowResult = {
				success: result.success,
				response: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
				endType: result.endType ?? 'success',
				nodeResults,
				totalTokens,
				totalCost: {
					usd: costSummary.totalCostUsd,
					credits: costSummary.totalCredits
				},
				duration_ms: Date.now() - this.startTime,
				handoffAgentId: result.handoffAgentId,
				// UI tool parts for persistence (display_chart, display_table, etc.)
				parts: (this.state.variables['ui_parts'] as FlowResult['parts']) ?? undefined,
				// Include debug data for logging
				debug: {
					systemPrompt: (this.state.variables['system_prompt'] as string) || '',
					messagesArray: serializeMessages(this.state.conversationHistory),
					modelId: actualModel?.model_id,
					provider: actualModel?.provider_key
				}
			};

			this.emit({ type: 'done', data: flowResult });
			return flowResult;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			// Classify the error to get a user-friendly message — never expose
			// internal details (model resolver chain, node ids, etc.) to end users.
			const classified = classifyProviderError(error);
			this.log.error('flow_execution_error', {
				category: classified.category,
				raw: errorMessage
			});
			this.emit({ type: 'error', data: { message: classified.userMessage } });

			return {
				success: false,
				response: classified.userMessage,
				endType: 'error',
				nodeResults: Array.from(this.state.nodeResults.values()),
				totalTokens: { input: 0, output: 0 },
				totalCost: { usd: 0, credits: 0 },
				duration_ms: Date.now() - this.startTime
			};
		}
	}

	// ============================================================================
	// Node Router
	// ============================================================================

	private async executeNode(nodeId: string): Promise<NodeResult> {
		if (this.state.aborted) {
			throw new AppError('Flow execution aborted', { code: 'FLOW_ABORTED' });
		}

		const node = this.flow.nodes[nodeId];
		if (!node) {
			throw new ConfigError(`Node not found: ${nodeId}`, {
				code: 'NODE_NOT_FOUND',
				configKey: nodeId
			});
		}

		this.emit({
			type: 'node_start',
			data: { nodeId, nodeType: node.type, label: node.label }
		});

		const startTime = Date.now();
		let result: NodeResult;

		try {
			switch (node.type) {
				case 'start':
					result = await this.executeStartNode(node);
					break;
				case 'end':
					result = await this.executeEndNode(node);
					break;
				case 'llm':
					result = await this.executeLLMNode(node);
					break;
				case 'classifier':
					result = await this.executeClassifierNode(node);
					break;
				default:
					throw new ConfigError(`Unknown node type: ${(node as any).type}`, {
						code: 'UNKNOWN_NODE_TYPE',
						configKey: nodeId
					});
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			result = {
				nodeId,
				nodeType: node.type,
				success: false,
				error: errorMessage,
				duration_ms: Date.now() - startTime
			};

			if (node.on_error === 'fallback' && node.fallback_node_id) {
				return this.executeNode(node.fallback_node_id);
			} else if (node.on_error !== 'continue') {
				throw error;
			}
		}

		result.duration_ms = Date.now() - startTime;
		this.state.nodeResults.set(nodeId, result);
		this.emit({ type: 'node_complete', data: result });

		// Execute next nodes
		// IMPLICIT PARALLELISM: If multiple next nodes, run them all concurrently
		if (node.type !== 'end' && node.next.length > 0) {
			// Classifier routes to ONE node based on classification result
			if (node.type === 'classifier') {
				const category = result.output as string;

				// Try to find next node from next_mapping
				let nextNodeId: string | undefined;

				if (node.next_mapping && Object.keys(node.next_mapping).length > 0) {
					// First try exact match
					nextNodeId = node.next_mapping[category];

					// If no exact match, try case-insensitive match
					if (!nextNodeId) {
						const lowerCategory = category.toLowerCase();
						for (const [key, value] of Object.entries(node.next_mapping)) {
							if (key.toLowerCase() === lowerCategory) {
								nextNodeId = value;
								break;
							}
						}
					}

					// If still no match, try __default__ mapping
					if (!nextNodeId && node.next_mapping['__default__']) {
						nextNodeId = node.next_mapping['__default__'];
					}
				}

				// Final fallback to first next node
				if (!nextNodeId && node.next.length > 0) {
					nextNodeId = node.next[0];
				}

				if (!nextNodeId) {
					this.log.error('classifier_no_valid_next_node', {
						nodeId,
						category,
						next_mapping: node.next_mapping,
						next: node.next
					});
					throw new ConfigError(
						`Classifier node ${nodeId} has no valid next node for category: ${category}`,
						{ code: 'CLASSIFIER_NO_NEXT', configKey: nodeId }
					);
				}

				this.log.debug('classifier_routing', {
					nodeId,
					category,
					nextNodeId
				});

				return this.executeNode(nextNodeId);
			}

			// Implicit parallelism: multiple next nodes run concurrently
			if (node.next.length > 1) {
				// Fire all branches concurrently, don't wait for results (no merge)
				const parallelPromises = node.next.map((nextId) =>
					this.executeNode(nextId).catch((err) => {
						this.log.error('parallel_branch_failed', { nextId, ...formatError(err) });
						// Don't propagate error - other branches continue
					})
				);
				// Wait for all to complete but don't merge results
				await Promise.all(parallelPromises);
				return result;
			}

			// Single next node - sequential execution
			return this.executeNode(node.next[0]);
		}

		return result;
	}

	// ============================================================================
	// Start Node - Inject User Config
	// ============================================================================

	private async executeStartNode(node: CompiledNode): Promise<NodeResult> {
		const config = node.config as StartNodeData;

		// ====================================================================
		// STATIC PREFIX — stable between messages for provider prompt caching
		// Order: system_prompt → personality → user context → attributes → profile
		// ====================================================================

		let staticPrefix = config.system_prompt || this.flow.global_config.system_prompt || '';

		// Inject user personality if available
		if (this.userConfig.personality) {
			staticPrefix = `${staticPrefix}\n\n## User Personality & Preferences\n${this.userConfig.personality}`;
		}

		// Inject user context (timezone, location)
		const userContextParts: string[] = [];
		if (this.userConfig.timezone) {
			userContextParts.push(`User's timezone: ${this.userConfig.timezone}`);
		}
		if (this.userConfig.location) {
			userContextParts.push(`User's location: ${this.userConfig.location}`);
		}
		if (this.userConfig.locale) {
			userContextParts.push(`User's locale: ${this.userConfig.locale}`);
		}

		// Add current time in user's timezone
		const now = new Date();
		const userTime = this.userConfig.timezone
			? now.toLocaleString('en-US', { timeZone: this.userConfig.timezone })
			: now.toISOString();
		userContextParts.push(`Current time: ${userTime}`);

		if (userContextParts.length > 0) {
			staticPrefix = `${staticPrefix}\n\n## User Context\n${userContextParts.join('\n')}`;
		}

		// Inject dynamic attributes via {{placeholder}} syntax
		// These are resolved in agent.ts and passed via context.resolvedAttributes
		if (
			this.context.resolvedAttributes &&
			Object.keys(this.context.resolvedAttributes).length > 0
		) {
			const injectionResult = injectAttributesIntoPrompt(
				staticPrefix,
				this.context.resolvedAttributes
			);
			staticPrefix = injectionResult.result;

			if (injectionResult.injectedCount > 0) {
				this.log.debug('attributes_injected', {
					count: injectionResult.injectedCount,
					keys: injectionResult.injectedKeys
				});
			}

			if (injectionResult.unresolvedPlaceholders.length > 0) {
				this.log.warn('unresolved_placeholders', {
					placeholders: injectionResult.unresolvedPlaceholders
				});
			}
		}

		// Inject user profile (changes rarely — only when profiler runs every ~5 messages)
		const profileMarkdown = this.context.variables?.profile_markdown as string | undefined;
		if (profileMarkdown) {
			staticPrefix = `${staticPrefix}\n\n## User Profile\n${profileMarkdown}`;
		}

		// ====================================================================
		// DYNAMIC SUFFIX — changes per message (RAG context, directives)
		// ====================================================================

		let dynamicSuffix = '';

		// Inject RAG context if provided (conversation summary, files, docs, knowledge)
		if (this.context.variables?.rag_context) {
			dynamicSuffix += `\n${this.context.variables.rag_context}`;
		}

		// Inject profile collection directive for cold start (when profile is incomplete)
		const profilerSchema = this.context.variables?.profiler_schema as
			| Array<{ section_id: string; label: string; fields: Array<{ key: string; label: string }> }>
			| undefined;
		const currentProfile = this.context.variables?.current_profile as
			| Array<{ id: string; data: { fields: Record<string, { value: string }> } }>
			| undefined;

		if (profilerSchema && profilerSchema.length > 0) {
			const missingFields: string[] = [];
			const filledFields: string[] = [];

			// Build lookup of filled profile fields
			const profileSections: ProfileSections = {};
			if (currentProfile) {
				for (const node of currentProfile) {
					const sectionId = node.id.split('::').pop()!;
					const fields: ProfileSections[string]['fields'] = {};
					for (const [k, f] of Object.entries(node.data.fields || {})) {
						if (f.value) fields[k] = { value: String(f.value) };
					}
					profileSections[sectionId] = { fields };
				}
			}

			for (const section of profilerSchema) {
				for (const field of section.fields) {
					const knownField = findProfileField(profileSections, section.section_id, field.key);
					if (knownField) {
						filledFields.push(`- [${section.label}] ${field.label}: ${knownField.value}`);
					} else {
						missingFields.push(`- [${section.label}] ${field.label}`);
					}
				}
			}

			if (missingFields.length > 0) {
				let guidance = `\n\n## Profile Collection Guidance\nIMPORTANT: Before asking any profile question, check the "User Profile" section above and the "Already known" list below. NEVER re-ask for information you already have. If the user mentions something you already know, acknowledge it and move on.`;
				if (filledFields.length > 0) {
					guidance += `\n\nAlready known (DO NOT ask again):\n${filledFields.join('\n')}`;
				}
				guidance += `\n\nStill missing (gather naturally when appropriate):\n${missingFields.join('\n')}`;
				guidance += `\n\nDo NOT ask all at once — weave them naturally into the conversation. Do NOT be invasive or interrupt the user's actual query.`;
				dynamicSuffix += guidance;
			}
		}

		// Inject memory search tool instruction when tools are available
		const hasMemorySearchTool = Object.values(this.flow.resolved.tools).some(
			(t) => t.tool_key === 'recall_memory'
		);
		if (hasMemorySearchTool) {
			dynamicSuffix += `\n\n## Memory Search\nYou have access to \`recall_memory\` and \`recall_sessions\` tools. If you need specific user information not in the loaded context, or the user asks "do you remember...", "what did I tell you about...", or references a past conversation, use these tools to search instead of saying you don't have that information.`;
		}

		// Inject analytical tools guidance when data tools are available
		const hasAnalyticalTools = Object.values(this.flow.resolved.tools).some(
			(t) => t.tool_key === 'run_analytical_tool'
		);
		if (hasAnalyticalTools) {
			dynamicSuffix += `\n\n## Analytical Tools Usage\nYou have access to data and analytical tools. Important rules:\n- Always call \`list_analytical_tools\` first to discover available tools and their exact \`tool_key\` values before running them.\n- Use \`run_analytical_tool\` with the exact \`tool_key\` string returned by \`list_analytical_tools\` (e.g. \`portfolio-risk-analyzer\`, never convert it to underscores).\n- The \`holdings\` input for portfolio analysis must include: \`symbol\` (string), \`quantity\` (number), \`avg_cost\` (number), \`current_price\` (number), \`asset_class\` (one of: equity, debt, gold, cash, real_estate, crypto, other). The \`name\` field is optional.\n- After running a tool, use \`get_data_from_source\` with \`type: "analytical-tool"\` and \`source_id\` = the \`tool_key\` string (e.g. \`"portfolio-risk-analyzer"\`) to read the results. For a specific past result, add \`params: { record_id: "<id>" }\`.\n- Use \`list_user_data_sources\` to see the user's saved analytical results.`;
		}

		// Combine: static prefix + separator + dynamic suffix
		let systemPrompt = staticPrefix;
		if (dynamicSuffix) {
			systemPrompt = `${staticPrefix}\n\n---DYNAMIC_CONTEXT_BELOW---\n${dynamicSuffix}`;
		}

		this.state.variables['system_prompt'] = systemPrompt;
		this.state.variables['user_message'] = this.context.userMessage;
		this.state.variables['user_config'] = this.userConfig;

		// Add system message to conversation (prepend before all messages)
		if (systemPrompt) {
			this.state.conversationHistory.unshift({
				role: 'system',
				content: systemPrompt
			});
		}

		// Only add user message if conversation history doesn't already include it.
		// (If history was fetched from DB, it already includes the current message)
		// For tool result resends (empty userMessage with tool results at end), skip adding.
		const hasUserMessage = this.context.userMessage
			? this.state.conversationHistory.some(
					(msg) => msg.role === 'user' && msg.content === this.context.userMessage
				)
			: true; // Empty userMessage means tool resend — don't add empty user msg
		if (!hasUserMessage) {
			this.state.conversationHistory.push({
				role: 'user',
				content: this.context.userMessage
			});
		}

		this.log.debug('start_node_complete', {
			conversationLength: this.state.conversationHistory.length,
			userMessageInHistory: hasUserMessage
		});

		return {
			nodeId: node.id,
			nodeType: 'start',
			success: true,
			output: {
				initialized: true,
				hasPersonality: !!this.userConfig.personality,
				attributesInjected: Object.keys(this.context.resolvedAttributes || {}).length
			},
			duration_ms: 0
		};
	}

	// ============================================================================
	// End Node
	// ============================================================================

	private async executeEndNode(
		node: CompiledNode
	): Promise<NodeResult & { endType: string; handoffAgentId?: string }> {
		const config = node.config as EndNodeData;

		this.log.debug('end_node_config', {
			nodeId: node.id,
			end_type: config.end_type,
			hasErrorMessage: !!config.error_message,
			hasResponseTemplate: !!config.response_template
		});

		// Get the last LLM output as default response
		let response =
			(this.state.variables['response'] as string) ??
			(this.state.variables['last_llm_output'] as string) ??
			'';

		// For error end type, use the error_message if provided
		if (config.end_type === 'error') {
			if (config.error_message) {
				response = this.interpolateTemplate(config.error_message, this.state.variables);
			} else if (!response) {
				// Default error message if none provided
				response = 'Sorry, I cannot help with that request.';
			}
		} else if (config.response_template) {
			response = this.interpolateTemplate(config.response_template, this.state.variables);
		}

		this.log.debug('end_node_response', { preview: response.substring(0, 100) });

		// If we have a response and there was no LLM streaming (no last_llm_output),
		// emit the response as a token so it appears in the chat
		if (response && !this.state.variables['last_llm_output']) {
			this.log.debug('end_node_emitting_token');
			if (this.writer) {
				this.writeText(response);
			} else {
				// Non-streaming fallback — no writer to emit to, just log
				this.log.debug('end_node_response_no_writer', { preview: response.slice(0, 100) });
			}
		}

		// Store the response in variables so it's available in the flow result
		this.state.variables['response'] = response;

		return {
			nodeId: node.id,
			nodeType: 'end',
			success: config.end_type !== 'error',
			output: response,
			error: config.end_type === 'error' ? response : undefined,
			endType: config.end_type ?? 'success',
			handoffAgentId: config.handoff_agent_id,
			duration_ms: 0
		};
	}

	// ============================================================================
	// LLM Node - Real AI SDK
	// ============================================================================

	private async executeLLMNode(node: CompiledNode): Promise<NodeResult> {
		const config = node.config as LLMNodeData;
		const tierCtx = this.state.tierContext;

		// Credit gate: check tier context before any model resolution
		if (tierCtx && !tierCtx.hasCredits) {
			if (!tierCtx.hasSubscription) {
				// Non-subscriber with zero credits — hard block
				this.emit({
					type: 'status',
					data: { type: 'credits-exhausted' }
				});
				return {
					nodeId: node.id,
					nodeType: node.type,
					success: false,
					error: 'Insufficient credit balance. Please top up to continue.',
					duration_ms: 0
				};
			}
			// Subscriber with zero credits — degrade to fallback model
			if (tierCtx.fallbackModel) {
				this.state.lastResolvedModel = tierCtx.fallbackModel;
				this.emit({
					type: 'status',
					data: {
						type: 'model-degraded',
						reason: 'credits_exhausted',
						model: tierCtx.fallbackModel.display_name
					}
				});
				return this.runLLMWithModel(node, config, tierCtx.fallbackModel);
			}
		}

		// Resolve model using priority chain: admin pin > chat override > user preference > system default
		let resolvedModel = resolveNodeModel(
			config.model_id,
			this.state.modelOverrideId,
			this.state.userModelPreferenceId,
			this.state.systemDefaultModel,
			this.flow.resolved.models,
			this.state.dynamicModels
		);

		// Tier model validation: if resolved model isn't allowed, fall back to system default
		if (
			tierCtx &&
			!isModelAllowed(tierCtx, resolvedModel.id, resolvedModel.tag_rule) &&
			this.state.systemDefaultModel
		) {
			this.emit({
				type: 'status',
				data: {
					type: 'model-restricted',
					model: resolvedModel.display_name,
					fallback: this.state.systemDefaultModel.display_name
				}
			});
			resolvedModel = this.state.systemDefaultModel;
		}

		// Track the actually-used model for debug/stats output
		this.state.lastResolvedModel = resolvedModel;

		// Emit model-used annotation so the client knows which model handled this request
		this.emit({
			type: 'status',
			data: {
				type: 'model-used',
				model: resolvedModel.display_name,
				modelId: resolvedModel.model_id,
				provider: resolvedModel.provider_key
			}
		});

		return this.runLLMWithModel(node, config, resolvedModel);
	}

	/**
	 * Execute an LLM node with a specific resolved model.
	 * Extracted to allow both normal resolution and tier-degraded paths to share logic.
	 */
	private async runLLMWithModel(
		node: CompiledNode,
		config: LLMNodeData,
		resolvedModel: ResolvedModel
	): Promise<NodeResult> {
		// Build messages
		const messages: ModelMessage[] = [...this.state.conversationHistory];
		let systemPrompt = messages.find((message) => message.role === 'system')?.content;

		this.log.debug('llm_messages_prepared', {
			messageCount: messages.length,
			roles: messages.map((m) => m.role)
		});

		// Override system prompt if node has one
		if (config.system_prompt) {
			systemPrompt = config.system_prompt;
		}

		const aiMessages = messages.filter((message) => message.role !== 'system');

		const startTime = Date.now();

		// All providers go through model-factory (including Cloudflare via workers-ai-provider)
		const model = getModel(resolvedModel.provider_key, resolvedModel.model_id, this.env);

		// Get pricing info - use resolved model_id (e.g., "gemini-2.5-flash") not config.model_id (record ID)
		const pricing = await getPricingForModel(this.db, resolvedModel.model_id);

		// Get builtin/SDK tools for this node (SDK tools filtered by active provider)
		const builtinTools =
			config.tools && config.tools.length > 0
				? await getToolsForNode(
						this.state.toolContext,
						config.tools,
						this.flow.resolved.tools,
						resolvedModel.provider_key
					)
				: {};

		const tools = builtinTools;

		// Log loaded tools for debugging
		const toolCount = Object.keys(tools).length;
		if (toolCount > 0) {
			this.log.debug('tools_loaded', { nodeId: node.id, toolCount, tools: Object.keys(tools) });
		}

		// Only pass tools if there are any
		const toolsToPass = toolCount > 0 ? tools : undefined;

		let response: string;
		let inputTokens = 0;
		let outputTokens = 0;
		let fullUsage: {
			inputTokens?: number;
			outputTokens?: number;
			cachedTokens?: number;
			reasoningTokens?: number;
		} = {};

		// Map provider_options through the param mapper
		const { sdkParams, providerOptions: provOpts } = mapProviderOptions(
			config.provider_options ?? {},
			resolvedModel.provider_key
		);

		if (this.writer) {
			// Native AI SDK streaming mode via UIMessageStream
			const result = streamText({
				model,
				system: typeof systemPrompt === 'string' ? systemPrompt : undefined,
				messages: aiMessages,
				tools: toolsToPass,
				stopWhen: toolsToPass && Object.keys(toolsToPass).length > 0 ? stepCountIs(25) : undefined,
				timeout: { totalMs: 120_000, chunkMs: 15_000 },
				experimental_transform: smoothStream(),
				// Force text-only on final steps to prevent runaway tool loops
				prepareStep: toolsToPass
					? ({ stepNumber }) => (stepNumber >= 20 ? { toolChoice: 'none' as const } : {})
					: undefined,
				onStepFinish: ({ stepNumber, usage, finishReason, toolCalls }) => {
					this.log.debug('llm_step_finish', {
						step: stepNumber,
						finishReason,
						inputTokens: usage.inputTokens,
						outputTokens: usage.outputTokens,
						toolsCalled: toolCalls?.map((tc) => tc.toolName)
					});
				},
				...sdkParams,
				...(Object.keys(provOpts).length > 0 ? { providerOptions: provOpts } : {})
			});

			// Merge the streamText result into the writer — this handles text deltas,
			// tool calls, tool results, and sources natively via the Data Stream Protocol.
			// The writer pipes tokens to the client as they arrive (non-blocking).
			this.writer.merge(
				result.toUIMessageStream({
					sendSources: true,
					// Classify provider errors into user-friendly messages before
					// surfacing them to the client via the Data Stream Protocol.
					onError: (error) => {
						const classified = classifyProviderError(error);
						const raw = error instanceof Error ? error.message : String(error);
						const isAbort =
							(error instanceof Error && error.name === 'AbortError') ||
							raw.includes('aborted') ||
							raw.includes('cancel');
						if (isAbort) {
							this.log.warn('llm_stream_canceled', { raw });
						} else {
							this.log.error('llm_stream_error', {
								category: classified.category,
								retriable: classified.retriable,
								raw
							});
						}
						return classified.userMessage;
					}
				})
			);

			// Await final text, usage, and steps (all resolve when stream completes)
			const [finalText, usage, steps] = await Promise.all([
				result.text,
				result.usage,
				result.steps
			]);
			response = finalText;
			fullUsage = usage ?? {};
			inputTokens = fullUsage.inputTokens ?? 0;
			outputTokens = fullUsage.outputTokens ?? 0;

			// Capture ALL parts (text + UI tools) from step.content in interleaved order.
			// This preserves the exact rendering order for page reload: text → chart → text → chart → text.
			// AI SDK v6 ContentPart: { type: 'text', text } | { type: 'tool-result', toolName, output, ... }
			//                        | { type: 'tool-call', toolCallId, toolName, args }
			const uiToolNames = ['display_chart', 'display_table', 'ask_confirmation', 'request_input'];
			// HIL tools have no execute — they appear as tool-call (not tool-result) in step content
			const hilToolNames = ['ask_confirmation', 'request_input'];
			const capturedParts: FlowResult['parts'] = [];
			let hasToolParts = false;
			// Track tool-call IDs that got resolved to tool-results (so we don't duplicate)
			const resolvedToolCallIds = new Set<string>();

			// First pass: collect all tool-result IDs
			for (const step of steps) {
				for (const part of step.content) {
					if (part.type === 'tool-result' && 'toolCallId' in part) {
						resolvedToolCallIds.add(part.toolCallId);
					}
				}
			}

			// Second pass: capture parts in order
			for (const step of steps) {
				for (const part of step.content) {
					if (part.type === 'text' && part.text) {
						capturedParts.push({ type: 'text', text: part.text });
					} else if (
						part.type === 'tool-result' &&
						part.toolName &&
						uiToolNames.includes(part.toolName)
					) {
						hasToolParts = true;
						capturedParts.push({
							type: `tool-${part.toolName}`,
							toolCallId: part.toolCallId ?? '',
							toolName: part.toolName,
							input: part.input ?? {},
							output: part.output,
							state: 'output-available' as const,
							// Preserve provider metadata on executed tools
							providerMetadata: part.providerMetadata
						});
					} else if (
						part.type === 'tool-call' &&
						part.toolName &&
						hilToolNames.includes(part.toolName) &&
						!resolvedToolCallIds.has(part.toolCallId ?? '')
					) {
						// HIL tool call without execute — capture as input-available
						// so it persists on page reload (user sees the form in answered/pending state)
						hasToolParts = true;
						capturedParts.push({
							type: `tool-${part.toolName}`,
							toolCallId: part.toolCallId ?? '',
							toolName: part.toolName,
							input: part.input ?? {},
							output: undefined,
							state: 'input-available' as const,
							// Preserve provider metadata for round-trip fidelity
							providerMetadata: part.providerMetadata
						});
					} else if (
						part.type === 'tool-error' &&
						part.toolName &&
						uiToolNames.includes(part.toolName)
					) {
						// Tool execution error — persist as output-error so it renders on reload
						hasToolParts = true;
						capturedParts.push({
							type: `tool-${part.toolName}`,
							toolCallId: part.toolCallId ?? '',
							toolName: part.toolName,
							input: part.input ?? {},
							output: { error: String(part.error ?? 'Tool execution failed') },
							state: 'output-available' as const
						});
					}
				}
			}

			// Only persist parts if we have UI tool parts (no point saving text-only)
			if (hasToolParts && capturedParts.length > 0) {
				this.state.variables['ui_parts'] = capturedParts;
				this.log.debug('ui_parts_captured', {
					count: capturedParts.length,
					textParts: capturedParts.filter((p) => p.type === 'text').length,
					toolParts: capturedParts.filter((p) => p.type !== 'text').length
				});
			}

			if (inputTokens === 0 && outputTokens === 0) {
				this.log.warn('zero_token_usage', {
					provider: resolvedModel.provider_key,
					modelId: resolvedModel.model_id
				});
			}

			// Handle cases where LLM didn't generate a text response after tool use
			if (!response) {
				const fallback = this.buildToolFallbackResponse();
				if (fallback) {
					response = fallback;
					this.writeText(fallback);
				}
			}

			// Sync state variables so end node and flowResult.response reflect the
			// streamed output. Without this, assistant messages aren't persisted to PB.
			this.state.variables['response'] = response;
			this.state.variables['last_llm_output'] = response;
		} else {
			// Non-streaming mode
			// stopWhen allows the LLM to execute tools and then respond with text
			const result = await generateText({
				model,
				system: typeof systemPrompt === 'string' ? systemPrompt : undefined,
				messages: aiMessages,
				tools: toolsToPass,
				// Allow multi-step tool execution (tool call → tool result → text response)
				// 25 steps = complex queries may need: list_files + read_file×5 + search×3 + display_chart×3 + text
				stopWhen: toolsToPass && Object.keys(toolsToPass).length > 0 ? stepCountIs(25) : undefined,
				timeout: { totalMs: 90_000, stepMs: 30_000 },
				// Force text-only on final steps to prevent runaway tool loops
				prepareStep: toolsToPass
					? ({ stepNumber }) => (stepNumber >= 20 ? { toolChoice: 'none' as const } : {})
					: undefined,
				onStepFinish: ({ stepNumber, usage, finishReason, toolCalls }) => {
					this.log.debug('llm_step_finish', {
						step: stepNumber,
						finishReason,
						inputTokens: usage.inputTokens,
						outputTokens: usage.outputTokens,
						toolsCalled: toolCalls?.map((tc) => tc.toolName)
					});
				},
				...sdkParams,
				...(Object.keys(provOpts).length > 0 ? { providerOptions: provOpts } : {})
			});

			response = result.text;
			fullUsage = result.usage;
			inputTokens = fullUsage.inputTokens ?? 0;
			outputTokens = fullUsage.outputTokens ?? 0;

			// Log tool calls if any (non-streaming, so just log — no writer to emit to)
			if (result.toolCalls && result.toolCalls.length > 0) {
				this.log.debug('non_streaming_tool_calls', {
					tools: result.toolCalls.map((tc) => ({ name: tc.toolName, id: tc.toolCallId }))
				});
			}

			// Log tool results if any
			if (result.toolResults && result.toolResults.length > 0) {
				this.log.debug('non_streaming_tool_results', {
					tools: result.toolResults.map((tr) => ({ id: tr.toolCallId, success: true }))
				});
			}
		}

		// Calculate cost
		const { costUsd, credits } = await trackInferenceCost({
			db: this.db,
			modelId: resolvedModel.model_id,
			usage: fullUsage,
			purpose: 'agent_chat',
			pricing,
			creditsPerUsd: this.creditsPerUsd,
			costTracker: this.state.costTracker,
			extraMetadata: {
				provider: resolvedModel.provider_key,
				duration_ms: Date.now() - startTime
			}
		});

		// Update state
		this.state.variables['response'] = response;
		this.state.variables['last_llm_output'] = response;

		// Only add to conversation history if we have a valid response
		// This prevents empty responses from corrupting the conversation flow
		const hasUiParts =
			Array.isArray(this.state.variables['ui_parts']) &&
			(this.state.variables['ui_parts'] as unknown[]).length > 0;

		if (response && response.trim().length > 0) {
			this.state.conversationHistory.push({ role: 'assistant', content: response });
		} else if (hasUiParts) {
			// Empty text is normal when LLM generates only tool calls (e.g., HIL tools
			// like ask_confirmation / request_input). Don't generate a fallback error.
			this.log.debug('empty_response_with_tool_parts', {
				partsCount: (this.state.variables['ui_parts'] as unknown[]).length
			});
		} else {
			// No text AND no tool parts — genuine failure, generate fallback.
			// Must write to the stream so the client actually sees the message —
			// the LLM's toUIMessageStream merge produced nothing visible.
			const fallbackResponse =
				'I apologize, but I encountered an issue processing your request. Please try again.';
			response = fallbackResponse;
			this.writeText(fallbackResponse);
			this.state.variables['response'] = fallbackResponse;
			this.state.variables['last_llm_output'] = fallbackResponse;
			this.state.conversationHistory.push({ role: 'assistant', content: fallbackResponse });
			this.log.warn('empty_response_fallback', { response: fallbackResponse });
		}

		return {
			nodeId: node.id,
			nodeType: 'llm',
			success: true,
			output: response,
			tokens: { input: inputTokens, output: outputTokens },
			cost: { usd: costUsd, credits },
			duration_ms: Date.now() - startTime
		};
	}

	// ============================================================================
	// Classifier Node
	// ============================================================================

	private async executeClassifierNode(node: CompiledNode): Promise<NodeResult> {
		const config = node.config as ClassifierNodeData;
		const startTime = Date.now();
		const input = String(this.state.variables['last_llm_output'] ?? this.context.userMessage);

		this.log.debug('classifier_config', {
			nodeId: node.id,
			classifier_type: config.classifier_type,
			categories: config.categories?.map((c) => c.id),
			default_category: config.default_category,
			inputLength: input.length
		});

		// Validate categories exist
		if (!config.categories || config.categories.length === 0) {
			this.log.error('classifier_no_categories', { nodeId: node.id });
			const fallback = config.default_category ?? 'unknown';
			this.state.variables['classification'] = fallback;
			return {
				nodeId: node.id,
				nodeType: 'classifier',
				success: false,
				error: 'No categories defined for classifier',
				output: fallback,
				duration_ms: Date.now() - startTime
			};
		}

		let category: string;

		switch (config.classifier_type) {
			case 'keyword':
				category = this.classifyByKeyword(input, config);
				break;
			case 'regex':
				category = this.classifyByRegex(input, config);
				break;
			case 'llm':
			default:
				category = await this.classifyByLLM(input, config);
		}

		this.log.info('classification_result', {
			nodeId: node.id,
			category,
			willRouteTo: node.next_mapping?.[category] ?? node.next?.[0] ?? 'NO_NEXT_NODE'
		});

		this.state.variables['classification'] = category;

		return {
			nodeId: node.id,
			nodeType: 'classifier',
			success: true,
			output: category,
			duration_ms: Date.now() - startTime
		};
	}

	private classifyByKeyword(input: string, config: ClassifierNodeData): string {
		const lowerInput = input.toLowerCase();
		for (const category of config.categories) {
			if (category.keywords?.some((kw) => lowerInput.includes(kw.toLowerCase()))) {
				return category.id;
			}
		}
		return config.default_category ?? config.categories[0]?.id ?? 'unknown';
	}

	private classifyByRegex(input: string, config: ClassifierNodeData): string {
		for (const category of config.categories) {
			if (category.pattern && new RegExp(category.pattern, 'i').test(input)) {
				return category.id;
			}
		}
		return config.default_category ?? config.categories[0]?.id ?? 'unknown';
	}

	private async classifyByLLM(input: string, config: ClassifierNodeData): Promise<string> {
		const categoryDescriptions = config.categories
			.map((c) => `- ${c.id}: ${c.description || c.label}`)
			.join('\n');

		this.log.debug('classify_by_llm', {
			categories: config.categories.map((c) => c.id),
			categoryDescriptions
		});

		// Build a more explicit prompt that emphasizes exact category ID response
		const categoryIds = config.categories.map((c) => c.id).join(', ');

		// Build the prompt - custom prompt + categories + instructions, or default
		let prompt: string;
		if (config.classification_prompt) {
			// Interpolate template variables in custom prompt
			const customPart = this.interpolateTemplate(config.classification_prompt, {
				...this.state.variables,
				message: input,
				input: input,
				user_message: input,
				categories: categoryDescriptions,
				category_ids: categoryIds
			});

			// Always append categories and strict response format instruction
			prompt =
				customPart +
				interpolatePrompt(CLASSIFIER_NODE_SUFFIX, { categoryDescriptions, categoryIds });
		} else {
			// Default prompt
			prompt = interpolatePrompt(CLASSIFIER_NODE_DEFAULT, {
				categoryDescriptions,
				input,
				categoryIds
			});
		}

		this.log.debug('classification_prompt', { promptLength: prompt.length });

		// Resolve classifier model using the same priority chain as LLM nodes
		let resolvedModel: ResolvedModel | undefined;
		try {
			resolvedModel = resolveNodeModel(
				config.model_id,
				this.state.modelOverrideId,
				this.state.userModelPreferenceId,
				this.state.systemDefaultModel,
				this.flow.resolved.models,
				this.state.dynamicModels
			);
		} catch {
			this.log.warn('classification_no_model');
			return config.default_category ?? config.categories[0]?.id ?? 'unknown';
		}

		this.log.debug('classification_starting', {
			model: resolvedModel.model_id,
			provider: resolvedModel.provider_key,
			categoryIds
		});

		const startTime = Date.now();

		try {
			// All providers go through model-factory (including Cloudflare via workers-ai-provider)
			const model = getModel(resolvedModel.provider_key, resolvedModel.model_id, this.env);
			const result = await generateText({
				model,
				messages: [{ role: 'user', content: prompt }],
				maxOutputTokens: 50,
				timeout: 15_000
			});

			const response = result.text.trim();
			this.log.debug('classification_response', { response });

			const matchedCategory = this.matchCategory(response, config.categories);

			// Track cost - use resolved model_id not config.model_id (record ID)
			await trackInferenceCost({
				db: this.db,
				modelId: resolvedModel.model_id,
				usage: result.usage,
				purpose: 'classification',
				pricing: await getPricingForModel(this.db, resolvedModel.model_id),
				creditsPerUsd: this.creditsPerUsd,
				costTracker: this.state.costTracker,
				extraMetadata: {
					duration_ms: Date.now() - startTime
				}
			});

			return matchedCategory ?? config.default_category ?? config.categories[0]?.id ?? 'unknown';
		} catch (error) {
			this.log.error('llm_classification_failed', { ...formatError(error) });
			return config.default_category ?? config.categories[0]?.id ?? 'unknown';
		}
	}

	/**
	 * Match LLM response to a category with flexible matching
	 * Tries: exact match, case-insensitive match, contains match, label match
	 */
	private matchCategory(
		response: string,
		categories: ClassifierNodeData['categories']
	): string | undefined {
		const cleanResponse = response.trim().toLowerCase();

		// 1. Try exact case-insensitive match on id
		for (const category of categories) {
			if (category.id.toLowerCase() === cleanResponse) {
				return category.id;
			}
		}

		// 2. Try if response contains the category id
		for (const category of categories) {
			if (cleanResponse.includes(category.id.toLowerCase())) {
				return category.id;
			}
		}

		// 3. Try if category id is contained in response (for verbose responses)
		for (const category of categories) {
			if (category.id.toLowerCase().includes(cleanResponse) && cleanResponse.length > 2) {
				return category.id;
			}
		}

		// 4. Try matching on label
		for (const category of categories) {
			if (category.label && category.label.toLowerCase() === cleanResponse) {
				return category.id;
			}
		}

		// 5. Try partial label match
		for (const category of categories) {
			if (category.label && cleanResponse.includes(category.label.toLowerCase())) {
				return category.id;
			}
		}

		this.log.warn('category_match_failed', { response });
		return undefined;
	}

	// ============================================================================
	// Utilities
	// ============================================================================

	/**
	 * Emit a stream event via the AI SDK writer as `data-*` custom parts.
	 * Token/tool events are handled natively by toUIMessageStream merge
	 * and do not go through this method.
	 */
	private emit(event: StreamEvent): void {
		if (this.writer) {
			switch (event.type) {
				case 'status':
				case 'node_start':
				case 'node_complete':
				case 'log':
				case 'done':
					this.writer.write({ type: `data-${event.type}`, data: event.data });
					break;
				case 'error':
					this.writer.write({ type: 'error', errorText: event.data.message });
					break;
			}
		}
	}

	/**
	 * Write text directly to the AI SDK stream writer.
	 * Used for non-LLM text (end node responses, fallback messages)
	 * where toUIMessageStream merge is not involved.
	 */
	private writeText(text: string): void {
		if (!this.writer) return;
		const id = `text-${++this.textPartCounter}`;
		this.writer.write({ type: 'text-start', id });
		this.writer.write({ type: 'text-delta', id, delta: text });
		this.writer.write({ type: 'text-end', id });
	}

	/**
	 * Build a fallback response when LLM tools completed but no text was generated.
	 * Returns null if no fallback is needed.
	 */
	private buildToolFallbackResponse(): string | null {
		// In writer mode, tool calls and results are streamed natively via
		// toUIMessageStream — the client renders tool UI parts directly.
		// Returning a generic fallback text here would create an unnecessary
		// extra text segment in the stream alongside the tool results.
		// Return null to let the tool output speak for itself.
		return null;
	}

	private interpolateTemplate(template: string, variables: Record<string, unknown>): string {
		return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
			const value = path.split('.').reduce((obj: unknown, key: string) => {
				return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;
			}, variables);
			return value !== undefined ? String(value) : match;
		});
	}

	abort(): void {
		this.state.aborted = true;
	}
}

// ============================================================================
// Factory Function
// ============================================================================

export async function createFlowExecutor(options: FlowExecutorOptions): Promise<FlowExecutor> {
	// Load user config if not provided
	if (!options.userConfig) {
		options.userConfig = await loadUserConfig(options.db, options.context.userId);
	}
	return new FlowExecutor(options);
}
