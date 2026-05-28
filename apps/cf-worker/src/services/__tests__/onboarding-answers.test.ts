import { describe, expect, it } from 'vitest';
import { normalizeOnboardingAnswer } from '../onboarding-answers';
import type { Question } from '../../types/onboarding';

function createQuestion(overrides: Partial<Question>): Question {
	return {
		id: 'q1',
		factKey: 'q1',
		factLabel: 'Question',
		type: 'text',
		question: 'Question?',
		sidebarTitle: 'Question',
		required: true,
		...overrides
	};
}

describe('onboarding-answers', () => {
	it('normalizes legacy checkbox as a single select answer', () => {
		const answer = normalizeOnboardingAnswer(
			createQuestion({
				type: 'checkbox',
				options: [{ value: 'yes', label: 'Yes' }]
			}),
			'yes'
		);

		expect(answer.value).toBe('yes');
		expect(answer.type).toBe('single_select');
		expect(answer.displayValue).toBe('Yes');
	});

	it('accepts normalized single select question types', () => {
		const answer = normalizeOnboardingAnswer(
			createQuestion({
				type: 'single_select',
				options: [{ value: 'finance', label: 'Finance' }]
			}),
			'finance'
		);

		expect(answer.value).toBe('finance');
		expect(answer.type).toBe('single_select');
		expect(answer.displayValue).toBe('Finance');
	});

	it('requires multi-select answers to remain arrays', () => {
		const answer = normalizeOnboardingAnswer(
			createQuestion({
				type: 'multiselect',
				options: [
					{ value: 'income', label: 'Income' },
					{ value: 'growth', label: 'Growth' }
				]
			}),
			['income', 'growth']
		);

		expect(answer.value).toEqual(['income', 'growth']);
		expect(answer.type).toBe('multi_select');
		expect(answer.displayValue).toBe('Income, Growth');
	});

	it('rejects comma serialized multi-select answers', () => {
		expect(() =>
			normalizeOnboardingAnswer(
				createQuestion({ type: 'multiselect', options: [] }),
				'income,growth'
			)
		).toThrow('Invalid options');
	});
});
