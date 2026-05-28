import { describe, expect, it } from 'vitest';
import {
	buildOnboardingQuestionSystemPrompt,
	interpolatePrompt,
	ONBOARDING_AI_RESPONSE_SUFFIX,
	PROFILE_EXTRACTION
} from '../prompts';

describe('onboarding prompt safety', () => {
	it('always appends immutable response schema instructions to admin prompts', () => {
		const prompt = buildOnboardingQuestionSystemPrompt('Admin editable prompt only');

		expect(prompt).toContain('Admin editable prompt only');
		expect(prompt).toContain(ONBOARDING_AI_RESPONSE_SUFFIX);
		expect(prompt).toContain('ONLY a valid JSON object');
	});

	it('keeps profiler extraction output instructions after the admin profiler prompt', () => {
		const prompt = interpolatePrompt(PROFILE_EXTRACTION, {
			profilerSystemPrompt: 'Admin profiler prompt only',
			schemaDefinitions: 'Schema definitions',
			profileContext: 'Current profile',
			messageCount: '1',
			conversationText: 'User: hello'
		});

		expect(prompt).toContain('Admin profiler prompt only');
		expect(prompt).toContain('Return ONLY updated/new fields');
		expect(prompt).toContain('Output JSON:');
		expect(prompt.indexOf('Admin profiler prompt only')).toBeLessThan(
			prompt.indexOf('Output JSON:')
		);
	});
});
