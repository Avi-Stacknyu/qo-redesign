import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type {
	AnswerResult,
	DisclosureConfig,
	DisclosureResult,
	OnboardingAnswerValue,
	QuestionData
} from '$lib/types/onboarding';

interface InitializeOnboardingResult {
	success: boolean;
	isComplete: boolean;
	disclosures?: DisclosureConfig;
	disclosuresPending?: boolean;
	rejectMessage?: string;
	error?: string;
}

export interface DisclosureSubmissionResult extends DisclosureResult {
	questionData?: QuestionData;
	completed?: boolean;
	redirectTo?: string;
}

type OnboardingDoResponse = Partial<QuestionData> & DisclosureResult & { completed?: boolean };

/**
 * Get a Durable Object stub for the user's onboarding session.
 */
function getStub(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const env = event.platform?.env;
	if (!env?.ONBOARDING_SESSION) throw error(500, 'Durable Objects not available');

	const id = env.ONBOARDING_SESSION.idFromName(user.id);
	return env.ONBOARDING_SESSION.get(id);
}

/**
 * Initialize (or resume) the onboarding session.
 * Sends CF geo headers so the DO can auto-detect location.
 */
export async function initializeOnboarding(
	event: RequestEvent,
	assignment?: { profileId: string; assignmentId: string }
): Promise<InitializeOnboardingResult> {
	const user = event.locals.user;
	if (user?.onboardingComplete) {
		return { success: true, isComplete: true };
	}

	let stub;
	try {
		stub = getStub(event);
	} catch {
		return { success: false, isComplete: false, error: 'Service unavailable' };
	}

	const cf = event.platform?.cf;
	const cfHeaders = {
		country: (cf?.country as string) || event.request.headers.get('cf-ipcountry') || undefined,
		timezone: (cf?.timezone as string) || event.request.headers.get('cf-timezone') || undefined,
		continent:
			(cf?.continent as string) || event.request.headers.get('cf-ipcontinent') || undefined,
		city: (cf?.city as string) || event.request.headers.get('cf-ipcity') || undefined,
		latitude: (cf?.latitude as string) || event.request.headers.get('cf-iplatitude') || undefined,
		longitude: (cf?.longitude as string) || event.request.headers.get('cf-iplongitude') || undefined
	};

	if (!cfHeaders.country) {
		console.warn(
			'[onboarding.init] No geo data: neither platform.cf nor cf-ipcountry header available'
		);
	}

	try {
		const response = await stub.fetch('http://do/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId: user!.id,
				cfHeaders,
				...(assignment && {
					profileId: assignment.profileId,
					assignmentId: assignment.assignmentId
				})
			})
		});

		if (!response.ok) {
			console.error('[onboarding.init] DO error:', response.status);
			return { success: false, isComplete: false, error: 'Failed to initialize' };
		}

		const data = (await response.json()) as OnboardingDoResponse;
		return {
			success: true,
			isComplete: false,
			disclosures: data.disclosures,
			disclosuresPending: data.disclosuresPending,
			rejectMessage: data.rejectMessage
		};
	} catch (e) {
		console.error('[onboarding.init] DO fetch failed:', e);
		return { success: false, isComplete: false, error: 'Connection failed' };
	}
}

/**
 * Fetch the current question state from the DO.
 */
export async function getCurrentQuestion(event: RequestEvent): Promise<QuestionData | null> {
	if (event.locals.user?.onboardingComplete) return null;

	let stub;
	try {
		stub = getStub(event);
	} catch {
		return null;
	}

	const response = await stub.fetch('http://do/state', {
		method: 'GET',
		headers: { 'Content-Type': 'application/json' }
	});

	if (!response.ok) {
		if (response.status === 400) return null;
		console.error('[onboarding.state] DO error:', response.status);
		return null;
	}

	const data = (await response.json()) as OnboardingDoResponse;
	if (data.disclosuresPending && !data.question) return null;
	return data as QuestionData;
}

/**
 * Submit an answer (or skip) to the current question.
 */
export async function submitAnswer(
	event: RequestEvent,
	action: 'answer' | 'skip',
	answer?: OnboardingAnswerValue
): Promise<AnswerResult> {
	const user = event.locals.user;
	if (!user) return { success: false, completed: false, error: 'Not authenticated' };

	let stub;
	try {
		stub = getStub(event);
	} catch {
		return { success: false, completed: false, error: 'Service unavailable' };
	}

	const endpoint = action === 'skip' ? '/skip' : '/answer';
	const body = action === 'answer' ? { userId: user.id, answer } : { userId: user.id };

	let response;
	try {
		response = await stub.fetch(`http://do${endpoint}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
	} catch (e) {
		console.error('[onboarding.answer] DO fetch failed:', e);
		return { success: false, completed: false, error: 'Failed to connect to service' };
	}

	const responseText = await response.text();
	let data: OnboardingDoResponse | null = null;

	if (responseText) {
		try {
			data = JSON.parse(responseText) as OnboardingDoResponse;
		} catch (e) {
			console.error('[onboarding.answer] Failed to parse DO response:', e);
			return {
				success: false,
				completed: false,
				error: 'Invalid response from onboarding service'
			};
		}
	}

	if (!response.ok) {
		console.error('[onboarding.answer] DO error:', response.status, data?.error ?? responseText);
		return {
			success: false,
			completed: false,
			error: data?.error ?? 'Failed to submit answer'
		};
	}

	if (data?.completed) return { success: true, completed: true, redirectTo: '/' };

	if (
		data?.question &&
		data.questionNumber &&
		data.phase &&
		data.presetCount &&
		data.maxAiQuestions
	) {
		return {
			success: true,
			completed: false,
			questionData: data as QuestionData
		};
	}

	return { success: true, completed: false };
}

/**
 * Submit disclosure responses and proceed to onboarding questions when all required items are accepted.
 */
export async function respondDisclosures(
	event: RequestEvent,
	responses: Record<string, boolean>
): Promise<DisclosureSubmissionResult> {
	const user = event.locals.user;
	if (!user) return { success: false, error: 'Not authenticated' };

	let stub;
	try {
		stub = getStub(event);
	} catch {
		return { success: false, error: 'Service unavailable' };
	}

	let response;
	try {
		response = await stub.fetch('http://do/disclosure/respond', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: user.id, responses })
		});
	} catch (e) {
		console.error('[onboarding.disclosures] DO fetch failed:', e);
		return { success: false, error: 'Failed to connect to service' };
	}

	let data: OnboardingDoResponse | null = null;
	try {
		data = (await response.json()) as OnboardingDoResponse;
	} catch (e) {
		console.error('[onboarding.disclosures] Failed to parse DO response:', e);
		return { success: false, error: 'Invalid response from onboarding service' };
	}

	if (!response.ok || data?.success === false) {
		return {
			success: false,
			disclosures: data?.disclosures,
			disclosuresPending: data?.disclosuresPending,
			rejectMessage: data?.rejectMessage,
			error: data?.error ?? 'Failed to submit disclosures'
		};
	}

	if (data?.completed) {
		return { success: true, completed: true, redirectTo: '/' };
	}

	if (
		data?.question &&
		data.questionNumber &&
		data.phase &&
		data.presetCount &&
		data.maxAiQuestions
	) {
		return {
			success: true,
			questionData: data as QuestionData
		};
	}

	return {
		success: true,
		disclosures: data?.disclosures,
		disclosuresPending: data?.disclosuresPending,
		rejectMessage: data?.rejectMessage
	};
}
