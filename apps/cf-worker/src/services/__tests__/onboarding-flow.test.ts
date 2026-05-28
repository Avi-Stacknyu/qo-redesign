import { describe, expect, it } from 'vitest';
import {
	evaluateShowWhen,
	findNextVisibleQuestion,
	normalizeQuestionType,
	type FlowAnswerState
} from '../onboarding-flow';
import type { Question } from '../../types/onboarding';

const questions: Question[] = [
	{
		id: 'occupation',
		factKey: 'occupation',
		factLabel: 'Occupation',
		type: 'single_select',
		question: 'What is your occupation?',
		sidebarTitle: 'Occupation',
		required: true,
		order: 1,
		enabled: true,
		options: [
			{ value: 'doctor', label: 'Doctor' },
			{ value: 'founder', label: 'Founder' }
		]
	},
	{
		id: 'medical-specialty',
		factKey: 'medical_specialty',
		factLabel: 'Medical Specialty',
		type: 'single_select',
		question: 'What area of medicine do you practice?',
		sidebarTitle: 'Specialty',
		required: true,
		order: 2,
		enabled: true,
		showWhen: { all: [{ questionId: 'occupation', operator: 'equals', value: 'doctor' }] },
		options: [{ value: 'cardiology', label: 'Cardiology' }]
	},
	{
		id: 'goals',
		factKey: 'goals',
		factLabel: 'Goals',
		type: 'multi_select',
		question: 'What are your goals?',
		sidebarTitle: 'Goals',
		required: true,
		order: 3,
		enabled: true,
		options: [
			{ value: 'income', label: 'Income' },
			{ value: 'growth', label: 'Growth' }
		]
	}
];

describe('onboarding-flow', () => {
	it('normalizes legacy question types', () => {
		expect(normalizeQuestionType('checkbox')).toBe('single_select');
		expect(normalizeQuestionType('multiselect')).toBe('multi_select');
		expect(normalizeQuestionType('text')).toBe('text');
	});

	it('evaluates showWhen conditions against previous answers', () => {
		const state: FlowAnswerState = {
			answersByQuestionId: { occupation: 'doctor' },
			answersByFactKey: { occupation: 'doctor' }
		};

		expect(evaluateShowWhen(questions[1].showWhen, state)).toBe(true);
	});

	it('supports includes_any for multi-select answers', () => {
		const state: FlowAnswerState = {
			answersByQuestionId: { goals: ['income', 'growth'] },
			answersByFactKey: { goals: ['income', 'growth'] }
		};

		expect(
			evaluateShowWhen(
				{ any: [{ questionId: 'goals', operator: 'includes_any', value: ['preserve', 'growth'] }] },
				state
			)
		).toBe(true);
	});

	it('finds the next unanswered visible question in order', () => {
		const next = findNextVisibleQuestion(questions, {
			answersByQuestionId: { occupation: 'doctor' },
			answersByFactKey: { occupation: 'doctor' }
		});

		expect(next?.id).toBe('medical-specialty');
	});

	it('skips previously skipped visible questions when finding the next question', () => {
		const next = findNextVisibleQuestion(questions, {
			answersByQuestionId: { occupation: 'doctor' },
			answersByFactKey: { occupation: 'doctor' },
			skippedQuestionIds: ['medical-specialty']
		});

		expect(next?.id).toBe('goals');
	});
});
