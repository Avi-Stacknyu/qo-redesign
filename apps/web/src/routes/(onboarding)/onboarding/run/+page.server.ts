import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import {
	getCurrentQuestion,
	initializeOnboarding,
	respondDisclosures,
	submitAnswer
} from '$lib/server/onboarding';
import { userOnboardingAssignments } from '@repo/db/schema';
import type { OnboardingAnswerValue, QuestionType } from '$lib/types/onboarding';

function normalizeQuestionType(type: string): QuestionType {
	if (type === 'checkbox') return 'single_select';
	if (type === 'multiselect') return 'multi_select';
	if (
		type === 'single_select' ||
		type === 'multi_select' ||
		type === 'text' ||
		type === 'number' ||
		type === 'boolean'
	) {
		return type;
	}
	return 'text';
}

function parseAnswer(formData: FormData): OnboardingAnswerValue | null {
	const questionType = normalizeQuestionType(formData.get('questionType')?.toString() ?? 'text');

	if (questionType === 'multi_select') {
		const values = formData
			.getAll('answer')
			.map((value) => value.toString())
			.filter(Boolean);
		return values.length > 0 ? values : null;
	}

	const answerRaw = formData.get('answer')?.toString() ?? '';
	if (!answerRaw) return null;

	if (questionType === 'number') {
		const parsed = Number(answerRaw);
		return Number.isFinite(parsed) ? parsed : null;
	}

	if (questionType === 'boolean') {
		return answerRaw === 'true' || answerRaw === 'yes' || answerRaw === 'on';
	}

	return answerRaw;
}

function parseDisclosureResponses(formData: FormData): Record<string, boolean> {
	const ids = formData
		.getAll('disclosureId')
		.map((value) => value.toString())
		.filter(Boolean);

	return Object.fromEntries(
		ids.map((id) => {
			const raw = formData.get(`disclosure:${id}`)?.toString().toLowerCase();
			return [id, raw === 'true' || raw === 'yes' || raw === 'on' || raw === 'accept'];
		})
	);
}

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user!;
	const db = event.locals.db;

	const [assignment] = await db
		.select()
		.from(userOnboardingAssignments)
		.where(eq(userOnboardingAssignments.user, user.id))
		.limit(1);

	if (!assignment || !assignment.lockedAt) {
		redirect(303, '/onboarding');
	}

	const initResult = await initializeOnboarding(event, {
		profileId: assignment.profile,
		assignmentId: assignment.id
	});

	if (initResult.isComplete) {
		redirect(303, '/');
	}

	const disclosuresPending = initResult.disclosuresPending === true;
	const questionData = disclosuresPending ? null : await getCurrentQuestion(event);

	return {
		questionData,
		disclosures: initResult.disclosures,
		disclosuresPending,
		rejectMessage: initResult.rejectMessage,
		initError: initResult.success ? undefined : initResult.error
	};
};

export const actions: Actions = {
	answer: async (event) => {
		const formData = await event.request.formData();
		const answer = parseAnswer(formData);

		if (answer === null) return fail(400, { error: 'Answer required' });

		const result = await submitAnswer(event, 'answer', answer);

		if (result.completed && result.redirectTo) {
			redirect(303, result.redirectTo);
		}

		if (!result.success) {
			return fail(500, { error: result.error ?? 'Failed to submit answer' });
		}

		const questionData = result.questionData ?? (await getCurrentQuestion(event));
		if (!questionData) return fail(500, { error: 'Failed to load next question' });

		return { success: true, questionData };
	},

	skip: async (event) => {
		const result = await submitAnswer(event, 'skip');

		if (result.completed && result.redirectTo) {
			redirect(303, result.redirectTo);
		}

		if (!result.success) {
			return fail(500, { error: result.error ?? 'Failed to skip' });
		}

		const questionData = result.questionData ?? (await getCurrentQuestion(event));
		if (!questionData) return fail(500, { error: 'Failed to load next question' });

		return { success: true, questionData };
	},

	submitDisclosures: async (event) => {
		const formData = await event.request.formData();
		const responses = parseDisclosureResponses(formData);
		const result = await respondDisclosures(event, responses);

		if (result.completed && result.redirectTo) {
			redirect(303, result.redirectTo);
		}

		if (!result.success) {
			if (result.rejectMessage) {
				const searchParams = new URLSearchParams({ disclosure: 'rejected' });
				searchParams.set('message', result.rejectMessage);
				redirect(303, `/onboarding?${searchParams.toString()}`);
			}

			return fail(400, {
				error: result.error ?? 'Failed to submit disclosures',
				disclosures: result.disclosures,
				disclosuresPending: result.disclosuresPending ?? true,
				rejectMessage: result.rejectMessage
			});
		}

		const questionData = result.questionData ?? (await getCurrentQuestion(event));
		if (!questionData) return fail(500, { error: 'Failed to load next question' });

		return { success: true, questionData, disclosuresAccepted: true };
	}
};
