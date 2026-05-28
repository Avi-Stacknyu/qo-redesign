import { describe, expect, it } from 'vitest';
import { buildTranscriptEvent, formatTranscriptForProfiler } from '../onboarding-transcript';
import type { Question } from '../../types/onboarding';

describe('onboarding-transcript', () => {
	it('builds transcript events with granted option tags', () => {
		const question: Question = {
			id: 'occupation',
			factKey: 'occupation',
			factLabel: 'Occupation',
			type: 'single_select',
			question: 'What is your occupation?',
			sidebarTitle: 'Occupation',
			required: true,
			options: [{ value: 'doctor', label: 'Doctor', grantsTags: ['role:doctor'] }]
		};

		const event = buildTranscriptEvent(question, {
			questionId: 'occupation',
			factKey: 'occupation',
			type: 'single_select',
			value: 'doctor',
			displayValue: 'Doctor',
			answeredAt: '2026-05-02T00:00:00.000Z'
		});

		expect(event).toEqual(
			expect.objectContaining({
				questionId: 'occupation',
				prompt: 'What is your occupation?',
				answerText: 'Doctor',
				grantedTags: ['role:doctor']
			})
		);
	});

	it('formats transcript as question-answer text for profiler extraction', () => {
		const text = formatTranscriptForProfiler([
			{
				questionId: 'occupation',
				factKey: 'occupation',
				phase: 'manual',
				prompt: 'What is your occupation?',
				answer: 'doctor',
				answerText: 'Doctor',
				grantedTags: ['role:doctor'],
				createdAt: '2026-05-02T00:00:00.000Z'
			}
		]);

		expect(text).toContain('Onboarding answer transcript:');
		expect(text).toContain('Q: What is your occupation?');
		expect(text).toContain('A: Doctor');
	});
});
