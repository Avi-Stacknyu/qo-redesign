import { describe, expect, it } from 'vitest';
import { determineNextPhase } from '../services/onboarding-flow';

describe('determineNextPhase', () => {
	it('stays in preset when more preset questions exist', () => {
		const result = determineNextPhase({
			currentPhase: 'preset',
			hasMorePresetQuestions: true,
			maxAiQuestions: 3,
			aiQuestionsAsked: 0
		});
		expect(result).toBe('preset');
	});

	it('transitions from preset to ai when preset exhausted and maxAiQuestions > 0', () => {
		const result = determineNextPhase({
			currentPhase: 'preset',
			hasMorePresetQuestions: false,
			maxAiQuestions: 3,
			aiQuestionsAsked: 0
		});
		expect(result).toBe('ai');
	});

	it('transitions from preset to complete when no AI questions configured', () => {
		const result = determineNextPhase({
			currentPhase: 'preset',
			hasMorePresetQuestions: false,
			maxAiQuestions: 0,
			aiQuestionsAsked: 0
		});
		expect(result).toBe('complete');
	});

	it('stays in ai when more AI questions remain', () => {
		const result = determineNextPhase({
			currentPhase: 'ai',
			hasMorePresetQuestions: false,
			maxAiQuestions: 3,
			aiQuestionsAsked: 1
		});
		expect(result).toBe('ai');
	});

	it('transitions from ai to complete when max AI questions reached', () => {
		const result = determineNextPhase({
			currentPhase: 'ai',
			hasMorePresetQuestions: false,
			maxAiQuestions: 3,
			aiQuestionsAsked: 3
		});
		expect(result).toBe('complete');
	});

	it('stays complete if already complete', () => {
		const result = determineNextPhase({
			currentPhase: 'complete',
			hasMorePresetQuestions: false,
			maxAiQuestions: 3,
			aiQuestionsAsked: 3
		});
		expect(result).toBe('complete');
	});

	it('transitions to complete when AI questions exceed max', () => {
		const result = determineNextPhase({
			currentPhase: 'ai',
			hasMorePresetQuestions: false,
			maxAiQuestions: 2,
			aiQuestionsAsked: 5
		});
		expect(result).toBe('complete');
	});
});
