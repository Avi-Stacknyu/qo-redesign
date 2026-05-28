/**
 * Error Handling Utilities
 *
 * Structured error classes and helpers for consistent error handling,
 * tracing, and observability across the entire CF Worker codebase.
 *
 * Features:
 * - Typed error classes with structured context
 * - Error wrapping (preserve original cause chain)
 * - HTTP-aware errors for API responses
 * - Retry helpers with backoff
 * - Safe execution wrappers
 *
 * Usage:
 *   throw new AppError('Failed to load config', {
 *     code: 'CONFIG_LOAD_FAILED',
 *     cause: originalError,
 *     context: { configKey: 'embedding_model' },
 *     statusCode: 500,
 *   });
 *
 *   const result = await trySafe(() => riskyCall(), 'fallback');
 */

// ============================================================================
// Error Classes
// ============================================================================

export interface AppErrorOptions {
	/** Machine-readable error code for programmatic handling */
	code?: string;
	/** The original error that caused this one */
	cause?: unknown;
	/** Structured context for logging/debugging */
	context?: Record<string, unknown>;
	/** HTTP status code (for API error responses) */
	statusCode?: number;
	/** Whether this error is retriable */
	retriable?: boolean;
}

/**
 * Base application error with structured context and cause chain.
 * Always prefer this over bare `new Error()`.
 */
export class AppError extends Error {
	readonly code: string;
	readonly context: Record<string, unknown>;
	readonly statusCode: number;
	readonly retriable: boolean;
	override readonly cause?: unknown;

	constructor(message: string, options: AppErrorOptions = {}) {
		super(message);
		this.name = 'AppError';
		this.code = options.code ?? 'INTERNAL_ERROR';
		this.cause = options.cause;
		this.context = options.context ?? {};
		this.statusCode = options.statusCode ?? 500;
		this.retriable = options.retriable ?? false;
	}

	/** Serialize for structured logging */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			statusCode: this.statusCode,
			retriable: this.retriable,
			context: this.context,
			cause:
				this.cause instanceof Error
					? { name: this.cause.name, message: this.cause.message, stack: this.cause.stack }
					: this.cause,
			stack: this.stack
		};
	}
}

/**
 * Error thrown when an AI model call fails.
 */
export class AIModelError extends AppError {
	constructor(
		message: string,
		options: AppErrorOptions & { provider?: string; modelId?: string } = {}
	) {
		super(message, {
			...options,
			code: options.code ?? 'AI_MODEL_ERROR',
			context: {
				...options.context,
				provider: options.provider,
				modelId: options.modelId
			}
		});
		this.name = 'AIModelError';
	}
}

/**
 * Error thrown when configuration is missing or invalid.
 */
export class ConfigError extends AppError {
	constructor(message: string, options: AppErrorOptions & { configKey?: string } = {}) {
		super(message, {
			...options,
			code: options.code ?? 'CONFIG_ERROR',
			statusCode: options.statusCode ?? 500,
			context: {
				...options.context,
				configKey: options.configKey
			}
		});
		this.name = 'ConfigError';
	}
}

/**
 * Error thrown for validation failures.
 */
export class ValidationError extends AppError {
	constructor(message: string, options: AppErrorOptions & { field?: string } = {}) {
		super(message, {
			...options,
			code: options.code ?? 'VALIDATION_ERROR',
			statusCode: options.statusCode ?? 400,
			retriable: false,
			context: {
				...options.context,
				field: options.field
			}
		});
		this.name = 'ValidationError';
	}
}

// ============================================================================
// Provider Error Classification
// ============================================================================

export interface ClassifiedError {
	/** User-facing message — safe to display in the chat UI. */
	userMessage: string;
	/** Machine-readable category for programmatic handling. */
	category:
		| 'auth'
		| 'rate_limit'
		| 'provider_down'
		| 'model_unavailable'
		| 'content_filter'
		| 'context_length'
		| 'timeout'
		| 'structured_output_unsupported'
		| 'unknown';
	/** Whether the request can be retried. */
	retriable: boolean;
}

/**
 * Classify an AI provider error into a user-friendly message.
 * Detects 401/403 (auth), 429 (rate limit), 5xx (provider down),
 * content filter, context length, and model unavailability errors.
 */
export function classifyProviderError(error: unknown): ClassifiedError {
	// Handle our own structured errors first — map internal error codes
	// to generic user-facing messages without leaking system details.
	if (error instanceof AppError) {
		switch (error.code) {
			case 'NO_MODEL_RESOLVED':
			case 'PINNED_MODEL_NOT_RESOLVED':
			case 'AI_MODEL_ERROR':
				return {
					userMessage:
						'The AI service is temporarily unavailable due to a configuration issue. Please try again later.',
					category: 'model_unavailable',
					retriable: false
				};
			case 'CONFIG_ERROR':
			case 'CONFIG_LOAD_FAILED':
				return {
					userMessage:
						'The AI service is temporarily unavailable due to a configuration issue. Please try again later.',
					category: 'unknown',
					retriable: false
				};
			case 'FLOW_ABORTED':
				return {
					userMessage: 'The request was cancelled.',
					category: 'unknown',
					retriable: true
				};
		}
	}

	const msg = error instanceof Error ? error.message : String(error);
	const lower = msg.toLowerCase();

	// Extract HTTP status from APICallError-style messages
	const statusMatch = msg.match(/^(\d{3})\s/);
	const status = statusMatch ? parseInt(statusMatch[1], 10) : extractStatusFromError(error);

	// Auth errors (revoked/invalid API key)
	if (
		status === 401 ||
		status === 403 ||
		lower.includes('api key') ||
		lower.includes('unauthorized') ||
		lower.includes('forbidden') ||
		lower.includes('authentication')
	) {
		return {
			userMessage:
				'The AI service is temporarily unavailable due to a configuration issue. Please try again later.',
			category: 'auth',
			retriable: false
		};
	}

	// Rate limiting / high demand
	if (
		status === 429 ||
		lower.includes('rate limit') ||
		lower.includes('too many requests') ||
		lower.includes('quota exceeded') ||
		lower.includes('high demand') ||
		lower.includes('overloaded')
	) {
		return {
			userMessage:
				'The AI service is currently experiencing high demand. Please wait a moment and try again.',
			category: 'rate_limit',
			retriable: true
		};
	}

	// Content filter / safety
	if (
		lower.includes('content filter') ||
		lower.includes('content_filter') ||
		lower.includes('safety') ||
		lower.includes('blocked') ||
		lower.includes('harmful')
	) {
		return {
			userMessage:
				'Your message was flagged by the AI safety filter. Please rephrase and try again.',
			category: 'content_filter',
			retriable: false
		};
	}

	// Context length exceeded
	if (
		lower.includes('context length') ||
		lower.includes('token limit') ||
		lower.includes('maximum context') ||
		lower.includes('too long') ||
		lower.includes('max_tokens')
	) {
		return {
			userMessage:
				'The conversation is too long for the current model. Please start a new chat or try a model with a larger context window.',
			category: 'context_length',
			retriable: false
		};
	}

	// Model not found / unavailable
	if (
		status === 404 ||
		lower.includes('model not found') ||
		lower.includes('does not exist') ||
		lower.includes('not available') ||
		lower.includes('no such model') ||
		lower.includes('decommissioned')
	) {
		return {
			userMessage: 'The selected model is temporarily unavailable. Please try a different model.',
			category: 'model_unavailable',
			retriable: false
		};
	}

	// Provider down (5xx)
	if (
		(status && status >= 500) ||
		lower.includes('internal server error') ||
		lower.includes('service unavailable') ||
		lower.includes('bad gateway') ||
		lower.includes('gateway timeout')
	) {
		return {
			userMessage: 'The AI service is temporarily unavailable. Please try again in a few moments.',
			category: 'provider_down',
			retriable: true
		};
	}

	// Timeout errors
	if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('aborted')) {
		return {
			userMessage: 'The request timed out. Please try again.',
			category: 'timeout',
			retriable: true
		};
	}

	// Network / connection errors
	if (
		lower.includes('network') ||
		lower.includes('econnrefused') ||
		lower.includes('econnreset') ||
		lower.includes('fetch failed')
	) {
		return {
			userMessage: 'Unable to reach the AI service. Please check your connection and try again.',
			category: 'provider_down',
			retriable: true
		};
	}

	// Unknown / generic fallback
	return {
		userMessage: 'Something went wrong while processing your request. Please try again.',
		category: 'unknown',
		retriable: true
	};
}

/** Extract HTTP status from error objects that may have a status/statusCode property. */
function extractStatusFromError(error: unknown): number | null {
	if (!error || typeof error !== 'object') return null;
	const e = error as Record<string, unknown>;
	if (typeof e.statusCode === 'number') return e.statusCode;
	if (typeof e.status === 'number') return e.status;
	return null;
}
