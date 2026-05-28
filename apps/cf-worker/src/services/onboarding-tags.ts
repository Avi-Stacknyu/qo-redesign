import type { OnboardingAnswerValue } from '../types/onboarding';

type CapturedLocation = { country?: string; timezone?: string; continent?: string; city?: string };
type ProfilerTagFact = { factKey: string; answer: OnboardingAnswerValue | undefined };
type TranscriptTagEvent = { grantedTags?: string[] };

function uniqueTags(tags: string[]): string[] {
	return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

export function buildOnboardingTags(input: {
	capturedLocation?: CapturedLocation;
	profilerData?: ProfilerTagFact[];
	transcript?: TranscriptTagEvent[];
	defaultTags?: string[];
}): string[] {
	const tags: string[] = [];

	if (input.capturedLocation?.country) {
		tags.push(`geo:${input.capturedLocation.country.toLowerCase()}`);
	}

	const roleFact = input.profilerData?.find(
		(fact) =>
			fact.factKey === 'profession' || fact.factKey === 'role' || fact.factKey === 'occupation'
	);
	if (roleFact && typeof roleFact.answer === 'string' && roleFact.answer.trim()) {
		tags.push(`role:${roleFact.answer.trim().toLowerCase().replace(/\s+/g, '_')}`);
	}

	for (const event of input.transcript ?? []) {
		for (const tag of event.grantedTags ?? []) tags.push(tag);
	}

	tags.push(...(input.defaultTags ?? []));

	return uniqueTags(tags);
}

export function buildCompletionTags(input: {
	capturedLocation?: CapturedLocation;
	profilerData?: ProfilerTagFact[];
	transcript?: TranscriptTagEvent[];
	defaultTags?: string[];
	aiTags?: string[];
}): string[] {
	return uniqueTags([...buildOnboardingTags(input), ...(input.aiTags ?? [])]);
}
