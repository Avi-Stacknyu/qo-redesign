import { describe, expect, it } from 'vitest';
import { buildAIQuestionPrompt, buildOnboardingQuestionSystemPrompt } from '../utils/prompts';

describe('buildAIQuestionPrompt', () => {
	it('includes the profile system prompt', () => {
		const prompt = buildAIQuestionPrompt({
			profileSystemPrompt: 'Onboard medical professionals in private practice.',
			answeredFacts: []
		});
		expect(prompt).toContain('Onboard medical professionals in private practice.');
	});

	it('includes answered facts in the prompt', () => {
		const prompt = buildAIQuestionPrompt({
			profileSystemPrompt: 'Onboard doctors.',
			answeredFacts: [
				{ factKey: 'specialty', label: 'Specialty', answer: 'Cardiology' },
				{ factKey: 'experience', label: 'Years of Experience', answer: '15' }
			]
		});
		expect(prompt).toContain('Specialty: Cardiology');
		expect(prompt).toContain('Years of Experience: 15');
	});

	it('includes array answers formatted with commas', () => {
		const prompt = buildAIQuestionPrompt({
			profileSystemPrompt: 'Test',
			answeredFacts: [
				{ factKey: 'interests', label: 'Interests', answer: ['stocks', 'crypto', 'bonds'] }
			]
		});
		expect(prompt).toContain('Interests: stocks, crypto, bonds');
	});

	it('shows "No facts collected" when no answers exist', () => {
		const prompt = buildAIQuestionPrompt({
			profileSystemPrompt: 'Test',
			answeredFacts: []
		});
		expect(prompt).toContain('No facts collected yet.');
	});

	it('includes instructions about question generation', () => {
		const prompt = buildAIQuestionPrompt({
			profileSystemPrompt: 'Test',
			answeredFacts: []
		});
		expect(prompt).toContain('Generate ONE question');
		expect(prompt).toContain('single_select, multi_select, text, number, boolean');
		expect(prompt).toContain('Do NOT ask about information already provided');
	});

	it('does not include schema gaps section', () => {
		const prompt = buildAIQuestionPrompt({
			profileSystemPrompt: 'Test',
			answeredFacts: [{ factKey: 'name', label: 'Name', answer: 'John' }]
		});
		expect(prompt).not.toContain('Schema Gaps');
		expect(prompt).not.toContain('All known schema fields');
	});

	it('adds a domain guard to generated question system prompts', () => {
		const prompt = buildOnboardingQuestionSystemPrompt(
			'You are onboarding a NEET aspirant preparing for medical entrance exams.'
		);

		expect(prompt).toContain('Stay strictly within the domain');
		expect(prompt).toContain('Do not ask generic financial');
		expect(prompt).toContain('unless the profile prompt explicitly');
	});
});
