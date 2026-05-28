import { describe, expect, it } from 'vitest';
import { buildProfileConfig, buildProfileQuestions } from '../utils/profile-config';

describe('buildProfileConfig', () => {
	it('maps a profile row with model/provider to OnboardingConfig', () => {
		const row = {
			profile: {
				id: 'p1',
				systemPrompt: 'prompt-id-1',
				maxAiQuestions: '5',
				sessionTimeoutMs: '1800000',
				cacheTtlMs: '3600000',
				model: 'm1',
				defaultTags: ['industry:education', 'tier:vip'],
				visibility: 'invite_only'
			},
			prompt: { promptTemplate: 'You are onboarding a doctor' },
			model: { modelId: 'gpt-4o', id: 'm1' },
			provider: { providerKey: 'openai' }
		};
		const config = buildProfileConfig(row);
		expect(config.id).toBe('p1');
		expect(config.max_ai_questions).toBe(5);
		expect(config.session_timeout_ms).toBe(1800000);
		expect(config.cache_ttl_ms).toBe(3600000);
		expect(config.modelId).toBe('gpt-4o');
		expect(config.providerKey).toBe('openai');
		expect(config.promptTemplate).toBe('You are onboarding a doctor');
		expect(config.enabled).toBe(true);
		expect(config.defaultTags).toEqual(['industry:education', 'tier:vip']);
		expect(config.visibility).toBe('invite_only');
	});

	it('handles null model and provider', () => {
		const row = {
			profile: {
				id: 'p2',
				systemPrompt: null,
				maxAiQuestions: null,
				sessionTimeoutMs: null,
				cacheTtlMs: null,
				model: null,
				defaultTags: null,
				visibility: null
			},
			prompt: null,
			model: null,
			provider: null
		};
		const config = buildProfileConfig(row);
		expect(config.modelId).toBeNull();
		expect(config.providerKey).toBeNull();
		expect(config.max_ai_questions).toBe(3); // DEFAULT_MAX_AI_QUESTIONS
		expect(config.system_prompt).toBe('');
		expect(config.defaultTags).toEqual([]);
		expect(config.visibility).toBe('public');
	});

	it('preserves an explicit zero AI question limit', () => {
		const row = {
			profile: {
				id: 'p3',
				systemPrompt: null,
				maxAiQuestions: '0',
				sessionTimeoutMs: null,
				cacheTtlMs: null,
				model: null,
				defaultTags: [],
				visibility: 'public'
			},
			prompt: null,
			model: null,
			provider: null
		};
		const config = buildProfileConfig(row);
		expect(config.max_ai_questions).toBe(0);
	});

	it('maps stored disclosure config', () => {
		const row = {
			profile: {
				id: 'p4',
				systemPrompt: null,
				maxAiQuestions: null,
				sessionTimeoutMs: null,
				cacheTtlMs: null,
				model: null,
				disclosures: {
					enabled: true,
					items: [
						{
							id: 'terms',
							question: 'I agree to the Terms.',
							title: 'Terms',
							body: 'Accept these terms.',
							type: 'accept_deny',
							required: true,
							acceptLabel: 'Agree',
							rejectLabel: 'No thanks',
							rejectMessage: 'You must agree.'
						}
					]
				}
			},
			prompt: null,
			model: null,
			provider: null
		};
		const config = buildProfileConfig(row);
		expect(config.disclosures).toEqual({
			enabled: true,
			items: [
				{
					id: 'terms',
					question: 'I agree to the Terms.',
					title: 'Terms',
					body: 'Accept these terms.',
					type: 'accept_deny',
					required: true,
					acceptLabel: 'Agree',
					rejectLabel: 'No thanks',
					rejectMessage: 'You must agree.'
				}
			]
		});
	});

	it('filters invalid disclosure items', () => {
		const row = {
			profile: {
				id: 'p4b',
				systemPrompt: null,
				maxAiQuestions: null,
				sessionTimeoutMs: null,
				cacheTtlMs: null,
				model: null,
				disclosures: {
					enabled: true,
					items: [
						{},
						{
							id: 'data_usage',
							question: 'I acknowledge data usage.',
							type: 'acknowledgement',
							required: true
						}
					]
				}
			},
			prompt: null,
			model: null,
			provider: null
		};

		const config = buildProfileConfig(row);

		expect(config.disclosures).toEqual({
			enabled: true,
			items: [
				{
					id: 'data_usage',
					question: 'I acknowledge data usage.',
					type: 'acknowledgement',
					required: true
				}
			]
		});
	});

	it('maps profile-scoped AI fallback questions', () => {
		const row = {
			profile: {
				id: 'p6',
				systemPrompt: null,
				maxAiQuestions: null,
				sessionTimeoutMs: null,
				cacheTtlMs: null,
				model: null,
				aiFallbackQuestions: [
					{
						id: 'neet_mock_support',
						factKey: 'neet_mock_support',
						factLabel: 'Mock Support',
						type: 'single_select',
						question: 'What support would improve your NEET mock test performance?',
						sidebarTitle: 'Mock Support',
						required: true,
						options: [{ value: 'analysis', label: 'Detailed analysis' }]
					}
				]
			},
			prompt: null,
			model: null,
			provider: null
		};

		const config = buildProfileConfig(row);

		expect(config.aiFallbackQuestions).toEqual([
			{
				id: 'neet_mock_support',
				factKey: 'neet_mock_support',
				factLabel: 'Mock Support',
				type: 'single_select',
				question: 'What support would improve your NEET mock test performance?',
				sidebarTitle: 'Mock Support',
				required: true,
				options: [{ value: 'analysis', label: 'Detailed analysis' }]
			}
		]);
	});

	it('omits disclosures when not configured', () => {
		const row = {
			profile: {
				id: 'p5',
				systemPrompt: null,
				maxAiQuestions: null,
				sessionTimeoutMs: null,
				cacheTtlMs: null,
				model: null
			},
			prompt: null,
			model: null,
			provider: null
		};
		const config = buildProfileConfig(row);
		expect(config.disclosures).toBeUndefined();
	});
});

describe('buildProfileQuestions', () => {
	it('filters disabled questions', () => {
		const rows = [
			{
				id: 'q1',
				question: 'What?',
				type: 'text',
				enabled: true,
				order: '1',
				required: true,
				showWhen: null,
				options: null,
				factKey: 'what',
				description: null,
				sidebarTitle: null,
				group: null,
				metadata: null
			},
			{
				id: 'q2',
				question: 'Disabled',
				type: 'text',
				enabled: false,
				order: '2',
				required: false,
				showWhen: null,
				options: null,
				factKey: 'skip',
				description: null,
				sidebarTitle: null,
				group: null,
				metadata: null
			}
		];
		const questions = buildProfileQuestions(rows);
		expect(questions).toHaveLength(1);
		expect(questions[0].id).toBe('q1');
	});

	it('parses JSON string options and preserves granted tags', () => {
		const rows = [
			{
				id: 'q1',
				question: 'Pick',
				type: 'single_select',
				enabled: true,
				order: '1',
				required: true,
				showWhen: null,
				options: JSON.stringify([{ label: 'A', value: 'a', grantsTags: ['role:student'] }]),
				factKey: 'pick',
				description: null,
				sidebarTitle: null,
				group: null,
				metadata: null
			}
		];
		const questions = buildProfileQuestions(rows);
		expect(questions[0].options).toHaveLength(1);
		expect(questions[0].options![0].label).toBe('A');
		expect(questions[0].options![0].grantsTags).toEqual(['role:student']);
	});

	it('normalizes legacy flat showWhen conditions to runtime rules', () => {
		const rows = [
			{
				id: 'q1',
				question: 'Institution?',
				type: 'text',
				enabled: true,
				order: '2',
				required: true,
				showWhen: { factKey: 'education_role', operator: 'eq', value: 'student' },
				options: null,
				factKey: 'institution_name',
				description: null,
				sidebarTitle: null,
				group: null,
				metadata: null
			}
		];
		const questions = buildProfileQuestions(rows);
		expect(questions[0].showWhen).toEqual({
			all: [{ factKey: 'education_role', operator: 'equals', value: 'student' }]
		});
	});

	it('handles array options directly', () => {
		const rows = [
			{
				id: 'q1',
				question: 'Pick',
				type: 'multi_select',
				enabled: true,
				order: '1',
				required: true,
				showWhen: null,
				options: [{ label: 'B', value: 'b' }],
				factKey: 'pick',
				description: null,
				sidebarTitle: null,
				group: null,
				metadata: null
			}
		];
		const questions = buildProfileQuestions(rows);
		expect(questions[0].options).toHaveLength(1);
	});

	it('uses factKey as id fallback and sidebarTitle for factLabel', () => {
		const rows = [
			{
				id: 'q1',
				question: 'Your role?',
				type: 'text',
				enabled: true,
				order: '1',
				required: true,
				showWhen: null,
				options: null,
				factKey: 'role',
				description: 'Pick your role',
				sidebarTitle: 'Role',
				group: 'basics',
				metadata: null
			}
		];
		const questions = buildProfileQuestions(rows);
		expect(questions[0].factKey).toBe('role');
		expect(questions[0].factLabel).toBe('Role');
		expect(questions[0].group).toBe('basics');
	});
});
