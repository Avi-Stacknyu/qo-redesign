import { describe, expect, it, beforeEach } from 'vitest';
import {
	resolveOnboardingAIQuestionModel,
	clearOnboardingAIQuestionModelCache
} from '../onboarding-ai-helpers';
import { createMockDb, createMockEnv } from '../../__tests__/setup';
import type { OnboardingConfig } from '../../types/onboarding';

function makeConfig(overrides: Partial<OnboardingConfig> = {}): OnboardingConfig {
	return {
		id: 'profile-1',
		system_prompt: '',
		model: '',
		max_ai_questions: 3,
		session_timeout_ms: 30_000,
		cache_ttl_ms: 60_000,
		enabled: true,
		defaultTags: [],
		visibility: 'public',
		promptTemplate: null,
		modelId: null,
		providerKey: null,
		...overrides
	};
}

function makeSystemDefaultRow() {
	return {
		model: {
			id: 'model-default',
			modelId: 'gpt-4o-mini',
			displayName: 'GPT-4o Mini',
			provider: 'provider-openai',
			currentPricing: null,
			contextWindow: null,
			maxOutputTokens: null,
			isActive: true,
			isEnabled: true,
			isSystemDefault: true,
			capabilities: null,
			defaultOptions: null,
			configKey: '',
			tagRule: null
		},
		provider: {
			providerKey: 'openai'
		}
	};
}

describe('resolveOnboardingAIQuestionModel', () => {
	beforeEach(() => {
		clearOnboardingAIQuestionModelCache();
	});

	it('uses the profile runtime model when configured', async () => {
		const db = createMockDb();

		const resolved = await resolveOnboardingAIQuestionModel({
			db: db as never,
			env: createMockEnv() as never,
			config: makeConfig({ modelId: 'claude-sonnet-4-20250514', providerKey: 'anthropic' })
		});

		expect(resolved.source).toBe('profile_config');
		expect(resolved.provider).toBe('anthropic');
		expect(resolved.modelName).toBe('claude-sonnet-4-20250514');
		expect(db.select).not.toHaveBeenCalled();
	});

	it('uses the system default model when the profile leaves runtime model blank', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: (rows: unknown[]) => void) =>
			resolve([makeSystemDefaultRow()])
		);

		const resolved = await resolveOnboardingAIQuestionModel({
			db: db as never,
			env: createMockEnv() as never,
			config: makeConfig()
		});

		expect(resolved.source).toBe('system_default');
		expect(resolved.provider).toBe('openai');
		expect(resolved.modelName).toBe('gpt-4o-mini');
	});
});
