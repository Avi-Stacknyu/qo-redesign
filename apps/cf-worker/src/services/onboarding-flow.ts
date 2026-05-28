import type {
	OnboardingAnswerValue,
	Question,
	QuestionType,
	ShowWhenCondition,
	ShowWhenRule,
	NormalizedQuestionType
} from '../types/onboarding';

export interface FlowAnswerState {
	answersByQuestionId: Record<string, OnboardingAnswerValue>;
	answersByFactKey: Record<string, OnboardingAnswerValue>;
	skippedQuestionIds?: string[];
}

export function normalizeQuestionType(type: string | null | undefined): NormalizedQuestionType {
	if (type === 'checkbox') return 'single_select';
	if (type === 'multiselect') return 'multi_select';
	if (
		type === 'single_select' ||
		type === 'multi_select' ||
		type === 'boolean' ||
		type === 'number'
	) {
		return type;
	}
	return 'text';
}

function getConditionAnswer(
	condition: ShowWhenCondition,
	state: FlowAnswerState
): OnboardingAnswerValue | undefined {
	if (condition.questionId && condition.questionId in state.answersByQuestionId) {
		return state.answersByQuestionId[condition.questionId];
	}
	if (condition.factKey && condition.factKey in state.answersByFactKey) {
		return state.answersByFactKey[condition.factKey];
	}
	return undefined;
}

function compareValues(
	left: OnboardingAnswerValue,
	right: OnboardingAnswerValue | undefined
): boolean {
	if (Array.isArray(left) || Array.isArray(right))
		return JSON.stringify(left) === JSON.stringify(right);
	return left === right;
}

export function evaluateShowWhenCondition(
	condition: ShowWhenCondition,
	state: FlowAnswerState
): boolean {
	const answer = getConditionAnswer(condition, state);

	if (condition.operator === 'exists') return answer !== undefined;
	if (condition.operator === 'not_exists') return answer === undefined;
	if (answer === undefined) return false;

	if (condition.operator === 'equals') return compareValues(answer, condition.value);
	if (condition.operator === 'not_equals') return !compareValues(answer, condition.value);
	if (condition.operator === 'includes') {
		return Array.isArray(answer) && typeof condition.value !== 'undefined'
			? answer.includes(String(condition.value))
			: false;
	}
	if (condition.operator === 'includes_any') {
		if (!Array.isArray(answer)) return false;
		const values = Array.isArray(condition.value) ? condition.value : [condition.value];
		return values
			.filter((value) => value !== undefined)
			.some((value) => answer.includes(String(value)));
	}

	return false;
}

export function evaluateShowWhen(
	rule: ShowWhenRule | null | undefined,
	state: FlowAnswerState
): boolean {
	if (!rule) return true;
	const all = rule.all ?? [];
	const any = rule.any ?? [];
	const allMatches =
		all.length === 0 || all.every((condition) => evaluateShowWhenCondition(condition, state));
	const anyMatches =
		any.length === 0 || any.some((condition) => evaluateShowWhenCondition(condition, state));
	return allMatches && anyMatches;
}

export function buildFlowAnswerState(
	profilerData: Array<{ question_id: string; factKey: string; answer: OnboardingAnswerValue }>,
	skippedQuestionIds: string[] = []
): FlowAnswerState {
	const answersByQuestionId: Record<string, OnboardingAnswerValue> = {};
	const answersByFactKey: Record<string, OnboardingAnswerValue> = {};
	for (const entry of profilerData) {
		answersByQuestionId[entry.question_id] = entry.answer;
		answersByFactKey[entry.factKey] = entry.answer;
	}
	return { answersByQuestionId, answersByFactKey, skippedQuestionIds };
}

export function filterVisibleQuestions(questions: Question[], state: FlowAnswerState): Question[] {
	return questions
		.filter((question) => question.enabled !== false)
		.filter((question) => evaluateShowWhen(question.showWhen, state))
		.sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0));
}

export function findNextVisibleQuestion(
	questions: Question[],
	state: FlowAnswerState
): Question | null {
	const answered = new Set([
		...Object.keys(state.answersByQuestionId),
		...(state.skippedQuestionIds ?? [])
	]);
	return (
		filterVisibleQuestions(questions, state).find((question) => !answered.has(question.id)) ?? null
	);
}

export function isChoiceQuestion(type: QuestionType): boolean {
	const normalized = normalizeQuestionType(type);
	return normalized === 'single_select' || normalized === 'multi_select';
}

// ============================================================================
// Phase Determination (new simplified flow)
// ============================================================================

export interface PhaseInput {
	currentPhase: 'preset' | 'ai' | 'complete';
	hasMorePresetQuestions: boolean;
	maxAiQuestions: number;
	aiQuestionsAsked: number;
}

/**
 * Determines the next phase in the simplified onboarding flow.
 * Flow: preset → ai → complete (no AI opt-in gate)
 */
export function determineNextPhase(input: PhaseInput): 'preset' | 'ai' | 'complete' {
	if (input.currentPhase === 'complete') return 'complete';

	if (input.currentPhase === 'preset') {
		if (input.hasMorePresetQuestions) return 'preset';
		return input.maxAiQuestions > 0 ? 'ai' : 'complete';
	}

	if (input.currentPhase === 'ai') {
		return input.aiQuestionsAsked >= input.maxAiQuestions ? 'complete' : 'ai';
	}

	return 'complete';
}
