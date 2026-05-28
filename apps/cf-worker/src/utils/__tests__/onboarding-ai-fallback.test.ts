import { describe, expect, it } from 'vitest';
import {
	isLegacyFinanceFallbackQuestion,
	selectFallbackAIQuestion
} from '../onboarding-ai-helpers';

const financeLeakPattern = /investment|portfolio|financial|retirement|risk tolerance/i;

function questionText(question: NonNullable<ReturnType<typeof selectFallbackAIQuestion>>): string {
	return [
		question.id,
		question.factKey,
		question.factLabel,
		question.question,
		question.description,
		...(question.options ?? []).flatMap((option) => [
			option.value,
			option.label,
			option.description
		])
	]
		.filter(Boolean)
		.join(' ');
}

describe('selectFallbackAIQuestion', () => {
	it('uses profile-configured fallback questions before global fallbacks', () => {
		const question = selectFallbackAIQuestion(
			[],
			[
				{
					id: 'neet_revision_support',
					factKey: 'neet_revision_support',
					factLabel: 'Revision Support',
					type: 'single_select',
					question: 'Which NEET revision support would help you most right now?',
					sidebarTitle: 'Revision Support',
					required: true,
					options: [
						{ value: 'daily_plan', label: 'Daily revision plan' },
						{ value: 'mock_review', label: 'Mock test review' }
					]
				}
			]
		);

		expect(question?.id).toBe('neet_revision_support');
		expect(question?.question).toContain('NEET');
	});

	it('skips profile-configured fallback facts that were already answered', () => {
		const question = selectFallbackAIQuestion(
			[{ factKey: 'neet_revision_support' }],
			[
				{
					id: 'neet_revision_support',
					factKey: 'neet_revision_support',
					factLabel: 'Revision Support',
					type: 'single_select',
					question: 'Which NEET revision support would help you most right now?',
					sidebarTitle: 'Revision Support',
					required: true,
					options: []
				},
				{
					id: 'neet_mock_support',
					factKey: 'neet_mock_support',
					factLabel: 'Mock Support',
					type: 'text',
					question: 'What usually goes wrong in your NEET mock tests?',
					sidebarTitle: 'Mock Support',
					required: true
				}
			]
		);

		expect(question?.id).toBe('neet_mock_support');
	});

	it('does not leak finance-specific fallback questions into non-finance profiles', () => {
		const question = selectFallbackAIQuestion([]);

		expect(question).not.toBeNull();
		expect(questionText(question!)).not.toMatch(financeLeakPattern);
	});

	it('skips fallback facts that were already answered', () => {
		const question = selectFallbackAIQuestion([{ factKey: 'current_priority' }]);

		expect(question?.factKey).not.toBe('current_priority');
	});

	it('returns null after all neutral fallback questions have been answered', () => {
		const question = selectFallbackAIQuestion([
			{ factKey: 'current_priority' },
			{ factKey: 'support_needs' },
			{ factKey: 'additional_context' }
		]);

		expect(question).toBeNull();
	});
});

describe('isLegacyFinanceFallbackQuestion', () => {
	it('detects persisted finance fallback questions from older sessions', () => {
		expect(
			isLegacyFinanceFallbackQuestion({
				id: 'fallback_investment_timeline',
				factKey: 'investment_timeline',
				factLabel: 'Investment Timeline',
				type: 'checkbox',
				question: 'What is your investment time horizon?',
				sidebarTitle: 'Time Horizon',
				required: true,
				options: []
			})
		).toBe(true);
	});

	it('does not flag neutral fallback questions', () => {
		const question = selectFallbackAIQuestion([]);

		expect(question).not.toBeNull();
		expect(isLegacyFinanceFallbackQuestion(question)).toBe(false);
	});
});
