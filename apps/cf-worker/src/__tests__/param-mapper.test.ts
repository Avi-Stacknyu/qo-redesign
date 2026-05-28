/**
 * Param Mapper Tests
 *
 * Tests the parameter mapping pipeline for all 30 active models.
 * Each model's default_options and options_schema keys are tested
 * to ensure correct mapping to AI SDK standard params and providerOptions.
 */

import { describe, it, expect } from 'vitest';
import { mapProviderOptions, type MappedParams } from '../utils/param-mapper';

// ============================================================================
// Provider mapping (from live DB data)
// ============================================================================

const PROVIDERS = {
	ctgf0yic5md4kyn: 'anthropic',
	'7zfovhpnr2iwc4k': 'openai',
	wie5pczciiuxma5: 'google',
	'5bqp9v0hdvrf9g9': 'xai'
} as const;

// ============================================================================
// Model DB records (30 models, freshly fetched from Postgres)
// ============================================================================

interface ModelRecord {
	id: string;
	model_id: string;
	display_name: string;
	provider_id: keyof typeof PROVIDERS;
	default_options: Record<string, unknown>;
	options_schema_keys: string[];
}

const ANTHROPIC_MODELS: ModelRecord[] = [
	{
		id: 'j8n6td5yqewyl8h',
		model_id: 'claude-opus-4',
		display_name: 'Claude Opus 4',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 8192, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	},
	{
		id: 'cg6gslysm935wqq',
		model_id: 'claude-sonnet-4',
		display_name: 'Claude Sonnet 4',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 8192, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	},
	{
		id: '0mjo9rdkx8qobju',
		model_id: 'claude-sonnet-4-0',
		display_name: 'Claude Sonnet 4.0',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 8192, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	},
	{
		id: 'xkwlia7py2g3i75',
		model_id: 'claude-sonnet-4-5',
		display_name: 'Claude Sonnet 4.5',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 8192, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	},
	{
		id: 'j01w28r8xj8hrse',
		model_id: 'claude-3-7-sonnet',
		display_name: 'Claude 3.7 Sonnet',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 8192, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	},
	{
		id: 'uyrlyktzmyudabt',
		model_id: 'claude-3-5-sonnet-20241022',
		display_name: 'Claude 3.5 Sonnet (Oct 2024)',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 4096, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	},
	{
		id: 'wnujy09ca5f3jk2',
		model_id: 'claude-3-5-sonnet',
		display_name: 'Claude 3.5 Sonnet',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 4096, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	},
	{
		id: '185x6914qzt82cg',
		model_id: 'claude-3-5-sonnet-v2',
		display_name: 'Claude 3.5 Sonnet v2',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 4096, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	},
	{
		id: '6ps8q8cnep0m5o5',
		model_id: 'claude-3-5-sonnet',
		display_name: 'Claude 3.5 Sonnet',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 4096, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	},
	{
		id: '573sjobv8f0h2jl',
		model_id: 'claude-3-opus',
		display_name: 'Claude 3 Opus',
		provider_id: 'ctgf0yic5md4kyn',
		default_options: { max_tokens: 4096, temperature: 1 },
		options_schema_keys: ['max_tokens', 'temperature', 'top_k', 'top_p']
	}
];

const OPENAI_STANDARD_MODELS: ModelRecord[] = [
	{
		id: '6vytm9215wacpe1',
		model_id: 'gpt-5',
		display_name: 'GPT-5',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_tokens: 16384, temperature: 1 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	},
	{
		id: 'yze1w1mkdtu9jy6',
		model_id: 'gpt-5-mini',
		display_name: 'GPT-5 Mini',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_tokens: 8192, temperature: 1 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	},
	{
		id: 'ugsf8sdcbav125i',
		model_id: 'gpt-5-nano',
		display_name: 'GPT-5 Nano',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_tokens: 8192, temperature: 1 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	},
	{
		id: 'b1zvt436hq9ywxx',
		model_id: 'gpt-5.1',
		display_name: 'GPT-5.1',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_tokens: 16384, temperature: 1 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	},
	{
		id: 'ux1xlm0c8nonx7v',
		model_id: 'gpt-4o',
		display_name: 'GPT-4 Omni',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_tokens: 16384, temperature: 1 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	},
	{
		id: 'ntejis1nk41qbd1',
		model_id: 'gpt-4o-mini',
		display_name: 'GPT-4 Omni Mini',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_tokens: 16384, temperature: 1 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	},
	{
		id: 'lo1ibs34qg6f0sj',
		model_id: 'gpt-4.1',
		display_name: 'GPT-4.1',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_tokens: 32768, temperature: 1 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	}
];

const OPENAI_REASONING_MODELS: ModelRecord[] = [
	{
		id: 'l5lt50wld68zl9h',
		model_id: 'o1',
		display_name: 'O1',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_completion_tokens: 32768, reasoning_effort: 'medium' },
		options_schema_keys: ['max_completion_tokens', 'reasoning_effort']
	},
	{
		id: 'rrr4phbon0rsdc7',
		model_id: 'o3',
		display_name: 'O3',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_completion_tokens: 32768, reasoning_effort: 'medium' },
		options_schema_keys: ['max_completion_tokens', 'reasoning_effort']
	},
	{
		id: 'qor1e1597ewry0i',
		model_id: 'o3-mini',
		display_name: 'O3 Mini',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_completion_tokens: 16384, reasoning_effort: 'medium' },
		options_schema_keys: ['max_completion_tokens', 'reasoning_effort']
	},
	{
		id: 'jsnmnytee3e6q4d',
		model_id: 'o4',
		display_name: 'O4',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_completion_tokens: 32768, reasoning_effort: 'medium' },
		options_schema_keys: ['max_completion_tokens', 'reasoning_effort']
	},
	{
		id: 'xgpwblmja0u0z88',
		model_id: 'o4-mini',
		display_name: 'O4 Mini',
		provider_id: '7zfovhpnr2iwc4k',
		default_options: { max_completion_tokens: 16384, reasoning_effort: 'medium' },
		options_schema_keys: ['max_completion_tokens', 'reasoning_effort']
	}
];

const GOOGLE_MODELS: ModelRecord[] = [
	{
		id: 'r7ct6x3uph2xywc',
		model_id: 'gemini-2.5-pro',
		display_name: 'Gemini 2.5 Pro',
		provider_id: 'wie5pczciiuxma5',
		default_options: { maxOutputTokens: 8192, temperature: 1 },
		options_schema_keys: ['maxOutputTokens', 'temperature', 'topK', 'topP']
	},
	{
		id: 'wx5mf7jk3lgmqhy',
		model_id: 'gemini-2.5-flash',
		display_name: 'Gemini 2.5 Flash',
		provider_id: 'wie5pczciiuxma5',
		default_options: { maxOutputTokens: 8192, temperature: 1 },
		options_schema_keys: ['maxOutputTokens', 'temperature', 'topK', 'topP']
	},
	{
		id: '5fn44xa9gvkhxlt',
		model_id: 'gemini-2.5-flash-lite',
		display_name: 'Gemini 2.5 Flash Lite',
		provider_id: 'wie5pczciiuxma5',
		default_options: { maxOutputTokens: 8192, temperature: 1 },
		options_schema_keys: ['maxOutputTokens', 'temperature', 'topK', 'topP']
	},
	{
		id: 'e711eqc7lr3iy93',
		model_id: 'gemini-2.0-flash',
		display_name: 'Gemini 2.0 Flash',
		provider_id: 'wie5pczciiuxma5',
		default_options: { maxOutputTokens: 8192, temperature: 1 },
		options_schema_keys: ['maxOutputTokens', 'temperature', 'topK', 'topP']
	},
	{
		id: '1sn6x5ezq09xgpg',
		model_id: 'gemini-3-flash-preview',
		display_name: 'Gemini 3 Flash Preview',
		provider_id: 'wie5pczciiuxma5',
		default_options: { maxOutputTokens: 8192, temperature: 1 },
		options_schema_keys: ['maxOutputTokens', 'temperature', 'topK', 'topP']
	}
];

const XAI_MODELS: ModelRecord[] = [
	{
		id: 'b29qhf7o8vzf1r8',
		model_id: 'grok-3',
		display_name: 'Grok 3',
		provider_id: '5bqp9v0hdvrf9g9',
		default_options: { max_tokens: 16384, temperature: 0 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	},
	{
		id: 'bp2qj0sinz2kh90',
		model_id: 'grok-3-mini',
		display_name: 'Grok 3 Mini',
		provider_id: '5bqp9v0hdvrf9g9',
		default_options: { max_tokens: 16384, temperature: 0 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	},
	{
		id: 'p9xw1l56n3xo8dk',
		model_id: 'grok-3-mini-fast',
		display_name: 'Grok 3 Mini Fast',
		provider_id: '5bqp9v0hdvrf9g9',
		default_options: { max_tokens: 16384, temperature: 0 },
		options_schema_keys: [
			'max_tokens',
			'temperature',
			'top_p',
			'frequency_penalty',
			'presence_penalty'
		]
	}
];

const ALL_MODELS: ModelRecord[] = [
	...ANTHROPIC_MODELS,
	...OPENAI_STANDARD_MODELS,
	...OPENAI_REASONING_MODELS,
	...GOOGLE_MODELS,
	...XAI_MODELS
];

// ============================================================================
// Helper
// ============================================================================

function getProviderKey(model: ModelRecord): string {
	return PROVIDERS[model.provider_id];
}

// ============================================================================
// Tests: Per-model default_options mapping
// ============================================================================

describe('param-mapper: all 30 models default_options', () => {
	// --- Anthropic (10 models) ---
	describe('Anthropic models', () => {
		for (const model of ANTHROPIC_MODELS) {
			it(`${model.display_name} (${model.model_id})`, () => {
				const result = mapProviderOptions(model.default_options, getProviderKey(model));
				expect(result).toEqual({
					providerOptions: {},
					sdkParams: {
						maxOutputTokens: model.default_options.max_tokens,
						temperature: model.default_options.temperature
					}
				});
			});
		}
	});

	// --- OpenAI Standard (7 models) ---
	describe('OpenAI standard models', () => {
		for (const model of OPENAI_STANDARD_MODELS) {
			it(`${model.display_name} (${model.model_id})`, () => {
				const result = mapProviderOptions(model.default_options, getProviderKey(model));
				expect(result).toEqual({
					providerOptions: {},
					sdkParams: {
						maxOutputTokens: model.default_options.max_tokens,
						temperature: model.default_options.temperature
					}
				});
			});
		}
	});

	// --- OpenAI Reasoning (5 models) ---
	describe('OpenAI reasoning models', () => {
		for (const model of OPENAI_REASONING_MODELS) {
			it(`${model.display_name} (${model.model_id})`, () => {
				const result = mapProviderOptions(model.default_options, getProviderKey(model));
				expect(result).toEqual({
					providerOptions: {
						openai: {
							reasoningEffort: model.default_options.reasoning_effort
						}
					},
					sdkParams: {
						maxOutputTokens: model.default_options.max_completion_tokens
					}
				});
			});
		}
	});

	// --- Google (5 models) ---
	describe('Google models', () => {
		for (const model of GOOGLE_MODELS) {
			it(`${model.display_name} (${model.model_id})`, () => {
				const result = mapProviderOptions(model.default_options, getProviderKey(model));
				expect(result).toEqual({
					providerOptions: {},
					sdkParams: {
						maxOutputTokens: model.default_options.maxOutputTokens,
						temperature: model.default_options.temperature
					}
				});
			});
		}
	});

	// --- xAI (3 models) ---
	describe('xAI models', () => {
		for (const model of XAI_MODELS) {
			it(`${model.display_name} (${model.model_id})`, () => {
				const result = mapProviderOptions(model.default_options, getProviderKey(model));
				expect(result).toEqual({
					providerOptions: {},
					sdkParams: {
						maxOutputTokens: model.default_options.max_tokens,
						temperature: model.default_options.temperature
					}
				});
			});
		}
	});
});

// ============================================================================
// Tests: Full options_schema key coverage
// ============================================================================

describe('param-mapper: all options_schema keys map correctly', () => {
	it('Anthropic: max_tokens, temperature, top_k, top_p', () => {
		const result = mapProviderOptions(
			{ max_tokens: 8192, temperature: 0.7, top_k: 40, top_p: 0.9 },
			'anthropic'
		);
		expect(result).toEqual({
			sdkParams: { maxOutputTokens: 8192, temperature: 0.7, topK: 40, topP: 0.9 },
			providerOptions: {}
		});
	});

	it('OpenAI standard: max_tokens, temperature, top_p, frequency_penalty, presence_penalty', () => {
		const result = mapProviderOptions(
			{
				max_tokens: 16384,
				temperature: 0.5,
				top_p: 0.9,
				frequency_penalty: 0.5,
				presence_penalty: 0.3
			},
			'openai'
		);
		expect(result).toEqual({
			sdkParams: {
				maxOutputTokens: 16384,
				temperature: 0.5,
				topP: 0.9,
				frequencyPenalty: 0.5,
				presencePenalty: 0.3
			},
			providerOptions: {}
		});
	});

	it('OpenAI reasoning: max_completion_tokens, reasoning_effort', () => {
		const result = mapProviderOptions(
			{ max_completion_tokens: 16384, reasoning_effort: 'high' },
			'openai'
		);
		expect(result).toEqual({
			sdkParams: { maxOutputTokens: 16384 },
			providerOptions: { openai: { reasoningEffort: 'high' } }
		});
	});

	it('Google: maxOutputTokens, temperature, topK, topP (already camelCase)', () => {
		const result = mapProviderOptions(
			{ maxOutputTokens: 8192, temperature: 1, topK: 40, topP: 0.95 },
			'google'
		);
		expect(result).toEqual({
			sdkParams: { maxOutputTokens: 8192, temperature: 1, topK: 40, topP: 0.95 },
			providerOptions: {}
		});
	});

	it('xAI: max_tokens, temperature, top_p, frequency_penalty, presence_penalty', () => {
		const result = mapProviderOptions(
			{ max_tokens: 16384, temperature: 0, top_p: 1, frequency_penalty: 0, presence_penalty: 0 },
			'xai'
		);
		expect(result).toEqual({
			sdkParams: {
				maxOutputTokens: 16384,
				temperature: 0,
				topP: 1,
				frequencyPenalty: 0,
				presencePenalty: 0
			},
			providerOptions: {}
		});
	});
});

// ============================================================================
// Tests: No key loss — every options_schema key maps somewhere
// ============================================================================

describe('param-mapper: no key loss across all models', () => {
	for (const model of ALL_MODELS) {
		it(`${model.display_name}: all ${model.options_schema_keys.length} keys map`, () => {
			// Build a record with all schema keys set to a test value
			const input: Record<string, unknown> = {};
			for (const key of model.options_schema_keys) {
				// Use realistic test values
				if (key === 'reasoning_effort') input[key] = 'medium';
				else if (key.includes('token') || key.includes('Token')) input[key] = 4096;
				else input[key] = 0.5;
			}

			const result = mapProviderOptions(input, getProviderKey(model));
			const allOutputKeys = [
				...Object.keys(result.sdkParams),
				...Object.values(result.providerOptions).flatMap((v) => Object.keys(v))
			];

			// Every input key should produce at least one output key
			expect(allOutputKeys.length).toBe(model.options_schema_keys.length);
		});
	}
});

// ============================================================================
// Tests: String coercion (SchemaForm quirk)
// ============================================================================

describe('param-mapper: string coercion', () => {
	it('coerces string numbers to actual numbers', () => {
		const result = mapProviderOptions({ max_tokens: '4096', temperature: '0.7' }, 'anthropic');
		expect(result).toEqual({
			sdkParams: { maxOutputTokens: 4096, temperature: 0.7 },
			providerOptions: {}
		});
	});

	it('preserves reasoning_effort as string (not a number)', () => {
		const result = mapProviderOptions(
			{ max_completion_tokens: '32768', reasoning_effort: 'high' },
			'openai'
		);
		expect(result).toEqual({
			sdkParams: { maxOutputTokens: 32768 },
			providerOptions: { openai: { reasoningEffort: 'high' } }
		});
	});

	it('coerces Google camelCase params from strings', () => {
		const result = mapProviderOptions(
			{ maxOutputTokens: '8192', temperature: '1', topK: '40', topP: '0.95' },
			'google'
		);
		expect(result).toEqual({
			sdkParams: { maxOutputTokens: 8192, temperature: 1, topK: 40, topP: 0.95 },
			providerOptions: {}
		});
	});
});

// ============================================================================
// Tests: Unknown key fallback
// ============================================================================

describe('param-mapper: unknown key fallback', () => {
	it('routes unknown snake_case key to providerOptions', () => {
		const result = mapProviderOptions({ max_tokens: 4096, some_new_param: 'value' }, 'anthropic');
		expect(result).toEqual({
			sdkParams: { maxOutputTokens: 4096 },
			providerOptions: { anthropic: { someNewParam: 'value' } }
		});
	});

	it('routes unknown camelCase key to providerOptions', () => {
		const result = mapProviderOptions({ temperature: 0.5, myCustomParam: 'test' }, 'google');
		expect(result).toEqual({
			sdkParams: { temperature: 0.5 },
			providerOptions: { google: { myCustomParam: 'test' } }
		});
	});
});

// ============================================================================
// Tests: Edge cases
// ============================================================================

describe('param-mapper: edge cases', () => {
	it('handles null input', () => {
		const result = mapProviderOptions(null, 'openai');
		expect(result).toEqual({ sdkParams: {}, providerOptions: {} });
	});

	it('handles undefined input', () => {
		const result = mapProviderOptions(undefined, 'openai');
		expect(result).toEqual({ sdkParams: {}, providerOptions: {} });
	});

	it('handles empty object', () => {
		const result = mapProviderOptions({}, 'anthropic');
		expect(result).toEqual({ sdkParams: {}, providerOptions: {} });
	});

	it('skips null values', () => {
		const result = mapProviderOptions({ max_tokens: null, temperature: 0.5 }, 'openai');
		expect(result).toEqual({
			sdkParams: { temperature: 0.5 },
			providerOptions: {}
		});
	});

	it('skips undefined values', () => {
		const result = mapProviderOptions({ max_tokens: undefined, temperature: 0.5 }, 'openai');
		expect(result).toEqual({
			sdkParams: { temperature: 0.5 },
			providerOptions: {}
		});
	});

	it('skips empty string values', () => {
		const result = mapProviderOptions({ max_tokens: '', temperature: 0.5 }, 'openai');
		expect(result).toEqual({
			sdkParams: { temperature: 0.5 },
			providerOptions: {}
		});
	});

	it('handles stop → stopSequences rename', () => {
		const result = mapProviderOptions({ stop: ['END', 'STOP'] }, 'openai');
		expect(result).toEqual({
			sdkParams: { stopSequences: ['END', 'STOP'] },
			providerOptions: {}
		});
	});

	it('handles seed passthrough', () => {
		const result = mapProviderOptions({ seed: 42 }, 'openai');
		expect(result).toEqual({
			sdkParams: { seed: 42 },
			providerOptions: {}
		});
	});

	it('handles zero values correctly (not skipped)', () => {
		const result = mapProviderOptions({ temperature: 0, frequency_penalty: 0 }, 'xai');
		expect(result).toEqual({
			sdkParams: { temperature: 0, frequencyPenalty: 0 },
			providerOptions: {}
		});
	});
});
