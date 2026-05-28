import type {
	OnboardingAnswerRecord,
	OnboardingTranscriptEvent,
	OnboardingAnswerValue,
	Question
} from '../types/onboarding';

function answerValues(answer: OnboardingAnswerValue): string[] {
	return Array.isArray(answer) ? answer : [String(answer)];
}

export function collectGrantedTags(question: Question, answer: OnboardingAnswerValue): string[] {
	const values = new Set(answerValues(answer));
	const tags = new Set<string>();
	for (const option of question.options ?? []) {
		if (!values.has(option.value)) continue;
		for (const tag of option.grantsTags ?? []) {
			if (tag.trim()) tags.add(tag.trim());
		}
	}
	return [...tags];
}

export function buildTranscriptEvent(
	question: Question,
	answer: OnboardingAnswerRecord,
	phase: OnboardingTranscriptEvent['phase'] = 'manual'
): OnboardingTranscriptEvent {
	return {
		questionId: question.id,
		factKey: question.factKey,
		phase,
		prompt: question.question,
		answer: answer.value,
		answerText: answer.displayValue,
		grantedTags: collectGrantedTags(question, answer.value),
		createdAt: answer.answeredAt
	};
}

export function formatTranscriptForProfiler(events: OnboardingTranscriptEvent[]): string {
	if (events.length === 0) return 'Onboarding answer transcript: (empty)';
	return [
		'Onboarding answer transcript:',
		'',
		...events.flatMap((event) => [`Q: ${event.prompt}`, `A: ${event.answerText}`, ''])
	]
		.join('\n')
		.trimEnd();
}
