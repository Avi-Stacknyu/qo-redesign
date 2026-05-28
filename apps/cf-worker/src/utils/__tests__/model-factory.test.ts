/**
 * Model Factory Tests
 *
 * Tests for getModel, getEmbeddingModel, loadInfraConfigs,
 * getModelConfig, clearConfigCache, documentToMarkdown.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getModel,
	getEmbeddingModel,
	loadInfraConfigs,
	getModelConfig,
	clearConfigCache,
	getConfigPricing,
	documentToMarkdown,
	type InfraModelConfig
} from '../../utils/model-factory';
import { AIModelError, ConfigError } from '../../utils/errors';
import { createMockEnv, createMockDb } from '../../__tests__/setup';

// ============================================================================
// getModel
// ============================================================================

describe('getModel', () => {
	const env = createMockEnv() as any;

	it('returns a LanguageModel for openai', () => {
		const model = getModel('openai', 'gpt-4.1', env);
		expect(model).toBeDefined();
		expect((model as any).modelId).toBe('gpt-4.1');
	});

	it('returns a LanguageModel for anthropic', () => {
		const model = getModel('anthropic', 'claude-sonnet-4-20250514', env);
		expect(model).toBeDefined();
		expect((model as any).modelId).toBe('claude-sonnet-4-20250514');
	});

	it('returns a LanguageModel for google', () => {
		const model = getModel('google', 'gemini-2.5-pro', env);
		expect(model).toBeDefined();
		expect((model as any).modelId).toBe('gemini-2.5-pro');
	});

	it('returns a LanguageModel for xai', () => {
		const model = getModel('xai', 'grok-3', env);
		expect(model).toBeDefined();
		expect((model as any).modelId).toBe('grok-3');
	});

	it('returns a LanguageModel for cloudflare', () => {
		const model = getModel('cloudflare', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', env);
		expect(model).toBeDefined();
	});

	it('is case insensitive', () => {
		const model = getModel('OpenAI', 'gpt-4.1', env);
		expect(model).toBeDefined();
	});

	it('throws AIModelError for unsupported provider', () => {
		expect(() => getModel('unsupported', 'model-1', env)).toThrow(AIModelError);
		try {
			getModel('badprovider', 'model-x', env);
		} catch (e) {
			expect(e).toBeInstanceOf(AIModelError);
			expect((e as AIModelError).code).toBe('UNSUPPORTED_PROVIDER');
			expect((e as AIModelError).context.provider).toBe('badprovider');
		}
	});
});

// ============================================================================
// getEmbeddingModel
// ============================================================================

describe('getEmbeddingModel', () => {
	const env = createMockEnv() as any;

	it('returns an EmbeddingModel for cloudflare', () => {
		const model = getEmbeddingModel('cloudflare', '@cf/baai/bge-base-en-v1.5', env);
		expect(model).toBeDefined();
	});

	it('returns an EmbeddingModel for openai', () => {
		const model = getEmbeddingModel('openai', 'text-embedding-3-small', env);
		expect(model).toBeDefined();
	});

	it('throws AIModelError for unsupported provider', () => {
		expect(() => getEmbeddingModel('unsupported', 'model-1', env)).toThrow(AIModelError);
		try {
			getEmbeddingModel('mystery', 'model-x', env);
		} catch (e) {
			expect((e as AIModelError).code).toBe('UNSUPPORTED_EMBEDDING_PROVIDER');
		}
	});
});

// ============================================================================
// loadInfraConfigs
// ============================================================================

describe('loadInfraConfigs', () => {
	beforeEach(() => {
		clearConfigCache();
	});

	it('fetches active configs from DB and caches them', async () => {
		const mockDb = createMockDb();
		mockDb.then.mockImplementation((resolve: any) =>
			resolve([
				{
					model: {
						id: '1',
						configKey: 'embedding_model',
						modelId: '@cf/baai/bge-base-en-v1.5',
						displayName: 'BGE Base',
						serviceType: 'embedding',
						isActive: true
					},
					provider: null,
					pricing: null
				}
			])
		);

		const result = await loadInfraConfigs(mockDb as any);

		expect(result.size).toBe(2); // indexed by both config_key and model_id
		expect(result.get('embedding_model')).toBeDefined();
		expect(result.get('@cf/baai/bge-base-en-v1.5')).toBeDefined();
	});

	it('returns cached results on second call', async () => {
		const mockDb = createMockDb();

		await loadInfraConfigs(mockDb as any);
		await loadInfraConfigs(mockDb as any);

		expect(mockDb.select).toHaveBeenCalledOnce();
	});

	it('throws ConfigError on any DB failure', async () => {
		const mockDb = createMockDb();
		mockDb.then.mockImplementation((_resolve: any, reject: any) => reject(new Error('network')));

		clearConfigCache();
		await expect(loadInfraConfigs(mockDb as any)).rejects.toThrow(ConfigError);
	});
});

// ============================================================================
// getModelConfig
// ============================================================================

describe('getModelConfig', () => {
	beforeEach(() => {
		clearConfigCache();
	});

	it('returns config for valid key', async () => {
		const mockDb = createMockDb();
		mockDb.then.mockImplementation((resolve: any) =>
			resolve([
				{
					model: {
						id: '1',
						configKey: 'test_model',
						modelId: '@cf/test/model',
						displayName: 'Test',
						serviceType: 'generation',
						isActive: true
					},
					provider: null,
					pricing: null
				}
			])
		);

		const result = await getModelConfig(mockDb as any, 'test_model');
		expect(result.config_key).toBe('test_model');
	});

	it('throws ConfigError for missing key', async () => {
		const mockDb = createMockDb();

		await expect(getModelConfig(mockDb as any, 'nonexistent')).rejects.toThrow(ConfigError);
		try {
			clearConfigCache();
			await getModelConfig(mockDb as any, 'nonexistent');
		} catch (e) {
			expect((e as ConfigError).code).toBe('INFRA_CONFIG_NOT_FOUND');
			expect((e as ConfigError).context.configKey).toBe('nonexistent');
		}
	});
});

// ============================================================================
// getConfigPricing
// ============================================================================

describe('getConfigPricing', () => {
	it('returns pricing when expanded', () => {
		const config = {
			pricingRate: { id: 'p1', rate_name: 'test', input_price_per_1m: 0.1 }
		} as any;
		expect(getConfigPricing(config)).toEqual(config.pricingRate);
	});

	it('returns null when no pricing', () => {
		const config = {} as any;
		expect(getConfigPricing(config)).toBeNull();
	});
});

// ============================================================================
// clearConfigCache
// ============================================================================

describe('clearConfigCache', () => {
	it('forces reload on next call', async () => {
		// Clear any cached results from prior tests
		clearConfigCache();

		const mockDb = createMockDb();

		await loadInfraConfigs(mockDb as any);
		clearConfigCache();
		await loadInfraConfigs(mockDb as any);

		expect(mockDb.select).toHaveBeenCalledTimes(2);
	});
});

// ============================================================================
// documentToMarkdown
// ============================================================================

describe('documentToMarkdown', () => {
	it('calls env.AI.toMarkdown and returns formatted results with tokens', async () => {
		const mockEnv = {
			AI: {
				toMarkdown: vi
					.fn()
					.mockResolvedValue([
						{ name: 'doc.pdf', data: '# Hello World', tokens: 42, metadata: { pages: 1 } }
					])
			}
		};

		const result = await documentToMarkdown(mockEnv as any, [
			{ name: 'doc.pdf', blob: new Blob(['content']) }
		]);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('doc.pdf');
		expect(result[0].content).toBe('# Hello World');
		expect(result[0].tokens).toBe(42);
		expect(result[0].metadata).toEqual({ pages: 1 });
	});

	it('handles empty response', async () => {
		const mockEnv = {
			AI: { toMarkdown: vi.fn().mockResolvedValue(null) }
		};

		const result = await documentToMarkdown(mockEnv as any, []);
		expect(result).toEqual([]);
	});
});
