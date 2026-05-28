/**
 * Debug Logger
 *
 * Conditional debug logging for development mode agents.
 * When ai_agents.status == "development", emits detailed SSE events
 * for every step of the agent flow.
 *
 * Usage:
 * const debug = createDebugLogger(sendEvent, isDevMode);
 * debug.log('context_start', { query: message });
 */

// ============================================================================
// Types
// ============================================================================

export type DebugEventType =
	| 'context_start'
	| 'context_complete'
	| 'context_prewarmed' // Context retrieved from pre-warm cache
	| 'context_restored' // Returning to existing chat - context restored
	| 'context_new' // New chat started
	| 'query_rewrite'
	| 'vector_search'
	| 'fts_search'
	| 'rrf_fusion'
	| 'rerank'
	| 'file_lookup'
	| 'knowledge_graph'
	| 'prompt_build'
	| 'full_system_prompt' // Complete system prompt for debugging
	| 'chat_state' // Full messages array being sent to LLM
	| 'llm_call_start'
	| 'llm_call_complete'
	| 'full_response' // Complete LLM response
	| 'extraction_start'
	| 'extraction_batch' // Batch extraction triggered
	| 'extraction_deferred' // Extraction deferred (not enough messages)
	| 'extraction_complete'
	| 'context_management' // Context management strategy applied
	| 'summary_generated' // New summary was generated
	| 'summary_cached' // Using cached summary from DO state
	| 'cost_event'
	| 'flow_step';

export interface DebugEventData {
	// Common fields
	timestamp?: number;
	durationMs?: number;

	// Context building
	query?: string;
	rewrittenQuery?: string;

	// Search operations
	searchType?: 'vector' | 'fts' | 'hybrid';
	namespace?: string;
	topK?: number;
	resultCount?: number;
	results?: Array<{
		id: string;
		score: number;
		preview?: string;
	}>;

	// RRF Fusion
	inputCounts?: { vector: number; fts: number };
	fusedCount?: number;

	// Reranking
	rerankModel?: string;
	inputCount?: number;
	outputCount?: number;
	scores?: number[];

	// Prompt building
	promptLength?: number;
	systemPromptPreview?: string;
	userPromptPreview?: string;
	contextSections?: string[];

	// LLM calls
	model?: string;
	provider?: string;
	inputTokens?: number;
	outputTokens?: number;
	responsePreview?: string;

	// Cost tracking
	operation?: string;
	costUsd?: number;
	credits?: number;

	// Flow steps
	nodeId?: string;
	nodeName?: string;
	nodeType?: string;
	inputs?: Record<string, unknown>;
	outputs?: Record<string, unknown>;

	// Generic payload
	[key: string]: unknown;
}

export interface DebugLogger {
	enabled: boolean;
	log: (type: DebugEventType, data: DebugEventData) => Promise<void>;
	logCost: (event: {
		operation: string;
		modelId?: string;
		tokens?: { input: number; output: number };
		costUsd: number;
		credits: number;
	}) => Promise<void>;
	startTimer: () => () => number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a debug logger that conditionally emits debug events
 *
 * @param sendEvent - SSE event sender function
 * @param enabled - Whether debug mode is enabled (agent.status == "development")
 */
export function createDebugLogger(
	sendEvent: (event: string, data: unknown) => Promise<void>,
	enabled: boolean
): DebugLogger {
	const log = async (type: DebugEventType, data: DebugEventData): Promise<void> => {
		if (!enabled) return;

		await sendEvent('debug', {
			type,
			timestamp: Date.now(),
			...data
		});
	};

	const logCost = async (event: {
		operation: string;
		modelId?: string;
		tokens?: { input: number; output: number };
		costUsd: number;
		credits: number;
	}): Promise<void> => {
		if (!enabled) return;

		await sendEvent('debug', {
			type: 'cost_event',
			timestamp: Date.now(),
			operation: event.operation,
			model: event.modelId,
			inputTokens: event.tokens?.input,
			outputTokens: event.tokens?.output,
			costUsd: event.costUsd,
			credits: event.credits
		});
	};

	/**
	 * Start a timer for measuring operation duration
	 * Returns a function that, when called, returns elapsed ms
	 */
	const startTimer = (): (() => number) => {
		const start = Date.now();
		return () => Date.now() - start;
	};

	return {
		enabled,
		log,
		logCost,
		startTimer
	};
}
