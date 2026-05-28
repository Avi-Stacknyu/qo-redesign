/**
 * Error Utilities Tests
 *
 * Tests for error classes.
 */

import { describe, it, expect } from 'vitest';
import {
	AppError,
	AIModelError,
	ConfigError,
	ValidationError,
	classifyProviderError
} from '../../utils/errors';

// ============================================================================
// AppError
// ============================================================================

describe('AppError', () => {
	it('preserves code, message, statusCode, context', () => {
		const err = new AppError('something broke', {
			code: 'BROKE',
			statusCode: 502,
			context: { key: 'value' }
		});

		expect(err.message).toBe('something broke');
		expect(err.code).toBe('BROKE');
		expect(err.statusCode).toBe(502);
		expect(err.context).toEqual({ key: 'value' });
		expect(err.retriable).toBe(false);
		expect(err.name).toBe('AppError');
		expect(err).toBeInstanceOf(Error);
	});

	it('uses sensible defaults', () => {
		const err = new AppError('default error');

		expect(err.code).toBe('INTERNAL_ERROR');
		expect(err.statusCode).toBe(500);
		expect(err.retriable).toBe(false);
		expect(err.context).toEqual({});
	});

	it('toJSON() serializes all properties including cause', () => {
		const cause = new Error('root cause');
		const err = new AppError('wrapped', {
			code: 'WRAP',
			cause,
			statusCode: 503,
			context: { extra: true }
		});

		const json = err.toJSON();

		expect(json.name).toBe('AppError');
		expect(json.code).toBe('WRAP');
		expect(json.message).toBe('wrapped');
		expect(json.statusCode).toBe(503);
		expect(json.context).toEqual({ extra: true });
		expect((json.cause as any).name).toBe('Error');
		expect((json.cause as any).message).toBe('root cause');
		expect(json.stack).toBeDefined();
	});

	it('toJSON() handles non-Error cause', () => {
		const err = new AppError('test', { cause: 'string cause' });
		const json = err.toJSON();
		expect(json.cause).toBe('string cause');
	});
});

// ============================================================================
// Specialized Error Classes
// ============================================================================

describe('AIModelError', () => {
	it('sets correct defaults and includes provider/modelId', () => {
		const err = new AIModelError('model failed', {
			provider: 'openai',
			modelId: 'gpt-4.1'
		});

		expect(err.name).toBe('AIModelError');
		expect(err.code).toBe('AI_MODEL_ERROR');
		expect(err.context.provider).toBe('openai');
		expect(err.context.modelId).toBe('gpt-4.1');
		expect(err).toBeInstanceOf(AppError);
	});
});

describe('ConfigError', () => {
	it('includes configKey context and defaults to 500', () => {
		const err = new ConfigError('missing config', {
			configKey: 'embedding_model'
		});

		expect(err.name).toBe('ConfigError');
		expect(err.code).toBe('CONFIG_ERROR');
		expect(err.statusCode).toBe(500);
		expect(err.context.configKey).toBe('embedding_model');
		expect(err).toBeInstanceOf(AppError);
	});
});

describe('ValidationError', () => {
	it('defaults to status 400 and retriable=false', () => {
		const err = new ValidationError('invalid email', {
			field: 'email'
		});

		expect(err.name).toBe('ValidationError');
		expect(err.code).toBe('VALIDATION_ERROR');
		expect(err.statusCode).toBe(400);
		expect(err.retriable).toBe(false);
		expect(err.context.field).toBe('email');
		expect(err).toBeInstanceOf(AppError);
	});
});

// ============================================================================
// classifyProviderError
// ============================================================================

describe('classifyProviderError', () => {
	it('classifies 401 as auth error', () => {
		const result = classifyProviderError(new Error('401 Unauthorized'));
		expect(result.category).toBe('auth');
		expect(result.retriable).toBe(false);
		expect(result.userMessage).toContain('temporarily unavailable');
	});

	it('classifies API key errors as auth', () => {
		const result = classifyProviderError(new Error('Incorrect API key provided'));
		expect(result.category).toBe('auth');
	});

	it('classifies 429 as rate limit', () => {
		const result = classifyProviderError(new Error('429 Too Many Requests'));
		expect(result.category).toBe('rate_limit');
		expect(result.retriable).toBe(true);
		expect(result.userMessage).toContain('high demand');
	});

	it('classifies rate limit text', () => {
		const result = classifyProviderError(new Error('Rate limit exceeded, please retry'));
		expect(result.category).toBe('rate_limit');
	});

	it('classifies 500 as provider down', () => {
		const result = classifyProviderError(new Error('500 Internal Server Error'));
		expect(result.category).toBe('provider_down');
		expect(result.retriable).toBe(true);
	});

	it('classifies network errors as provider down', () => {
		const result = classifyProviderError(new Error('fetch failed'));
		expect(result.category).toBe('provider_down');
		expect(result.retriable).toBe(true);
	});

	it('classifies content filter errors', () => {
		const result = classifyProviderError(new Error('Content filter triggered'));
		expect(result.category).toBe('content_filter');
		expect(result.retriable).toBe(false);
	});

	it('classifies context length errors', () => {
		const result = classifyProviderError(new Error('Maximum context length exceeded'));
		expect(result.category).toBe('context_length');
		expect(result.retriable).toBe(false);
	});

	it('classifies 404 model not found', () => {
		const result = classifyProviderError(new Error('404 Model not found'));
		expect(result.category).toBe('model_unavailable');
		expect(result.retriable).toBe(false);
	});

	it('classifies unknown errors with friendly fallback', () => {
		const result = classifyProviderError(new Error('something weird happened'));
		expect(result.category).toBe('unknown');
		expect(result.retriable).toBe(true);
		expect(result.userMessage).toContain('went wrong');
	});

	it('handles non-Error values', () => {
		const result = classifyProviderError('string error');
		expect(result.category).toBe('unknown');
		expect(result.userMessage).toBeDefined();
	});

	it('extracts status from error objects with statusCode', () => {
		const error = Object.assign(new Error('bad'), { statusCode: 403 });
		const result = classifyProviderError(error);
		expect(result.category).toBe('auth');
	});
});
