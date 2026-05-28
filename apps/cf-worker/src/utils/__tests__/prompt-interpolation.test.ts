/**
 * Prompt Interpolation Tests
 *
 * Verifies that every prompt constant interpolates correctly with its
 * expected variables. Catches mismatches between {{placeholders}} in
 * templates and the variables passed at callsites.
 */

import { describe, it, expect } from 'vitest';
import {
	interpolatePrompt,
	CHUNK_CONTEXTUALIZATION,
	BATCH_CHUNK_CONTEXTUALIZATION,
	DOCUMENT_EXTRACTION,
	DOCUMENT_EXTRACTION_SYSTEM,
	DEFAULT_SYSTEM_PROMPT,
	AGENT_INSTRUCTIONS,
	CHAT_TITLE_GENERATION,
	INTENT_CLASSIFICATION,
	CLASSIFIER_NODE_DEFAULT,
	CLASSIFIER_NODE_SUFFIX,
	NOTE_CATEGORIZATION,
	SEARCH_KNOWLEDGE_BASE_DESCRIPTION,
	QUERY_REWRITE,
	SESSION_EXTRACTION,
	PROFILE_EXTRACTION,
	PROFILE_SCHEMA_GENERATION,
	PROFILE_SUMMARY_SYSTEM,
	PROFILE_SUMMARY_USER,
	ONBOARDING_SYSTEM_PROMPT,
	ONBOARDING_QUESTION_USER,
	ONBOARDING_TAG_ASSIGNMENT,
	AGENT_SHELF_SELECTION,
	PERSONALIZED_SUGGESTIONS_SYSTEM,
	PERSONALIZED_SUGGESTIONS_USER,
	PROMPT_DEFAULTS
} from '../../utils/prompts';

// ============================================================================
// Helper: extract all {{variable}} names from a template
// ============================================================================

function extractPlaceholders(template: string): string[] {
	const matches = template.match(/\{\{(\w+)\}\}/g) ?? [];
	return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

// ============================================================================
// PROMPT_DEFAULTS integrity
// ============================================================================

describe('PROMPT_DEFAULTS map', () => {
	const expectedKeys = [
		'chunk_contextualization',
		'batch_chunk_contextualization',
		'document_extraction',
		'document_extraction_system',
		'default_system_prompt',
		'agent_instructions',
		'chat_title_generation',
		'intent_classification',
		'note_categorization',
		'search_knowledge_base_description',
		'query_rewrite',
		'session_extraction',
		'profile_extraction',
		'profile_schema_generation',
		'profile_summary_system',
		'profile_summary_user',
		'onboarding_system_prompt',
		'onboarding_question_user',
		'onboarding_tag_assignment',
		'agent_shelf_selection',
		'personalized_suggestions_system',
		'personalized_suggestions_user',
		'classifier_node_default',
		'classifier_node_suffix'
	];

	it('contains all expected keys', () => {
		for (const key of expectedKeys) {
			expect(PROMPT_DEFAULTS).toHaveProperty(key);
		}
	});

	it('has no empty prompt values', () => {
		for (const [key, value] of Object.entries(PROMPT_DEFAULTS)) {
			expect(value, `${key} should not be empty`).toBeTruthy();
			expect(typeof value, `${key} should be a string`).toBe('string');
		}
	});

	it('every value is a non-empty string with length > 10', () => {
		for (const [key, value] of Object.entries(PROMPT_DEFAULTS)) {
			expect(value.length, `${key} seems too short (${value.length} chars)`).toBeGreaterThan(10);
		}
	});
});

// ============================================================================
// Per-prompt interpolation tests
// ============================================================================

describe('prompt interpolation — Document Processing', () => {
	it('CHUNK_CONTEXTUALIZATION: replaces {{heading}} and {{text}}', () => {
		const result = interpolatePrompt(CHUNK_CONTEXTUALIZATION, {
			heading: 'Q3 Revenue',
			text: 'Revenue was $10M in Q3 2025.'
		});
		expect(result).toContain('Q3 Revenue');
		expect(result).toContain('Revenue was $10M in Q3 2025.');
		expect(result).not.toContain('{{heading}}');
		expect(result).not.toContain('{{text}}');
	});

	it('BATCH_CHUNK_CONTEXTUALIZATION: replaces {{chunks}}', () => {
		const result = interpolatePrompt(BATCH_CHUNK_CONTEXTUALIZATION, {
			chunks: '1. Revenue data\n2. Expense data'
		});
		expect(result).toContain('1. Revenue data');
		expect(result).not.toContain('{{chunks}}');
	});

	it('DOCUMENT_EXTRACTION: replaces {{sample_text}}', () => {
		const result = interpolatePrompt(DOCUMENT_EXTRACTION, {
			sample_text: 'Tax return for John Doe, 2024.'
		});
		expect(result).toContain('Tax return for John Doe, 2024.');
		expect(result).not.toContain('{{sample_text}}');
	});

	it('DOCUMENT_EXTRACTION_SYSTEM: has no placeholders', () => {
		const placeholders = extractPlaceholders(DOCUMENT_EXTRACTION_SYSTEM);
		expect(placeholders).toEqual([]);
	});
});

describe('prompt interpolation — Chat & Agent', () => {
	it('DEFAULT_SYSTEM_PROMPT: replaces {{personality}} and {{user_context}}', () => {
		const result = interpolatePrompt(DEFAULT_SYSTEM_PROMPT, {
			personality: 'You are warm and encouraging.',
			user_context: 'User is 30, from NYC.'
		});
		expect(result).toContain('You are warm and encouraging.');
		expect(result).toContain('User is 30, from NYC.');
		expect(result).not.toContain('{{personality}}');
		expect(result).not.toContain('{{user_context}}');
	});

	it('AGENT_INSTRUCTIONS: has no placeholders', () => {
		const placeholders = extractPlaceholders(AGENT_INSTRUCTIONS);
		expect(placeholders).toEqual([]);
	});

	it('CHAT_TITLE_GENERATION: replaces {{userMessage}} and {{assistantResponse}}', () => {
		const result = interpolatePrompt(CHAT_TITLE_GENERATION, {
			userMessage: 'How do I save for retirement?',
			assistantResponse: 'Start with a 401k and IRA...'
		});
		expect(result).toContain('How do I save for retirement?');
		expect(result).toContain('Start with a 401k and IRA...');
		expect(result).not.toContain('{{userMessage}}');
		expect(result).not.toContain('{{assistantResponse}}');
	});

	it('INTENT_CLASSIFICATION: replaces {{categories}} and {{message}}', () => {
		const result = interpolatePrompt(INTENT_CLASSIFICATION, {
			categories: 'buy, sell, hold',
			message: 'I want to buy AAPL'
		});
		expect(result).toContain('buy, sell, hold');
		expect(result).toContain('I want to buy AAPL');
		expect(result).not.toContain('{{categories}}');
		expect(result).not.toContain('{{message}}');
	});

	it('CLASSIFIER_NODE_DEFAULT: replaces {{categoryDescriptions}}, {{input}}, {{categoryIds}}', () => {
		const result = interpolatePrompt(CLASSIFIER_NODE_DEFAULT, {
			categoryDescriptions: '- buy: Purchase\n- sell: Sell',
			input: 'I want to sell my bonds',
			categoryIds: 'buy, sell'
		});
		expect(result).toContain('- buy: Purchase');
		expect(result).toContain('I want to sell my bonds');
		expect(result).toContain('buy, sell');
		expect(result).not.toContain('{{categoryDescriptions}}');
		expect(result).not.toContain('{{input}}');
		expect(result).not.toContain('{{categoryIds}}');
	});

	it('CLASSIFIER_NODE_SUFFIX: replaces {{categoryDescriptions}} and {{categoryIds}}', () => {
		const result = interpolatePrompt(CLASSIFIER_NODE_SUFFIX, {
			categoryDescriptions: '- ask: Question\n- cmd: Command',
			categoryIds: 'ask, cmd'
		});
		expect(result).toContain('- ask: Question');
		expect(result).toContain('ask, cmd');
		expect(result).not.toContain('{{categoryDescriptions}}');
		expect(result).not.toContain('{{categoryIds}}');
	});
});

describe('prompt interpolation — Notes & Categorization', () => {
	it('NOTE_CATEGORIZATION: replaces {{agentContext}} and {{noteContent}}', () => {
		const result = interpolatePrompt(NOTE_CATEGORIZATION, {
			agentContext: 'Agent: Tax Advisor',
			noteContent: 'Remember to file 1099 by April 15.'
		});
		expect(result).toContain('Agent: Tax Advisor');
		expect(result).toContain('Remember to file 1099 by April 15.');
		expect(result).not.toContain('{{agentContext}}');
		expect(result).not.toContain('{{noteContent}}');
	});
});

describe('prompt interpolation — RAG / Search', () => {
	it('SEARCH_KNOWLEDGE_BASE_DESCRIPTION: has no placeholders', () => {
		const placeholders = extractPlaceholders(SEARCH_KNOWLEDGE_BASE_DESCRIPTION);
		expect(placeholders).toEqual([]);
	});

	it('QUERY_REWRITE: replaces {{maxVariations}} and {{userQuery}}', () => {
		const result = interpolatePrompt(QUERY_REWRITE, {
			maxVariations: '3',
			userQuery: 'What is my tax liability?'
		});
		expect(result).toContain('3');
		expect(result).toContain('What is my tax liability?');
		expect(result).not.toContain('{{maxVariations}}');
		expect(result).not.toContain('{{userQuery}}');
	});
});

describe('prompt interpolation — Session & Extraction', () => {
	it('SESSION_EXTRACTION: replaces all 6 variables', () => {
		const result = interpolatePrompt(SESSION_EXTRACTION, {
			currentDateTime: '2026-03-29T15:00:00Z',
			messageCount: '12',
			conversationText: 'User: Hi\nAssistant: Hello',
			existingEntitiesBlock: '[1] John Doe (person)',
			sessionEndNote: 'Session ending.',
			summaryInstruction: 'Summarize this segment'
		});
		expect(result).toContain('2026-03-29T15:00:00Z');
		expect(result).toContain('12');
		expect(result).toContain('User: Hi\nAssistant: Hello');
		expect(result).toContain('[1] John Doe (person)');
		expect(result).toContain('Session ending.');
		expect(result).toContain('Summarize this segment');
		expect(result).not.toContain('{{currentDateTime}}');
		expect(result).not.toContain('{{messageCount}}');
		expect(result).not.toContain('{{conversationText}}');
		expect(result).not.toContain('{{existingEntitiesBlock}}');
		expect(result).not.toContain('{{sessionEndNote}}');
		expect(result).not.toContain('{{summaryInstruction}}');
	});
});

describe('prompt interpolation — Profiling', () => {
	it('PROFILE_EXTRACTION: replaces all 5 variables', () => {
		const result = interpolatePrompt(PROFILE_EXTRACTION, {
			profilerSystemPrompt: 'Extract user financial profile.',
			schemaDefinitions: 'section: personal, fields: [name, age]',
			profileContext: 'Existing: name=John',
			messageCount: '8',
			conversationText: 'User: I am 30\nAssistant: Great!'
		});
		expect(result).toContain('Extract user financial profile.');
		expect(result).toContain('section: personal');
		expect(result).toContain('Existing: name=John');
		expect(result).toContain('8');
		expect(result).toContain('User: I am 30');
		expect(result).not.toContain('{{profilerSystemPrompt}}');
		expect(result).not.toContain('{{schemaDefinitions}}');
		expect(result).not.toContain('{{profileContext}}');
		expect(result).not.toContain('{{messageCount}}');
		expect(result).not.toContain('{{conversationText}}');
	});

	it('PROFILE_SCHEMA_GENERATION: replaces {{systemPrompt}}', () => {
		const result = interpolatePrompt(PROFILE_SCHEMA_GENERATION, {
			systemPrompt: 'Analyze financial goals and risk tolerance.'
		});
		expect(result).toContain('Analyze financial goals and risk tolerance.');
		expect(result).not.toContain('{{systemPrompt}}');
	});

	it('PROFILE_SUMMARY_SYSTEM: has no placeholders', () => {
		const placeholders = extractPlaceholders(PROFILE_SUMMARY_SYSTEM);
		expect(placeholders).toEqual([]);
	});

	it('PROFILE_SUMMARY_USER: replaces {{contextSections}}', () => {
		const result = interpolatePrompt(PROFILE_SUMMARY_USER, {
			contextSections: 'Personal: Age 30\nFinancial: Income $100k'
		});
		expect(result).toContain('Personal: Age 30');
		expect(result).not.toContain('{{contextSections}}');
	});
});

describe('prompt interpolation — Onboarding', () => {
	it('ONBOARDING_SYSTEM_PROMPT: replaces {{profiler_data}} and {{previous_answers}}', () => {
		const result = interpolatePrompt(ONBOARDING_SYSTEM_PROMPT, {
			profiler_data: 'some profiler data',
			previous_answers: 'some answers'
		});
		expect(result).toContain('some profiler data');
		expect(result).toContain('some answers');
		expect(result).not.toContain('{{profiler_data}}');
		expect(result).not.toContain('{{previous_answers}}');
	});

	it('ONBOARDING_QUESTION_USER: replaces {{context}}', () => {
		const result = interpolatePrompt(ONBOARDING_QUESTION_USER, {
			context: 'Previous answers:\nRisk Tolerance: moderate'
		});
		expect(result).toContain('Previous answers:\nRisk Tolerance: moderate');
		expect(result).not.toContain('{{context}}');
	});

	it('ONBOARDING_TAG_ASSIGNMENT: replaces {{user_facts}} and {{tag_catalog}}', () => {
		const result = interpolatePrompt(ONBOARDING_TAG_ASSIGNMENT, {
			user_facts: 'risk_tolerance: moderate\ngoals: retirement',
			tag_catalog: 'segment:conservative — Conservative investors'
		});
		expect(result).toContain('risk_tolerance: moderate');
		expect(result).toContain('segment:conservative');
		expect(result).not.toContain('{{user_facts}}');
		expect(result).not.toContain('{{tag_catalog}}');
	});

	it('AGENT_SHELF_SELECTION: replaces {{user_facts}} and {{agent_list}}', () => {
		const result = interpolatePrompt(AGENT_SHELF_SELECTION, {
			user_facts: 'age: 25, goals: growth',
			agent_list: '- tax_advisor: Tax planning\n- portfolio_manager: Portfolio management'
		});
		expect(result).toContain('age: 25, goals: growth');
		expect(result).toContain('- tax_advisor: Tax planning');
		expect(result).not.toContain('{{user_facts}}');
		expect(result).not.toContain('{{agent_list}}');
	});
});

describe('prompt interpolation — Suggestions', () => {
	it('PERSONALIZED_SUGGESTIONS_SYSTEM: replaces {{agentName}}, {{agentDescription}}, {{suggestionsCount}}', () => {
		const result = interpolatePrompt(PERSONALIZED_SUGGESTIONS_SYSTEM, {
			agentName: 'Tax Advisor',
			agentDescription: 'Tax planning and optimization',
			suggestionsCount: '4'
		});
		expect(result).toContain('Tax Advisor');
		expect(result).toContain('Tax planning and optimization');
		expect(result).toContain('4');
		expect(result).not.toContain('{{agentName}}');
		expect(result).not.toContain('{{agentDescription}}');
		expect(result).not.toContain('{{suggestionsCount}}');
	});

	it('PERSONALIZED_SUGGESTIONS_USER: replaces {{contextSummary}}, {{suggestionsCount}}, {{agentName}}', () => {
		const result = interpolatePrompt(PERSONALIZED_SUGGESTIONS_USER, {
			contextSummary: 'User is 30, interested in retirement planning.',
			suggestionsCount: '5',
			agentName: 'Retirement Planner'
		});
		expect(result).toContain('User is 30, interested in retirement planning.');
		expect(result).toContain('5');
		expect(result).toContain('Retirement Planner');
		expect(result).not.toContain('{{contextSummary}}');
		expect(result).not.toContain('{{suggestionsCount}}');
		expect(result).not.toContain('{{agentName}}');
	});
});

// ============================================================================
// Exhaustive: every prompt in PROMPT_DEFAULTS has zero unresolved placeholders
// when all its variables are supplied
// ============================================================================

describe('exhaustive interpolation — all prompts resolve completely', () => {
	/**
	 * Map of prompt_key → expected variables for that prompt.
	 * This is the contract between constants and callsites.
	 */
	const PROMPT_VARIABLES: Record<string, Record<string, string>> = {
		chunk_contextualization: { heading: 'Section A', text: 'Some text content' },
		batch_chunk_contextualization: { chunks: '1. Chunk one\n2. Chunk two' },
		document_extraction: { sample_text: 'Tax return for Jane, 2025' },
		document_extraction_system: {},
		default_system_prompt: { personality: 'Be friendly', user_context: 'User in NYC' },
		agent_instructions: {},
		chat_title_generation: {
			userMessage: 'Help with taxes',
			assistantResponse: 'Sure, I can help'
		},
		intent_classification: { categories: 'buy, sell', message: 'Buy AAPL' },
		note_categorization: { agentContext: 'Agent: Advisor', noteContent: 'File taxes by April' },
		search_knowledge_base_description: {},
		query_rewrite: { maxVariations: '3', userQuery: 'What is my tax bill?' },
		session_extraction: {
			currentDateTime: '2026-03-29T00:00:00Z',
			messageCount: '10',
			conversationText: 'User: Hi\nBot: Hello',
			existingEntitiesBlock: '',
			sessionEndNote: '',
			summaryInstruction: 'Brief summary'
		},
		profile_extraction: {
			profilerSystemPrompt: 'Extract profile.',
			schemaDefinitions: 'fields: [name]',
			profileContext: 'name=John',
			messageCount: '5',
			conversationText: 'User: I am John'
		},
		profile_schema_generation: { systemPrompt: 'Analyze goals' },
		profile_summary_system: {},
		profile_summary_user: { contextSections: 'Personal: Age 30' },
		onboarding_system_prompt: { profiler_data: 'some data', previous_answers: 'some answers' },
		onboarding_question_user: { context: 'First question' },
		onboarding_tag_assignment: { user_facts: 'risk: low', tag_catalog: 'segment:conservative' },
		agent_shelf_selection: { user_facts: 'age: 25', agent_list: '- advisor: Advice' },
		personalized_suggestions_system: {
			agentName: 'Advisor',
			agentDescription: 'Planning',
			suggestionsCount: '4'
		},
		personalized_suggestions_user: {
			contextSummary: 'User context here',
			suggestionsCount: '4',
			agentName: 'Advisor'
		},
		classifier_node_default: {
			categoryDescriptions: '- a: Cat A',
			input: 'some input',
			categoryIds: 'a, b'
		},
		classifier_node_suffix: { categoryDescriptions: '- a: Cat A', categoryIds: 'a, b' }
	};

	for (const [key, vars] of Object.entries(PROMPT_VARIABLES)) {
		it(`${key}: all placeholders resolve with expected variables`, () => {
			const template = PROMPT_DEFAULTS[key as keyof typeof PROMPT_DEFAULTS];
			expect(template, `${key} not found in PROMPT_DEFAULTS`).toBeDefined();

			const result = interpolatePrompt(template, vars);
			const remaining = result.match(/\{\{\w+\}\}/g) ?? [];
			expect(remaining, `Unresolved placeholders in ${key}: ${remaining.join(', ')}`).toEqual([]);
		});
	}

	it('PROMPT_VARIABLES covers every key in PROMPT_DEFAULTS', () => {
		const defaultKeys = Object.keys(PROMPT_DEFAULTS).sort();
		const testKeys = Object.keys(PROMPT_VARIABLES).sort();
		expect(testKeys).toEqual(defaultKeys);
	});

	it('placeholder count matches variable count for prompts with variables', () => {
		for (const [key, vars] of Object.entries(PROMPT_VARIABLES)) {
			const template = PROMPT_DEFAULTS[key as keyof typeof PROMPT_DEFAULTS];
			const placeholders = extractPlaceholders(template);
			const varKeys = Object.keys(vars);

			// Every placeholder should have a corresponding variable
			for (const ph of placeholders) {
				expect(varKeys, `${key}: missing variable "${ph}"`).toContain(ph);
			}
		}
	});
});
