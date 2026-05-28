/**
 * Structured Logger
 *
 * Lightweight internal logging utility that leverages Cloudflare Workers'
 * built-in observability. All console.log/warn/error output is automatically
 * captured by CF Workers Logs when observability.logs.enabled = true
 * (already configured in wrangler.jsonc with head_sampling_rate: 1).
 *
 * Features:
 * - Structured JSON output for every log (queryable in CF dashboard)
 * - Automatic context propagation (requestId, userId, service)
 * - Log levels with filtering support
 * - Duration tracking for operations
 * - Child loggers for sub-operations
 *
 * Usage:
 *   const log = createLogger('RAGService', { requestId, userId });
 *   log.info('query_start', { query: 'portfolio allocation' });
 *   const done = log.time('vector_search');
 *   // ... do work ...
 *   done({ resultCount: 42 });
 *   log.error('search_failed', { error: err });
 */

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

export interface LogContext {
	/** Unique request ID for tracing across services */
	requestId?: string;
	/** User ID for user-scoped operations */
	userId?: string;
	/** Agent or chat ID */
	agentId?: string;
	/** Message ID being processed */
	messageId?: string;
	/** Any additional static context */
	[key: string]: unknown;
}

export interface Logger {
	debug: (event: string, data?: Record<string, unknown>) => void;
	info: (event: string, data?: Record<string, unknown>) => void;
	warn: (event: string, data?: Record<string, unknown>) => void;
	error: (event: string, data?: Record<string, unknown>) => void;
	/** Start a timer. Returns a fn that, when called, logs the duration and returns elapsed ms. */
	time: (
		event: string,
		data?: Record<string, unknown>
	) => (endData?: Record<string, unknown>) => number;
	/** Create a child logger with additional context */
	child: (childService: string, additionalContext?: LogContext) => Logger;
}

export interface LogEntry extends LogContext {
	level: LogLevel;
	service: string;
	event: string;
	ts: number;
}

export type LogEventSink = (entry: LogEntry) => void;

// ============================================================================
// Configuration
// ============================================================================

/** Minimum log level — anything below is silently dropped. */
let globalMinLevel: LogLevel = 'debug';

let logEventSink: LogEventSink | null = null;

/**
 * Set the global minimum log level.
 * In production you might call `setLogLevel('info')` to suppress debug noise.
 */
export function setLogLevel(level: LogLevel): void {
	globalMinLevel = level;
}

export function setLogEventSink(sink: LogEventSink | null): void {
	logEventSink = sink;
}

// ============================================================================
// Implementation
// ============================================================================

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[globalMinLevel];
}

function emit(
	level: LogLevel,
	service: string,
	event: string,
	ctx: LogContext,
	data?: Record<string, unknown>
): void {
	if (!shouldLog(level)) return;

	const entry: LogEntry = {
		level,
		service,
		event,
		ts: Date.now(),
		...ctx,
		...data
	};

	if (level === 'warn' || level === 'error') {
		logEventSink?.(entry);
	}

	switch (level) {
		case 'debug':
		case 'info':
			console.log(JSON.stringify(entry));
			break;
		case 'warn':
			console.warn(JSON.stringify(entry));
			break;
		case 'error':
			console.error(JSON.stringify(entry));
			break;
	}
}

/**
 * Create a structured logger for a service / subsystem.
 *
 * @param service - Name of the service (e.g. 'RAGService', 'CostTracker', 'FlowExecutor')
 * @param context - Static context attached to every log entry
 */
export function createLogger(service: string, context: LogContext = {}): Logger {
	const log: Logger = {
		debug: (event, data) => emit('debug', service, event, context, data),
		info: (event, data) => emit('info', service, event, context, data),
		warn: (event, data) => emit('warn', service, event, context, data),
		error: (event, data) => emit('error', service, event, context, data),

		time(event, data) {
			const start = performance.now();
			emit('debug', service, `${event}_start`, context, data);

			return (endData?: Record<string, unknown>) => {
				const durationMs = Math.round(performance.now() - start);
				emit('info', service, `${event}_done`, context, {
					...data,
					...endData,
					durationMs
				});
				return durationMs;
			};
		},

		child(childService, additionalContext = {}) {
			return createLogger(`${service}.${childService}`, {
				...context,
				...additionalContext
			});
		}
	};

	return log;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format an error for structured logging.
 * Extracts message, stack, and any custom properties.
 */
export function formatError(err: unknown): Record<string, unknown> {
	if (err instanceof Error) {
		return {
			errorMessage: err.message,
			errorName: err.name,
			errorStack: err.stack,
			...(err as any).context // picks up AppError.context
		};
	}
	return { errorMessage: String(err) };
}
