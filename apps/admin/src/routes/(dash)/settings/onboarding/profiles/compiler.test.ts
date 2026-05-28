import { describe, expect, it } from 'vitest';
import {
	buildCompilerPrompt,
	buildStrictOnboardingMarkdownExport,
	compileOnboardingMarkdownDraft,
	compileStrictOnboardingMarkdown,
	validateCompilerOutput,
	type CompilerOutput
} from './compiler';

describe('buildCompilerPrompt', () => {
	it('injects profile schema sections and tag taxonomy into the context block', () => {
		const prompt = buildCompilerPrompt({
			markdown: '# Medical Professionals\nOnboard doctors in private practice.',
			schemaSections: [
				{
					id: 'financial',
					name: 'Financial',
					fields: [{ key: 'income_range', label: 'Income Range' }]
				}
			],
			tagTaxonomy: ['industry:medical', 'industry:finance', 'role:doctor']
		});

		expect(prompt.system).toContain('onboarding configuration generator');
		expect(prompt.context).toContain('financial');
		expect(prompt.context).toContain('income_range');
		expect(prompt.context).toContain('Income Range');
		expect(prompt.context).toContain('industry:medical');
		expect(prompt.user).toContain('Medical Professionals');
	});

	it('handles empty schema sections gracefully', () => {
		const prompt = buildCompilerPrompt({
			markdown: '# Test',
			schemaSections: [],
			tagTaxonomy: []
		});

		expect(prompt.context).toContain('No schema sections defined yet');
		expect(prompt.context).toContain('No tags defined yet');
	});

	it('describes disclosures separately from onboarding questions', () => {
		const prompt = buildCompilerPrompt({
			markdown: '# Compliance Profile',
			schemaSections: [],
			tagTaxonomy: []
		});

		expect(prompt.context).toContain('"disclosures"');
		expect(prompt.context).toContain('accept_deny');
		expect(prompt.context).toContain('before onboarding questions');
	});
});

describe('validateCompilerOutput', () => {
	it('accepts valid complete output', () => {
		const output: CompilerOutput = {
			summary: {
				name: 'Medical',
				description: 'For doctors',
				industryKey: 'medical',
				maxAiQuestions: 3
			},
			questions: [
				{
					question: 'What is your specialty?',
					type: 'single_select',
					factKey: 'specialty',
					options: [
						{ label: 'Cardiology', value: 'cardiology' },
						{ label: 'Neurology', value: 'neurology' }
					],
					order: 1,
					required: true
				}
			],
			runtimePrompt:
				'You are onboarding a medical professional. Ask about their practice and goals.',
			suggestedTags: ['industry:medical']
		};
		const result = validateCompilerOutput(output);
		expect(result.success).toBe(true);
	});

	it('rejects output with empty questions array', () => {
		const output = {
			summary: {
				name: 'Test',
				description: 'Test profile',
				industryKey: 'test',
				maxAiQuestions: 3
			},
			questions: [],
			runtimePrompt: 'Some prompt text here',
			suggestedTags: []
		};
		const result = validateCompilerOutput(output);
		expect(result.success).toBe(false);
	});

	it('rejects output with missing summary fields', () => {
		const output = {
			summary: { name: '' },
			questions: [{ question: 'test', type: 'text', factKey: 'test', order: 1, required: true }],
			runtimePrompt: 'Some prompt text here',
			suggestedTags: []
		};
		const result = validateCompilerOutput(output as any);
		expect(result.success).toBe(false);
	});

	it('rejects output with invalid question type', () => {
		const output = {
			summary: { name: 'Test', description: 'Test', industryKey: 'test', maxAiQuestions: 3 },
			questions: [
				{ question: 'test', type: 'invalid_type', factKey: 'test', order: 1, required: true }
			],
			runtimePrompt: 'Some prompt text here',
			suggestedTags: []
		};
		const result = validateCompilerOutput(output as any);
		expect(result.success).toBe(false);
	});

	it('accepts output with showWhen conditions', () => {
		const output: CompilerOutput = {
			summary: {
				name: 'Finance',
				description: 'For advisors',
				industryKey: 'finance',
				maxAiQuestions: 5
			},
			questions: [
				{
					question: 'Your role?',
					type: 'single_select',
					factKey: 'role',
					options: [
						{ label: 'Advisor', value: 'advisor' },
						{ label: 'Analyst', value: 'analyst' }
					],
					order: 1,
					required: true
				},
				{
					question: 'Client count?',
					type: 'number',
					factKey: 'client_count',
					order: 2,
					required: false,
					showWhen: { factKey: 'role', operator: 'eq', value: 'advisor' }
				}
			],
			runtimePrompt: 'You are onboarding a finance professional...',
			suggestedTags: ['industry:finance']
		};
		const result = validateCompilerOutput(output);
		expect(result.success).toBe(true);
	});
});

describe('compileOnboardingMarkdownDraft', () => {
	it('parses the strict Edwin markdown format without AI-only guessing', () => {
		const result = compileOnboardingMarkdownDraft(`# Education VIP Onboarding

## Profile
- key: education-vip
- description: Intake for VIP education clients.
- industry_key: education
- visibility: invite_only
- default_tags: industry:education, tier:vip
- runtime_model: model-premium-1
- max_ai_questions: 6

## Prompt
You are onboarding a VIP education client. Ask precise follow-up questions about goals and funding needs.

## Questions
### Current role
- question: What best describes your current education role?
- type: single_select
- fact_key: education_role
- required: true
- group: Basics
- options: Student | student | role:student; Parent | parent | role:parent

### Institution name
- question: Which institution are you associated with?
- type: text
- fact_key: institution_name
- required: false
- show_when: education_role equals student
`);

		expect(result.summary).toMatchObject({
			name: 'Education VIP Onboarding',
			description: 'Intake for VIP education clients.',
			industryKey: 'education',
			visibility: 'invite_only',
			defaultTags: ['industry:education', 'tier:vip'],
			runtimeModel: 'model-premium-1',
			maxAiQuestions: 6
		});
		expect(result.runtimePrompt).toContain('VIP education client');
		expect(result.questions).toHaveLength(2);
		expect(result.questions[0]).toMatchObject({
			question: 'What best describes your current education role?',
			type: 'single_select',
			factKey: 'education_role',
			group: 'Basics',
			options: [
				{ label: 'Student', value: 'student', grantsTags: ['role:student'] },
				{ label: 'Parent', value: 'parent', grantsTags: ['role:parent'] }
			]
		});
		expect(result.questions[1].showWhen).toEqual({
			all: [{ factKey: 'education_role', operator: 'equals', value: 'student' }]
		});
		expect(result.suggestedTags).toEqual(['industry:education', 'tier:vip']);
	});

	it('parses composite conditional rules and question metadata in strict markdown', () => {
		const result = compileOnboardingMarkdownDraft(`# Founder Liquidity Intake

## Profile
- key: founder-liquidity
- description: Intake for founders planning a liquidity event.
- industry_key: venture
- visibility: hidden
- default_tags: industry:venture, journey:liquidity
- max_ai_questions: 5

## Prompt
You are onboarding a founder preparing for a liquidity event. Ask focused questions about timing, ownership, and constraints.

## Questions
### Current role
- question: What best describes your role?
- type: single_select
- fact_key: user_role
- required: true
- options: Founder | founder | role:founder; Operator | operator | role:operator

### Planning goals
- question: Which outcomes matter most right now?
- type: multi_select
- fact_key: planning_goals
- required: true
- options: Exit planning | exit | goal:exit; Liquidity planning | liquidity | goal:liquidity; Tax planning | tax | goal:tax

### Exit timing
- question: What is your expected liquidity timeline?
- type: text
- fact_key: exit_timeline
- required: false
- description: Capture the expected window for a sale or secondary event.
- sidebar_title: Liquidity timing
- group: Liquidity
- show_when_all: user_role equals founder; planning_goals includes_any exit, liquidity
- show_when_any: user_role equals founder; planning_goals includes tax
`);

		expect(result.summary).toMatchObject({
			name: 'Founder Liquidity Intake',
			visibility: 'hidden',
			defaultTags: ['industry:venture', 'journey:liquidity']
		});
		expect(result.questions[2]).toMatchObject({
			factKey: 'exit_timeline',
			description: 'Capture the expected window for a sale or secondary event.',
			sidebarTitle: 'Liquidity timing',
			group: 'Liquidity',
			showWhen: {
				all: [
					{ factKey: 'user_role', operator: 'equals', value: 'founder' },
					{ factKey: 'planning_goals', operator: 'includes_any', value: ['exit', 'liquidity'] }
				],
				any: [
					{ factKey: 'user_role', operator: 'equals', value: 'founder' },
					{ factKey: 'planning_goals', operator: 'includes', value: 'tax' }
				]
			}
		});
	});

	it('creates a draft profile configuration from pasted markdown', () => {
		const result = compileOnboardingMarkdownDraft(`# Private Wealth Discovery

For onboarding founders and family office clients who need portfolio, goals, and liquidity profiling.

## Questions
- What is your approximate net worth range?
- Which asset classes do you currently hold? (Public equities, Private equity, Real estate, Cash)
- Do you have any debt obligations?

## Tags
- industry:wealth
- role:founder
`);

		expect(result.summary.name).toBe('Private Wealth Discovery');
		expect(result.summary.industryKey).toBe('private-wealth-discovery');
		expect(result.questions).toHaveLength(3);
		expect(result.questions[0]).toMatchObject({
			question: 'What is your approximate net worth range?',
			type: 'text',
			factKey: 'approximate_net_worth_range',
			order: 1,
			required: true
		});
		expect(result.questions[1]).toMatchObject({
			type: 'multi_select',
			factKey: 'asset_classes_currently_hold'
		});
		expect(result.questions[1].options).toEqual([
			{ label: 'Public equities', value: 'public_equities' },
			{ label: 'Private equity', value: 'private_equity' },
			{ label: 'Real estate', value: 'real_estate' },
			{ label: 'Cash', value: 'cash' }
		]);
		expect(result.suggestedTags).toEqual(['industry:wealth', 'role:founder']);
	});
});

describe('compileStrictOnboardingMarkdown AI fallback questions section', () => {
	it('parses profile-scoped AI fallback questions', () => {
		const result = compileStrictOnboardingMarkdown(`# NEET Aspirant Profiler

## Profile
- key: neet-aspirant
- description: Profile for NEET aspirants.
- industry_key: education
- max_ai_questions: 8

## Prompt
You are onboarding a NEET aspirant preparing for the medical entrance exam.

## Questions
### Preparation stage
- question: What best describes your current NEET preparation stage?
- type: single_select
- fact_key: preparation_stage
- required: true
- options: Class 11 | class_11 | stage:foundation; Dropper | dropper | stage:dropper

## AI Fallback Questions
### Mock test support
- question: What support would improve your NEET mock test performance?
- type: single_select
- fact_key: neet_mock_support
- required: true
- sidebar_title: Mock Support
- options: Detailed analysis | analysis; Time management plan | time_management
`);

		expect(result).not.toBeNull();
		expect(result!.aiFallbackQuestions).toEqual([
			{
				id: 'fallback_neet_mock_support',
				question: 'What support would improve your NEET mock test performance?',
				type: 'single_select',
				factKey: 'neet_mock_support',
				factLabel: 'Mock Support',
				sidebarTitle: 'Mock Support',
				required: true,
				options: [
					{ label: 'Detailed analysis', value: 'analysis' },
					{ label: 'Time management plan', value: 'time_management' }
				]
			}
		]);
	});
});

describe('compileStrictOnboardingMarkdown disclosures and extended profile config', () => {
	it('parses disclosures and round-trip profile settings from strict markdown', () => {
		const result = compileStrictOnboardingMarkdown(`# Founder Compliance Intake

## Profile
- key: founder-compliance
- description: Intake for founders with compliance disclosures.
- industry_key: venture
- status: archived
- visibility: invite_only
- default_tags: industry:venture, workflow:compliance
- runtime_model: model_runtime_founder
- max_ai_questions: 4
- session_timeout_ms: 900000
- cache_ttl_ms: 120000
- enable_trial_activation: false

## Disclosures
- enabled: true

### Data processing acknowledgement
- id: disclosure_data_processing
- question: I acknowledge that Quant Orion will process onboarding responses to personalise the experience.
- type: acknowledgement
- required: true

### Terms acceptance
- id: disclosure_terms_acceptance
- question: I agree to the onboarding terms and data handling policy.
- type: accept_deny
- required: true

## Prompt
You are onboarding founders with compliance disclosures. Ask only the minimum follow-up questions needed to complete missing profile context.

## Questions
### Current role
- question: What best describes your role?
- type: single_select
- fact_key: user_role
- required: true
- enabled: false
- options: Founder | founder | role:founder; Operator | operator | role:operator
`);

		expect(result).not.toBeNull();
		expect(result!.summary).toMatchObject({
			key: 'founder-compliance',
			industryKey: 'venture',
			status: 'archived',
			visibility: 'invite_only',
			runtimeModel: 'model_runtime_founder',
			maxAiQuestions: 4,
			sessionTimeoutMs: 900000,
			cacheTtlMs: 120000,
			enableTrialActivation: false,
			defaultTags: ['industry:venture', 'workflow:compliance']
		});
		expect(result!.disclosures).toEqual({
			enabled: true,
			items: [
				{
					id: 'disclosure_data_processing',
					question:
						'I acknowledge that Quant Orion will process onboarding responses to personalise the experience.',
					type: 'acknowledgement',
					required: true
				},
				{
					id: 'disclosure_terms_acceptance',
					question: 'I agree to the onboarding terms and data handling policy.',
					type: 'accept_deny',
					required: true
				}
			]
		});
		expect(result!.questions[0]).toMatchObject({ enabled: false });
	});
});

describe('buildStrictOnboardingMarkdownExport', () => {
	it('exports a complete markdown profile that can be imported again without losing disclosures', () => {
		const markdown = buildStrictOnboardingMarkdownExport({
			name: 'Roundtrip Profile',
			key: 'roundtrip-profile',
			description: 'Roundtrip export for onboarding profile changes.',
			industryKey: 'roundtrip',
			status: 'active',
			visibility: 'hidden',
			defaultTags: ['industry:roundtrip', 'flow:export'],
			runtimeModel: 'model_roundtrip',
			maxAiQuestions: 6,
			sessionTimeoutMs: 300000,
			cacheTtlMs: 60000,
			enableTrialActivation: true,
			disclosures: {
				enabled: true,
				items: [
					{
						id: 'roundtrip_disclosure_1',
						question: 'I acknowledge the export/import roundtrip.',
						title: 'Roundtrip Terms',
						body: 'Roundtrip disclosure body.',
						type: 'acknowledgement',
						required: true,
						acceptLabel: 'Accept',
						rejectLabel: 'Reject',
						rejectMessage: 'You must accept to continue.'
					}
				]
			},
			promptTemplate:
				'You are running the roundtrip onboarding flow. Ask concise follow-up questions when needed.',
			questions: [
				{
					question: 'What is your current onboarding goal?',
					type: 'text',
					factKey: 'current_goal',
					order: 1,
					required: true,
					enabled: true,
					description: 'Primary onboarding goal.',
					sidebarTitle: 'Goal',
					group: 'Basics'
				}
			],
			aiFallbackQuestions: [
				{
					id: 'roundtrip_fallback',
					question: 'What extra detail should we ask for if needed?',
					type: 'text',
					factKey: 'fallback_detail',
					factLabel: 'Fallback Detail',
					sidebarTitle: 'Fallback Detail',
					required: true
				}
			]
		});

		expect(markdown).toContain('## Disclosures');
		expect(markdown).toContain('- title: Roundtrip Terms');
		expect(markdown).toContain('- body: Roundtrip disclosure body.');
		expect(markdown).toContain('## Prompt');

		const parsed = compileStrictOnboardingMarkdown(markdown);
		expect(parsed).not.toBeNull();
		expect(parsed!.summary).toMatchObject({
			key: 'roundtrip-profile',
			status: 'active',
			visibility: 'hidden',
			runtimeModel: 'model_roundtrip',
			sessionTimeoutMs: 300000,
			cacheTtlMs: 60000
		});
		expect(parsed!.disclosures).toEqual({
			enabled: true,
			items: [
				{
					id: 'roundtrip_disclosure_1',
					question: 'I acknowledge the export/import roundtrip.',
					title: 'Roundtrip Terms',
					body: 'Roundtrip disclosure body.',
					type: 'acknowledgement',
					required: true,
					acceptLabel: 'Accept',
					rejectLabel: 'Reject',
					rejectMessage: 'You must accept to continue.'
				}
			]
		});
		expect(parsed!.questions[0]).toMatchObject({
			factKey: 'current_goal',
			enabled: true,
			group: 'Basics'
		});
		expect(parsed!.aiFallbackQuestions).toHaveLength(1);
	});
});
