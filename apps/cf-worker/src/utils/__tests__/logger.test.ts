/**
 * Logger Utility Tests
 *
 * Tests for createLogger, setLogLevel, formatError, and Logger methods.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, setLogLevel, formatError, setLogEventSink } from '../../utils/logger';
import { AppError } from '../../utils/errors';

describe('createLogger', () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		// Reset to debug so all levels emit
		setLogLevel('debug');
	});

	afterEach(() => {
		logSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
		setLogEventSink(null);
	});

	it('returns Logger with all methods', () => {
		const log = createLogger('TestService');

		expect(typeof log.debug).toBe('function');
		expect(typeof log.info).toBe('function');
		expect(typeof log.warn).toBe('function');
		expect(typeof log.error).toBe('function');
		expect(typeof log.time).toBe('function');
		expect(typeof log.child).toBe('function');
	});

	it('log.info emits structured JSON to console.log', () => {
		const log = createLogger('TestService', { userId: 'u1' });
		log.info('test_event', { extra: 'data' });

		expect(logSpy).toHaveBeenCalledOnce();
		const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(entry.level).toBe('info');
		expect(entry.service).toBe('TestService');
		expect(entry.event).toBe('test_event');
		expect(entry.userId).toBe('u1');
		expect(entry.extra).toBe('data');
		expect(entry.ts).toBeTypeOf('number');
	});

	it('log.error emits to console.error', () => {
		const log = createLogger('Svc');
		log.error('bad_thing', { code: 'ERR' });

		expect(errorSpy).toHaveBeenCalledOnce();
		const entry = JSON.parse(errorSpy.mock.calls[0][0] as string);
		expect(entry.level).toBe('error');
		expect(entry.event).toBe('bad_thing');
	});

	it('log.warn emits to console.warn', () => {
		const log = createLogger('Svc');
		log.warn('caution', { detail: 'x' });

		expect(warnSpy).toHaveBeenCalledOnce();
		const entry = JSON.parse(warnSpy.mock.calls[0][0] as string);
		expect(entry.level).toBe('warn');
		expect(entry.event).toBe('caution');
	});

	it('forwards only warn and error entries to the log event sink', () => {
		const sink = vi.fn();
		setLogEventSink(sink);
		const log = createLogger('Svc', { userId: 'u1' });

		log.debug('debug_event');
		log.info('info_event');
		log.warn('warn_event', { warningCode: 'W1' });
		log.error('error_event', { errorMessage: 'boom' });

		expect(sink).toHaveBeenCalledTimes(2);
		expect(sink).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				level: 'warn',
				service: 'Svc',
				event: 'warn_event',
				userId: 'u1',
				warningCode: 'W1'
			})
		);
		expect(sink).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				level: 'error',
				service: 'Svc',
				event: 'error_event',
				userId: 'u1',
				errorMessage: 'boom'
			})
		);
	});

	it('log.debug emits to console.log when level=debug', () => {
		setLogLevel('debug');
		const log = createLogger('Svc');
		log.debug('verbose', { val: 1 });

		expect(logSpy).toHaveBeenCalled();
		const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(entry.level).toBe('debug');
	});

	it('log.debug is suppressed when setLogLevel("info")', () => {
		setLogLevel('info');
		const log = createLogger('Svc');
		log.debug('should_not_appear');

		// debug should not trigger console.log
		expect(logSpy).not.toHaveBeenCalled();
	});

	it('Logger includes service name and context in output', () => {
		const log = createLogger('MyService', { requestId: 'req-1', userId: 'u-2' });
		log.info('check');

		const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(entry.service).toBe('MyService');
		expect(entry.requestId).toBe('req-1');
		expect(entry.userId).toBe('u-2');
	});

	it('log.time tracks duration and emits start/done events', () => {
		const log = createLogger('Svc');
		const done = log.time('operation');

		// Start event
		expect(logSpy).toHaveBeenCalledOnce();
		const startEntry = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(startEntry.event).toBe('operation_start');
		expect(startEntry.level).toBe('debug');

		// Complete
		const durationMs = done({ resultCount: 5 });

		expect(durationMs).toBeTypeOf('number');
		expect(durationMs).toBeGreaterThanOrEqual(0);

		// Done event (second call)
		expect(logSpy).toHaveBeenCalledTimes(2);
		const doneEntry = JSON.parse(logSpy.mock.calls[1][0] as string);
		expect(doneEntry.event).toBe('operation_done');
		expect(doneEntry.level).toBe('info');
		expect(doneEntry.durationMs).toBeTypeOf('number');
		expect(doneEntry.resultCount).toBe(5);
	});

	it('Logger.child creates child with merged context', () => {
		const parent = createLogger('Parent', { requestId: 'req-1' });
		const child = parent.child('SubOp', { step: 'validation' });

		child.info('child_event');

		const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
		expect(entry.service).toBe('Parent.SubOp');
		expect(entry.requestId).toBe('req-1');
		expect(entry.step).toBe('validation');
	});
});

// ============================================================================
// formatError
// ============================================================================

describe('formatError', () => {
	it('extracts Error properties', () => {
		const err = new Error('test error');
		const formatted = formatError(err);

		expect(formatted.errorMessage).toBe('test error');
		expect(formatted.errorName).toBe('Error');
		expect(formatted.errorStack).toBeTypeOf('string');
	});

	it('handles non-Error values', () => {
		expect(formatError('just a string')).toEqual({ errorMessage: 'just a string' });
		expect(formatError(42)).toEqual({ errorMessage: '42' });
		expect(formatError(null)).toEqual({ errorMessage: 'null' });
	});

	it('includes AppError context', () => {
		const err = new AppError('app err', { context: { key: 'val' } });
		const formatted = formatError(err);

		expect(formatted.errorMessage).toBe('app err');
		expect(formatted.errorName).toBe('AppError');
		expect(formatted.key).toBe('val');
	});
});

// ============================================================================
// setLogLevel
// ============================================================================

describe('setLogLevel', () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		setLogLevel('debug'); // reset
	});

	it('changes minimum level globally', () => {
		setLogLevel('warn');
		const log = createLogger('Svc');

		log.debug('no');
		log.info('no');
		log.warn('yes');

		// Only warn should have emitted (to console.warn)
		expect(logSpy).not.toHaveBeenCalled(); // debug/info go to console.log
	});
});
