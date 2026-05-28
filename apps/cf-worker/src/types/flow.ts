/**
 * Flow Types v2.0
 * Type definitions for the visual flow-based agent system
 *
 * ARCHITECTURE:
 * - 4 node types: start, end, llm, classifier
 * - Implicit parallelism: if a node has multiple outgoing edges, all targets run in parallel
 * - No explicit merge: parallel branches complete independently (no result joining)
 * - Classifier routes to exactly one branch based on classification
 */

// ============================================================================
// Node Types (simplified - no parallel/merge/task)
// ============================================================================

export type FlowNodeType = 'start' | 'end' | 'llm' | 'classifier';

// ============================================================================
// Base Interfaces
// ============================================================================

export interface BaseNodeData {
	label: string;
}

export interface RetryConfig {
	max_attempts: number;
	initial_delay_ms: number;
	backoff_strategy: 'linear' | 'exponential';
}

export interface SearchConfig {
	enabled: boolean;
	max_results?: number;
	similarity_threshold?: number;
	file_scope?: 'chat' | 'global' | 'all';
}

// ============================================================================
// Node Data Types
// ============================================================================

export interface StartNodeData extends BaseNodeData {
	system_prompt?: string;
	file_enricher_template?: string;
	knowledge_base?: string[]; // File IDs from ai_system_uploads
	/** Enable knowledge base / RAG search for this agent */
	rag_enabled?: boolean;
	input_schema?: {
		required_fields?: string[];
		max_message_length?: number;
		allowed_file_types?: string[];
	};
}

export interface EndNodeData extends BaseNodeData {
	end_type: 'success' | 'error' | 'handoff';
	response_template?: string;
	handoff_agent_id?: string;
	error_message?: string;
}

export interface LLMNodeData extends BaseNodeData {
	/** PB record ID of the pinned model. When absent, uses the user's selected model at runtime. */
	model_id?: string;
	system_prompt?: string;
	tools: string[]; // Tool IDs from ai_tools
	tool_params?: Record<string, Record<string, unknown>>;
	/**
	 * @deprecated Use `provider_options` instead. Kept for backward compatibility
	 * with existing saved flows. The param-mapper handles both fields identically.
	 */
	parameters?: {
		temperature?: number;
		max_tokens?: number;
		top_p?: number;
		frequency_penalty?: number;
		presence_penalty?: number;
		stop?: string[];
	};
	// Model-specific provider options (from model's options_schema)
	// This is the canonical field — all model params flow through here
	provider_options?: Record<string, unknown>;
	output_schema?: Record<string, unknown>;
}

export interface ClassifierCategory {
	id: string;
	label: string;
	description?: string;
	keywords?: string[];
	pattern?: string;
}

export interface ClassifierNodeData extends BaseNodeData {
	classifier_type: 'llm' | 'keyword' | 'regex';
	model_id?: string;
	classification_prompt?: string;
	match_field?: string;
	categories: ClassifierCategory[];
	default_category?: string;
	confidence_threshold?: number;
}

// ============================================================================
// Union Type (simplified - only 4 node types)
// ============================================================================

export type FlowNodeData = StartNodeData | EndNodeData | LLMNodeData | ClassifierNodeData;

// ============================================================================
// Flow Structure
// ============================================================================

export interface FlowNode {
	id: string;
	type: FlowNodeType;
	position: { x: number; y: number };
	data: FlowNodeData;
	measured?: { width: number; height: number };
	selected?: boolean;
}

export interface FlowEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string;
	targetHandle?: string;
	type?: string;
	animated?: boolean;
	label?: string;
}

export interface FlowData {
	nodes: FlowNode[];
	edges: FlowEdge[];
	viewport?: { x: number; y: number; zoom: number };
}

// ============================================================================
// Resolved Model & Tool Types (extracted for reuse across executor + client)
// ============================================================================

/** A model record resolved at compile time (pinned) or fetched at runtime (user override). */
export interface ResolvedModel {
	id: string;
	model_id: string; // The actual model identifier (e.g., "gpt-4o")
	display_name: string;
	provider_id: string;
	provider_key: string; // e.g., "openai", "anthropic"
	pricing_id?: string;
	context_window?: number;
	max_output_tokens?: number;
	default_options?: Record<string, unknown>;
	capabilities?: Record<string, unknown>;
	tag_rule?: import('@repo/shared/types').TagRule | null;
}

/** A tool record resolved at compile time. */
export interface ResolvedTool {
	id: string;
	tool_key: string; // e.g., "web_search", "calculator"
	display_name: string;
	description?: string;
	tool_type: 'sdk' | 'builtin';
	sdk_tool_name?: string; // For SDK tools - the SDK action name (e.g., "googleSearch", "webSearch_20250305")
	execution_config?: Record<string, unknown>;
	provider_key?: string; // For SDK tools - the provider key (e.g., "google", "anthropic", "openai", "xai")
}

/** User's global model preference stored in user_customization. */
export interface ModelPreference {
	model_id: string; // PB record ID of the preferred ai_agent_models record
}

// ============================================================================
// Compiled Flow Config
// ============================================================================

export interface CompiledFlowConfig {
	version: '2.0';
	start_node_id: string;
	nodes: Record<string, CompiledNode>;
	global_config: {
		system_prompt?: string;
		file_enricher_template?: string;
		knowledge_base: string[];
		default_model_id?: string;
		default_timeout_ms: number;
		max_total_tokens?: number;
		/** Whether knowledge base / RAG search is enabled for this agent */
		rag_enabled?: boolean;
		// Context management for long conversations (configured per-agent)
		context_management?: ContextManagementConfig;
	};
	resolved: {
		models: Record<string, ResolvedModel>;
		tools: Record<string, ResolvedTool>;
	};
	metadata: {
		total_nodes: number;
		has_classifier: boolean;
		has_implicit_parallel: boolean; // True if any node has multiple outgoing edges
		max_depth: number;
		node_type_counts: Record<FlowNodeType, number>;
	};
}

// ============================================================================
// Context Management Types
// ============================================================================

/**
 * Configuration for managing conversation context in long chats
 * Configured PER-AGENT in the flow editor - each agent can have different strategy
 *
 * Examples:
 * - Excel agent: sliding_window=30, custom prompt for extracting data patterns
 * - General assistant: sliding_window=6, standard summarization
 * - Research agent: sliding_window=10, prompt focused on preserving citations
 */
export interface ContextManagementConfig {
	enabled: boolean;

	// Strategy type
	strategy: 'sliding_window' | 'hybrid';
	// - sliding_window: Keep last N messages only, drop older ones
	// - hybrid: Keep last N messages verbatim + auto-summarize older messages

	// Sliding window size: keep last N messages verbatim
	sliding_window_size: number; // e.g., 6, 10, 30 depending on agent type

	// Summarization config (only used when strategy = 'hybrid')
	summarization?: {
		// Trigger: when to generate/update summary
		trigger_threshold: number; // Number of messages beyond sliding window before summarizing

		// Model reference (same pattern as LLM nodes - references ai_models collection)
		model_id: string; // References resolved.models[model_id]

		// Prompt key (REQUIRED - each agent must define their summarization prompt)
		prompt_key: string; // Key in ai_prompts collection - agent-specific

		// Max tokens for summary output
		max_tokens?: number;
	};
}

export interface CompiledNode {
	id: string;
	type: FlowNodeType;
	label: string;
	config: FlowNodeData;
	/**
	 * Next nodes to execute after this one.
	 * - If length > 1: IMPLICIT PARALLELISM - all targets run concurrently
	 * - If length === 1: Sequential execution
	 * - If length === 0: End of branch (should be 'end' node)
	 *
	 * For classifier nodes, use next_mapping to determine which single target to route to.
	 */
	next: string[];
	/**
	 * For classifier nodes only: maps category_id -> node_id
	 * Classifier picks ONE category and routes to that single node.
	 */
	next_mapping?: Record<string, string>;
	on_error?: 'fail' | 'continue' | 'fallback';
	fallback_node_id?: string;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutionContext {
	userId: string;
	chatId?: string;
	agentId: string;
	/** The database record ID of the agent (for cost tracking relations) */
	agentRecordId?: string;
	sessionId: string;
	userMessage: string;
	conversationHistory: Message[];
	attachedFiles: FileAttachment[];
	variables: Record<string, unknown>;
	/** Cloudflare headers for attribute resolution */
	cfHeaders?: Record<string, string>;
	/** Pre-resolved attributes for prompt injection */
	resolvedAttributes?: Record<string, string>;
}

export interface Message {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	/** Files attached to this specific message (not global chat attachments) */
	attachments?: MessageAttachment[];
	/**
	 * Tool calls made by the assistant (for role='assistant' messages).
	 * Used to represent the assistant's tool invocations in conversation history
	 * so the LLM receives proper tool call/result context on follow-up turns.
	 */
	toolCalls?: Array<{
		toolCallId: string;
		toolName: string;
		args: unknown;
		/** Provider-specific metadata (e.g. Google's thoughtSignature) — must be preserved for round-trip */
		providerMetadata?: Record<string, unknown>;
	}>;
	/**
	 * Tool results (for role='tool' messages).
	 * Used to represent user-provided tool results (HIL tools) in conversation history.
	 */
	toolResults?: Array<{
		toolCallId: string;
		toolName: string;
		result: unknown;
	}>;
}

/**
 * Lightweight attachment info for per-message file references
 * Used to tell the agent "this file was attached to THIS message"
 */
export interface MessageAttachment {
	id: string;
	name: string;
	type?: string;
	size?: number;
}

export interface FileAttachment {
	id: string;
	name: string;
	type: string;
	size: number;
	url?: string;
}

export interface NodeResult {
	nodeId: string;
	nodeType: FlowNodeType;
	success: boolean;
	output?: unknown;
	error?: string;
	duration_ms: number;
	tokens?: {
		input: number;
		output: number;
	};
	cost?: {
		usd: number;
		credits: number;
	};
}

export interface FlowResult {
	success: boolean;
	response: string;
	endType: 'success' | 'error' | 'handoff';
	nodeResults: NodeResult[];
	totalTokens: {
		input: number;
		output: number;
	};
	totalCost: {
		usd: number;
		credits: number;
	};
	duration_ms: number;
	handoffAgentId?: string;
	/** Serialized message parts for persistence — text + UI tool parts interleaved in order.
	 * Captures the full content from all steps so the message renders identically on reload. */
	parts?: Array<
		| { type: 'text'; text: string }
		| {
				type: string;
				toolCallId: string;
				toolName: string;
				input: unknown;
				output: unknown;
				state: 'output-available' | 'input-available';
				/** Provider-specific metadata for tool-call round-trip (e.g. Google thoughtSignature) */
				providerMetadata?: Record<string, unknown>;
		  }
	>;
	/** Debug data for logging - full messages array and system prompt */
	debug?: {
		systemPrompt: string;
		messagesArray: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
		modelId?: string;
		provider?: string;
	};
}

// ============================================================================
// Stream Events (emitted as data-* custom parts via UIMessageStreamWriter)
// ============================================================================

/**
 * Events emitted by the flow executor through the AI SDK stream writer.
 * Token/tool events are handled natively by `toUIMessageStream()` merge
 * and do NOT go through this type.
 */
export type StreamEvent =
	| { type: 'status'; data: StatusEventData }
	| { type: 'node_start'; data: { nodeId: string; nodeType: FlowNodeType; label: string } }
	| { type: 'node_complete'; data: NodeResult }
	| { type: 'log'; data: { level: string; category: string; message: string; details?: unknown } }
	| { type: 'error'; data: { message: string; nodeId?: string } }
	| { type: 'done'; data: FlowResult };

export type StatusEventData =
	| { phase: string; nodeId?: string }
	| { type: 'credits-exhausted' }
	| { type: 'model-degraded'; reason: string; model: string }
	| { type: 'model-restricted'; model: string; fallback: string }
	| { type: 'model-used'; model: string; modelId: string; provider: string };

// ============================================================================
// AI SDK Native Streaming Types
// ============================================================================

/**
 * Minimal interface for the AI SDK UIMessageStreamWriter.
 * Used by the flow executor to write parts to the stream without
 * importing the full AI SDK UI types.
 */
export interface UIStreamWriter {
	write(part: Record<string, unknown>): void;
	merge(stream: ReadableStream): void;
}

/**
 * Message-level metadata attached to assistant messages via AI SDK's
 * `messageMetadata` callback. Accessible on the client as `message.metadata`.
 */
export interface ChatMessageMetadata {
	// Cost tracking
	costUsd?: number;
	credits?: number;
	tokens?: { input: number; output: number };
	model?: string;
	provider?: string;
	latencyMs?: number;
	// Lifecycle
	createdAt?: number;
	agentId?: string;
	sessionId?: string;
	// Status updates (streamed as data-* parts)
	phase?: string;
	// Debug
	debugId?: string;
}

// ============================================================================
// Cost Tracking Types
// ============================================================================

export interface AICostEvent {
	operation: 'inference' | 'embedding' | 'toMarkdown' | 'reranking' | 'tool' | 'transcription';
	modelId: string;
	tokens?: {
		input: number;
		output: number;
	};
	costUsd: number;
	credits: number;
	pricingRateId?: string;
	metadata?: Record<string, unknown>;
}

export interface FlowCostTracker {
	events: AICostEvent[];
	totalCostUsd: number;
	totalCredits: number;
	addEvent(event: AICostEvent): void;
	getSummary(): {
		byOperation: Record<
			string,
			{ count: number; costUsd: number; credits: number; inputTokens: number; outputTokens: number }
		>;
		totalCostUsd: number;
		totalCredits: number;
		totalInputTokens: number;
		totalOutputTokens: number;
	};
}
