/**
 * Prompts Utility Tests
 *
 * Tests for interpolatePrompt, injectAttributesIntoPrompt,
 * extractAttributePlaceholders, validatePlaceholders, and pure helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	interpolatePrompt,
	clearPromptCache,
	injectAttributesIntoPrompt,
	extractAttributePlaceholders,
	hasAttributePlaceholders,
	validatePlaceholders,
	buildPromptWithAttributes,
	DEFAULT_PROMPTS,
	getPromptWithFallback
} from '../../utils/prompts';
import { createMockDb } from '../../__tests__/setup';

// ============================================================================
// interpolatePrompt (pure function)
// ============================================================================

describe('interpolatePrompt', () => {
	it('replaces {{variable}} with values', () => {
		const result = interpolatePrompt('Hello {{name}}, you are {{age}} years old.', {
			name: 'Alice',
			age: 30
		});
		expect(result).toBe('Hello Alice, you are 30 years old.');
	});

	it('keeps unresolved placeholders as-is', () => {
		const result = interpolatePrompt('Hello {{name}} from {{country}}', { name: 'Bob' });
		expect(result).toBe('Hello Bob from {{country}}');
	});

	it('handles empty variables', () => {
		const result = interpolatePrompt('No {{vars}} here', {});
		expect(result).toBe('No {{vars}} here');
	});

	it('handles template with no placeholders', () => {
		const result = interpolatePrompt('Plain text', { key: 'value' });
		expect(result).toBe('Plain text');
	});
});

// ============================================================================
// injectAttributesIntoPrompt
// ============================================================================

describe('injectAttributesIntoPrompt', () => {
	it('injects attribute values and reports results', () => {
		const result = injectAttributesIntoPrompt('User from {{country}} aged {{age}}', {
			country: 'US',
			age: 35
		});

		expect(result.result).toBe('User from US aged 35');
		expect(result.injectedCount).toBe(2);
		expect(result.injectedKeys).toEqual(['country', 'age']);
		expect(result.unresolvedPlaceholders).toEqual([]);
	});

	it('replaces unresolved with fallbackValue by default', () => {
		const result = injectAttributesIntoPrompt('Hello {{name}} from {{unknown}}', { name: 'Alice' });

		expect(result.result).toBe('Hello Alice from ');
		expect(result.unresolvedPlaceholders).toEqual(['unknown']);
	});

	it('keeps unresolved placeholders when option set', () => {
		const result = injectAttributesIntoPrompt(
			'Hello {{name}} from {{unknown}}',
			{ name: 'Alice' },
			{ keepUnresolvedPlaceholders: true }
		);

		expect(result.result).toBe('Hello Alice from {{unknown}}');
	});

	it('uses custom fallbackValue', () => {
		const result = injectAttributesIntoPrompt('Value: {{missing}}', {}, { fallbackValue: 'N/A' });

		expect(result.result).toBe('Value: N/A');
	});

	it('formats arrays as comma-separated', () => {
		const result = injectAttributesIntoPrompt('Goals: {{goals}}', {
			goals: ['retirement', 'savings', 'education']
		});

		expect(result.result).toBe('Goals: retirement, savings, education');
	});

	it('formats booleans as yes/no', () => {
		const result = injectAttributesIntoPrompt('Active: {{active}}, Verified: {{verified}}', {
			active: true,
			verified: false
		});

		expect(result.result).toBe('Active: yes, Verified: no');
	});
});

// ============================================================================
// Placeholder Detection
// ============================================================================

describe('extractAttributePlaceholders', () => {
	it('extracts unique placeholders', () => {
		const placeholders = extractAttributePlaceholders(
			'Hello {{name}}, {{age}} years from {{country}}. Name: {{name}}'
		);
		expect(placeholders).toEqual(['name', 'age', 'country']);
	});

	it('returns empty array for no placeholders', () => {
		expect(extractAttributePlaceholders('No placeholders here')).toEqual([]);
	});
});

describe('hasAttributePlaceholders', () => {
	it('returns true when placeholders exist', () => {
		expect(hasAttributePlaceholders('Hello {{name}}')).toBe(true);
	});

	it('returns false when no placeholders', () => {
		expect(hasAttributePlaceholders('Plain text')).toBe(false);
	});
});

describe('validatePlaceholders', () => {
	it('returns valid when all placeholders are available', () => {
		const result = validatePlaceholders('{{name}} {{age}}', ['name', 'age', 'country']);
		expect(result).toEqual({ valid: true });
	});

	it('returns missing placeholders', () => {
		const result = validatePlaceholders('{{name}} {{missing}}', ['name']);
		expect(result).toEqual({ valid: false, missing: ['missing'] });
	});
});

// ============================================================================
// buildPromptWithAttributes
// ============================================================================

describe('buildPromptWithAttributes', () => {
	it('chains interpolation then attribute injection', () => {
		const result = buildPromptWithAttributes(
			'System: {{system_prompt}}. User from {{country}}.',
			{ system_prompt: 'Be helpful' },
			{ country: 'India' }
		);

		expect(result).toBe('System: Be helpful. User from India.');
	});
});

// ============================================================================
// getPromptWithFallback
// ============================================================================

describe('getPromptWithFallback', () => {
	beforeEach(() => {
		clearPromptCache();
	});

	it('returns default prompt when DB fails', async () => {
		const db = createMockDb();
		db.then.mockImplementation((_r: any, reject: any) => reject(new Error('DB down')));

		// loadPrompts throws → getPromptWithFallback propagates
		await expect(getPromptWithFallback(db as any, 'default_system_prompt')).rejects.toThrow();
	});

	it('returns DB prompt when available', async () => {
		const db = createMockDb();
		db.then.mockImplementation((r: any) =>
			r([
				{
					promptKey: 'default_system_prompt',
					promptTemplate: 'Custom: {{personality}}'
				}
			])
		);

		const result = await getPromptWithFallback(db as any, 'default_system_prompt', {
			personality: 'friendly'
		});

		expect(result).toBe('Custom: friendly');
	});

	it('interpolates template variables', async () => {
		clearPromptCache();
		const db = createMockDb();
		// Default mock returns [] → falls back to DEFAULT_PROMPTS

		const result = await getPromptWithFallback(db as any, 'intent_classification', {
			categories: 'buy, sell, hold',
			message: 'I want to buy AAPL'
		});

		expect(result).toContain('buy, sell, hold');
		expect(result).toContain('I want to buy AAPL');
	});
});

// ============================================================================
// DEFAULT_PROMPTS
// ============================================================================

describe('DEFAULT_PROMPTS', () => {
	it('has required prompt keys', () => {
		expect(DEFAULT_PROMPTS.chunk_contextualization).toBeDefined();
		expect(DEFAULT_PROMPTS.document_extraction).toBeDefined();
		expect(DEFAULT_PROMPTS.intent_classification).toBeDefined();
		expect(DEFAULT_PROMPTS.default_system_prompt).toBeDefined();
		expect(DEFAULT_PROMPTS.agent_instructions).toBeDefined();
		expect(DEFAULT_PROMPTS.agent_shelf_selection).toBeDefined();
	});
});
