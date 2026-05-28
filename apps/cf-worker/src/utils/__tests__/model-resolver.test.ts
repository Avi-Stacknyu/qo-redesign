/**
 * Model Resolver Tests
 *
 * Tests for resolveNodeModel priority chain, getSystemDefaultModel,
 * fetchModelById, getAvailableModelsForUser, and fetchDynamicModels.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	resolveNodeModel,
	getSystemDefaultModel,
	fetchModelById,
	getAvailableModelsForUser,
	fetchDynamicModels,
	clearModelResolverCache
} from '../../utils/model-resolver';
import type { ResolvedModel } from '../../types/flow';
import { AIModelError, ConfigError } from '../../utils/errors';
import { createMockDb } from '../../__tests__/setup';

// ============================================================================
// Fixtures
// ============================================================================

function makeModel(overrides: Partial<ResolvedModel> & { id: string }): ResolvedModel {
	return {
		model_id: 'test-model',
		display_name: 'Test Model',
		provider_id: 'prov-1',
		provider_key: 'openai',
		...overrides
	};
}

const gpt4o = makeModel({
	id: 'rec-gpt4o',
	model_id: 'gpt-4o',
	display_name: 'GPT-4o',
	provider_key: 'openai'
});

const claude = makeModel({
	id: 'rec-claude',
	model_id: 'claude-sonnet-4-20250514',
	display_name: 'Claude Sonnet 4',
	provider_key: 'anthropic'
});

const gemini = makeModel({
	id: 'rec-gemini',
	model_id: 'gemini-2.5-pro',
	display_name: 'Gemini 2.5 Pro',
	provider_key: 'google'
});

const systemDefault = makeModel({
	id: 'rec-default',
	model_id: 'gpt-4o-mini',
	display_name: 'GPT-4o Mini',
	provider_key: 'openai'
});

const compiledModels: Record<string, ResolvedModel> = {
	'rec-gpt4o': gpt4o
};

// ============================================================================
// resolveNodeModel — Priority Chain
// ============================================================================

describe('resolveNodeModel', () => {
	it('priority 1: uses admin-pinned model when node has model_id', () => {
		const result = resolveNodeModel(
			'rec-gpt4o', // pinned
			'rec-claude', // chat override (ignored)
			'rec-gemini', // user pref (ignored)
			systemDefault,
			compiledModels
		);
		expect(result).toBe(gpt4o);
	});

	it('priority 1: throws when pinned model is not resolved', () => {
		expect(() =>
			resolveNodeModel('rec-unknown', undefined, undefined, systemDefault, compiledModels)
		).toThrow(AIModelError);
	});

	it('priority 1: finds pinned model in dynamicModels if not in compiled', () => {
		const result = resolveNodeModel(
			'rec-claude',
			undefined,
			undefined,
			systemDefault,
			compiledModels,
			{ 'rec-claude': claude }
		);
		expect(result).toBe(claude);
	});

	it('priority 2: uses chat override when node has no model_id', () => {
		const dynamicModels = { 'rec-claude': claude };
		const result = resolveNodeModel(
			undefined, // no pin
			'rec-claude', // chat override
			'rec-gemini', // user pref (ignored)
			systemDefault,
			compiledModels,
			dynamicModels
		);
		expect(result).toBe(claude);
	});

	it('priority 2: falls through when chat override ID is not found', () => {
		const result = resolveNodeModel(
			undefined,
			'rec-missing', // override not in any model set
			undefined,
			systemDefault,
			compiledModels
		);
		expect(result).toBe(systemDefault);
	});

	it('priority 3: uses user preference when no pin and no override', () => {
		const dynamicModels = { 'rec-gemini': gemini };
		const result = resolveNodeModel(
			undefined,
			undefined,
			'rec-gemini',
			systemDefault,
			compiledModels,
			dynamicModels
		);
		expect(result).toBe(gemini);
	});

	it('priority 3: falls through when user preference ID is not found', () => {
		const result = resolveNodeModel(
			undefined,
			undefined,
			'rec-missing',
			systemDefault,
			compiledModels
		);
		expect(result).toBe(systemDefault);
	});

	it('priority 4: falls back to system default when nothing else matches', () => {
		const result = resolveNodeModel(undefined, undefined, undefined, systemDefault, compiledModels);
		expect(result).toBe(systemDefault);
	});

	it('throws when systemDefault is undefined and no other resolution matches', () => {
		expect(() =>
			resolveNodeModel(undefined, undefined, undefined, undefined, compiledModels)
		).toThrow(AIModelError);
		expect(() =>
			resolveNodeModel(undefined, undefined, undefined, undefined, compiledModels)
		).toThrow('No model could be resolved');
	});

	it('chat override from compiled models works (model was pinned on another node)', () => {
		const result = resolveNodeModel(
			undefined,
			'rec-gpt4o', // exists in compiledModels
			undefined,
			systemDefault,
			compiledModels
		);
		expect(result).toBe(gpt4o);
	});

	it('user preference from compiled models works', () => {
		const result = resolveNodeModel(
			undefined,
			undefined,
			'rec-gpt4o', // exists in compiledModels
			systemDefault,
			compiledModels
		);
		expect(result).toBe(gpt4o);
	});
});

// ============================================================================
// getSystemDefaultModel
// ============================================================================

// Helper to create a Drizzle-shaped row for model resolver queries
function makeDrizzleModelRow(overrides: {
	id: string;
	modelId: string;
	displayName: string;
	providerKey: string;
	isActive?: boolean;
	isEnabled?: boolean;
	isSystemDefault?: boolean;
	capabilities?: Record<string, unknown> | null;
	defaultOptions?: Record<string, unknown> | null;
}) {
	return {
		model: {
			id: overrides.id,
			modelId: overrides.modelId,
			displayName: overrides.displayName,
			provider: `prov-${overrides.providerKey}`,
			currentPricing: null,
			contextWindow: null,
			maxOutputTokens: null,
			isActive: overrides.isActive ?? true,
			isEnabled: overrides.isEnabled ?? true,
			isSystemDefault: overrides.isSystemDefault ?? false,
			capabilities: overrides.capabilities ?? null,
			defaultOptions: overrides.defaultOptions ?? null,
			configKey: '',
			tagRule: null
		},
		provider: {
			providerKey: overrides.providerKey
		}
	};
}

describe('getSystemDefaultModel', () => {
	beforeEach(() => {
		clearModelResolverCache();
	});

	it('returns the system default model', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([
				makeDrizzleModelRow({
					id: 'rec-default',
					modelId: 'gpt-4o-mini',
					displayName: 'GPT-4o Mini',
					providerKey: 'openai',
					isSystemDefault: true
				})
			])
		);

		const result = await getSystemDefaultModel(db as any);

		expect(result.id).toBe('rec-default');
		expect(result.model_id).toBe('gpt-4o-mini');
		expect(result.provider_key).toBe('openai');
	});

	it('caches the result on subsequent calls', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([
				makeDrizzleModelRow({
					id: 'rec-default',
					modelId: 'gpt-4o-mini',
					displayName: 'GPT-4o Mini',
					providerKey: 'openai',
					isSystemDefault: true
				})
			])
		);

		await getSystemDefaultModel(db as any);
		await getSystemDefaultModel(db as any);

		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it('throws when no system default is configured', async () => {
		const db = createMockDb();
		// Default: then resolves to [] (no rows)

		await expect(getSystemDefaultModel(db as any)).rejects.toThrow(ConfigError);
	});
});

// ============================================================================
// fetchModelById
// ============================================================================

describe('fetchModelById', () => {
	it('returns a ResolvedModel for an active model', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([
				makeDrizzleModelRow({
					id: 'rec-claude',
					modelId: 'claude-sonnet-4-20250514',
					displayName: 'Claude Sonnet 4',
					providerKey: 'anthropic',
					capabilities: { vision: true }
				})
			])
		);

		const result = await fetchModelById(db as any, 'rec-claude');

		expect(result.id).toBe('rec-claude');
		expect(result.provider_key).toBe('anthropic');
		expect(result.capabilities).toEqual({ vision: true });
	});

	it('throws when model is inactive', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([
				makeDrizzleModelRow({
					id: 'rec-inactive',
					modelId: 'old-model',
					displayName: 'Old Model',
					providerKey: 'openai',
					isActive: false
				})
			])
		);

		await expect(fetchModelById(db as any, 'rec-inactive')).rejects.toThrow('not active/enabled');
	});

	it('throws when model is not enabled', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([
				makeDrizzleModelRow({
					id: 'rec-disabled',
					modelId: 'disabled-model',
					displayName: 'Disabled',
					providerKey: 'openai',
					isEnabled: false
				})
			])
		);

		await expect(fetchModelById(db as any, 'rec-disabled')).rejects.toThrow('not active/enabled');
	});

	it('throws when model does not exist', async () => {
		const db = createMockDb();
		// Default: then resolves to [] (no rows)

		await expect(fetchModelById(db as any, 'rec-missing')).rejects.toThrow(AIModelError);
	});
});

// ============================================================================
// getAvailableModelsForUser
// ============================================================================

describe('getAvailableModelsForUser', () => {
	it('returns all active+enabled models as ResolvedModel[]', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([
				makeDrizzleModelRow({
					id: 'rec-1',
					modelId: 'claude-sonnet-4-20250514',
					displayName: 'Claude Sonnet 4',
					providerKey: 'anthropic'
				}),
				makeDrizzleModelRow({
					id: 'rec-2',
					modelId: 'gpt-4o',
					displayName: 'GPT-4o',
					providerKey: 'openai'
				})
			])
		);

		const result = await getAvailableModelsForUser(db as any);

		expect(result).toHaveLength(2);
		expect(result[0].model_id).toBe('claude-sonnet-4-20250514');
		expect(result[1].model_id).toBe('gpt-4o');
	});
});

// ============================================================================
// fetchDynamicModels
// ============================================================================

describe('fetchDynamicModels', () => {
	beforeEach(() => {
		clearModelResolverCache();
	});

	it('fetches only models not in compiled set', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([
				makeDrizzleModelRow({
					id: 'rec-claude',
					modelId: 'claude-sonnet-4-20250514',
					displayName: 'Claude Sonnet 4',
					providerKey: 'anthropic'
				})
			])
		);

		const result = await fetchDynamicModels(db as any, compiledModels, [
			'rec-gpt4o', // already in compiled — skip
			'rec-claude', // not in compiled — fetch
			undefined // skip
		]);

		expect(Object.keys(result)).toEqual(['rec-claude']);
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it('skips models that fail to fetch', async () => {
		const db = createMockDb();
		// Default: then resolves to [] → fetchModelById throws AIModelError → silently skipped

		const result = await fetchDynamicModels(db as any, compiledModels, ['rec-missing']);

		expect(Object.keys(result)).toEqual([]);
	});

	it('returns empty when all IDs are in compiled set', async () => {
		const db = createMockDb();
		const result = await fetchDynamicModels(db as any, compiledModels, ['rec-gpt4o']);

		expect(Object.keys(result)).toEqual([]);
		expect(db.select).not.toHaveBeenCalled();
	});

	it('deduplicates IDs', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([
				makeDrizzleModelRow({
					id: 'rec-claude',
					modelId: 'claude-sonnet-4-20250514',
					displayName: 'Claude Sonnet 4',
					providerKey: 'anthropic'
				})
			])
		);

		await fetchDynamicModels(db as any, compiledModels, ['rec-claude', 'rec-claude', 'rec-claude']);

		expect(db.select).toHaveBeenCalledTimes(1);
	});
});
