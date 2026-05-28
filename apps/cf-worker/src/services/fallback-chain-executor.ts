import type { ErrorCategory } from '../types/extraction';

export interface ChainModelEntry {
	modelId: string;
	provider: string;
	priority: number;
	temperature: number;
	maxTokens: number;
	timeoutMs: number;
	retryCount: number;
}

export interface RetryStep {
	modelId: string;
	provider: string;
	priority: number;
	attempt: number;
	temperature: number;
	maxTokens: number;
	timeoutMs: number;
}

const RETRIABLE_CATEGORIES: Set<ErrorCategory> = new Set(['rate_limit', 'timeout', 'unknown']);

const SKIP_TO_NEXT_CATEGORIES: Set<ErrorCategory> = new Set(['auth', 'provider_down']);

const ABORT_CATEGORIES: Set<ErrorCategory> = new Set(['content_filter']);

export function classifyErrorForChain(error: unknown): ErrorCategory {
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		const status = (error as { status?: number }).status;

		if (status === 401 || status === 403) return 'auth';
		if (status === 429) return 'rate_limit';
		if (status && status >= 500) return 'provider_down';
		if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('aborted'))
			return 'timeout';
		if (msg.includes('content') && msg.includes('filter')) return 'content_filter';
		if (msg.includes('context') && msg.includes('length')) return 'context_length';
	}
	return 'unknown';
}

export function shouldRetry(
	category: ErrorCategory,
	currentAttempt: number,
	maxAttempts: number
): boolean {
	if (ABORT_CATEGORIES.has(category)) return false;
	if (SKIP_TO_NEXT_CATEGORIES.has(category)) return false;
	return currentAttempt < maxAttempts && RETRIABLE_CATEGORIES.has(category);
}

export function shouldSkipToNext(category: ErrorCategory): boolean {
	return SKIP_TO_NEXT_CATEGORIES.has(category);
}

export function shouldAbort(category: ErrorCategory): boolean {
	return ABORT_CATEGORIES.has(category);
}

export function buildRetryPlan(chain: ChainModelEntry[]): RetryStep[] {
	const steps: RetryStep[] = [];
	const sorted = [...chain].sort((a, b) => a.priority - b.priority);

	for (const entry of sorted) {
		for (let attempt = 1; attempt <= entry.retryCount; attempt++) {
			steps.push({
				modelId: entry.modelId,
				provider: entry.provider,
				priority: entry.priority,
				attempt,
				temperature: entry.temperature,
				maxTokens: entry.maxTokens,
				timeoutMs: entry.timeoutMs
			});
		}
	}

	return steps;
}
