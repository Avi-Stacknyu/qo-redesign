/**
 * Parameter Mapper — maps DB provider-native option keys to AI SDK params.
 *
 * DB stores provider-native names (e.g., max_tokens, maxOutputTokens, reasoning_effort).
 * AI SDK expects: standard params (temperature, maxOutputTokens, topP, ...) as top-level,
 * and provider-specific params nested under providerOptions.{providerKey}.
 *
 * This mapper is the ONLY place that knows the translation. When the SDK renames
 * a param (happened once in 3 years: maxTokens → maxOutputTokens), change ONE line here.
 */
import type { JSONValue } from 'ai';

// DB key → SDK standard key (rename rules)
const STANDARD_PARAM_MAP: Record<string, string> = {
	max_tokens: 'maxOutputTokens',
	max_completion_tokens: 'maxOutputTokens',
	top_p: 'topP',
	top_k: 'topK',
	frequency_penalty: 'frequencyPenalty',
	presence_penalty: 'presencePenalty',
	stop: 'stopSequences'
};

// SDK standard params that streamText/generateText accept as top-level args
const SDK_STANDARD_PARAMS = new Set([
	'temperature',
	'maxOutputTokens',
	'topP',
	'topK',
	'frequencyPenalty',
	'presencePenalty',
	'stopSequences',
	'seed'
]);

// DB key → { sdkKey } for params that MUST go to providerOptions
const PROVIDER_SPECIFIC_MAP: Record<string, { sdkKey: string }> = {
	reasoning_effort: { sdkKey: 'reasoningEffort' }
};

// snake_case → camelCase
function snakeToCamel(s: string): string {
	return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// Coerce string numbers from SchemaForm to actual numbers
function coerceValue(value: unknown, key: string): unknown {
	if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) {
		// Don't coerce enum-like strings (e.g., reasoning_effort: "high")
		const num = Number(value);
		if (key !== 'reasoning_effort' && key !== 'reasoningEffort') return num;
	}
	return value;
}

export interface MappedParams {
	sdkParams: Record<string, unknown>;
	providerOptions: Record<string, Record<string, JSONValue | undefined>>;
}

/**
 * Map provider-native DB options to AI SDK params.
 *
 * @param options - Raw options from provider_options (or legacy parameters) field
 * @param providerKey - Provider key: 'openai' | 'anthropic' | 'google' | 'xai'
 * @returns { sdkParams, providerOptions } ready to spread into streamText/generateText
 */
export function mapProviderOptions(
	options: Record<string, unknown> | undefined | null,
	providerKey: string
): MappedParams {
	const sdkParams: Record<string, unknown> = {};
	const providerSpecific: Record<string, unknown> = {};

	if (!options || typeof options !== 'object') {
		return { sdkParams, providerOptions: {} };
	}

	for (const [key, rawValue] of Object.entries(options)) {
		if (rawValue === undefined || rawValue === null || rawValue === '') continue;

		const value = coerceValue(rawValue, key);

		// 1. Check provider-specific map first (e.g., reasoning_effort)
		if (key in PROVIDER_SPECIFIC_MAP) {
			const { sdkKey } = PROVIDER_SPECIFIC_MAP[key];
			providerSpecific[sdkKey] = value;
			continue;
		}

		// 2. Check standard rename map (e.g., max_tokens → maxOutputTokens)
		const mapped = STANDARD_PARAM_MAP[key];
		if (mapped) {
			sdkParams[mapped] = value;
			continue;
		}

		// 3. Check if already a valid SDK standard param name (e.g., temperature, maxOutputTokens)
		if (SDK_STANDARD_PARAMS.has(key)) {
			sdkParams[key] = value;
			continue;
		}

		// 4. Try snake_to_camel and check if it becomes a standard param
		const camelKey = snakeToCamel(key);
		if (SDK_STANDARD_PARAMS.has(camelKey)) {
			sdkParams[camelKey] = value;
			continue;
		}

		// 5. Fallback: route to providerOptions (future-proof for unknown params)
		providerSpecific[camelKey] = value;
	}

	const providerOptions: Record<string, Record<string, JSONValue | undefined>> = Object.keys(
		providerSpecific
	).length > 0
		? { [providerKey]: providerSpecific as Record<string, JSONValue | undefined> }
		: {};

	return { sdkParams, providerOptions };
}
