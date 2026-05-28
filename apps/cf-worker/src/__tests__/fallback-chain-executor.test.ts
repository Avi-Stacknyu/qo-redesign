import { describe, it, expect } from 'vitest';
import {
	classifyErrorForChain,
	shouldRetry,
	buildRetryPlan,
	type ChainModelEntry
} from '../services/fallback-chain-executor';

describe('FallbackChainExecutor', () => {
	describe('classifyErrorForChain', () => {
		it('classifies 429 as rate_limit', () => {
			const err = Object.assign(new Error('Too Many Requests'), { status: 429 });
			expect(classifyErrorForChain(err)).toBe('rate_limit');
		});

		it('classifies 401 as auth', () => {
			const err = Object.assign(new Error('Unauthorized'), { status: 401 });
			expect(classifyErrorForChain(err)).toBe('auth');
		});

		it('classifies 500+ as provider_down', () => {
			const err = Object.assign(new Error('Internal Server Error'), { status: 500 });
			expect(classifyErrorForChain(err)).toBe('provider_down');
		});

		it('classifies timeout errors', () => {
			const err = new Error('The operation timed out');
			expect(classifyErrorForChain(err)).toBe('timeout');
		});

		it('classifies unknown errors', () => {
			const err = new Error('Something weird happened');
			expect(classifyErrorForChain(err)).toBe('unknown');
		});
	});

	describe('shouldRetry', () => {
		it('retries rate_limit', () => {
			expect(shouldRetry('rate_limit', 1, 2)).toBe(true);
		});

		it('does not retry content_filter', () => {
			expect(shouldRetry('content_filter', 1, 3)).toBe(false);
		});

		it('does not retry auth', () => {
			expect(shouldRetry('auth', 1, 3)).toBe(false);
		});

		it('does not retry when attempts exhausted', () => {
			expect(shouldRetry('rate_limit', 3, 3)).toBe(false);
		});

		it('retries timeout', () => {
			expect(shouldRetry('timeout', 1, 2)).toBe(true);
		});
	});

	describe('buildRetryPlan', () => {
		const chain: ChainModelEntry[] = [
			{
				modelId: 'claude-sonnet',
				provider: 'anthropic',
				priority: 0,
				temperature: 0.2,
				maxTokens: 2048,
				timeoutMs: 30000,
				retryCount: 2
			},
			{
				modelId: 'gpt-4o-mini',
				provider: 'openai',
				priority: 1,
				temperature: 0.3,
				maxTokens: 2048,
				timeoutMs: 30000,
				retryCount: 1
			},
			{
				modelId: '@cf/meta/llama',
				provider: 'cloudflare',
				priority: 2,
				temperature: 0.1,
				maxTokens: 1024,
				timeoutMs: 30000,
				retryCount: 1
			}
		];

		it('produces correct number of total possible attempts', () => {
			const plan = buildRetryPlan(chain);
			expect(plan.length).toBe(4);
		});

		it('orders by priority then attempt', () => {
			const plan = buildRetryPlan(chain);
			expect(plan[0]).toEqual({
				modelId: 'claude-sonnet',
				provider: 'anthropic',
				priority: 0,
				attempt: 1,
				temperature: 0.2,
				maxTokens: 2048,
				timeoutMs: 30000
			});
			expect(plan[1]).toEqual({
				modelId: 'claude-sonnet',
				provider: 'anthropic',
				priority: 0,
				attempt: 2,
				temperature: 0.2,
				maxTokens: 2048,
				timeoutMs: 30000
			});
			expect(plan[2]).toEqual({
				modelId: 'gpt-4o-mini',
				provider: 'openai',
				priority: 1,
				attempt: 1,
				temperature: 0.3,
				maxTokens: 2048,
				timeoutMs: 30000
			});
			expect(plan[3]).toEqual({
				modelId: '@cf/meta/llama',
				provider: 'cloudflare',
				priority: 2,
				attempt: 1,
				temperature: 0.1,
				maxTokens: 1024,
				timeoutMs: 30000
			});
		});
	});
});
