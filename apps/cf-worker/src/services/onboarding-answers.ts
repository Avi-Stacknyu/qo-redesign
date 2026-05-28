import { ValidationError } from '../utils/errors';
import type { OnboardingAnswerRecord, OnboardingAnswerValue, Question } from '../types/onboarding';
import { normalizeQuestionType } from './onboarding-flow';

function optionLabel(question: Question, value: string): string {
	return question.options?.find((option) => option.value === value)?.label ?? value;
}

export function normalizeOnboardingAnswer(
	question: Question,
	answer: unknown,
	now = new Date().toISOString()
): OnboardingAnswerRecord {
	const type = normalizeQuestionType(question.type);

	if (
		answer === undefined ||
		answer === null ||
		(typeof answer === 'string' && answer.trim() === '')
	) {
		if (question.required) {
			throw new ValidationError(`Answer is required for: ${question.question}`, {
				field: question.factKey
			});
		}
		return {
			questionId: question.id,
			factKey: question.factKey,
			type,
			value: '',
			displayValue: '',
			answeredAt: now
		};
	}

	let value: OnboardingAnswerValue;
	let displayValue: string;

	if (type === 'single_select') {
		if (
			typeof answer !== 'string' ||
			!question.options?.some((option) => option.value === answer)
		) {
			throw new ValidationError(`Invalid option for question: ${question.question}`);
		}
		value = answer;
		displayValue = optionLabel(question, answer);
	} else if (type === 'multi_select') {
		if (
			!Array.isArray(answer) ||
			!answer.every(
				(value) =>
					typeof value === 'string' && question.options?.some((option) => option.value === value)
			)
		) {
			throw new ValidationError(`Invalid options for question: ${question.question}`);
		}
		value = answer;
		displayValue = answer.map((entry) => optionLabel(question, entry)).join(', ');
	} else if (type === 'number') {
		const parsed = Number(answer);
		if (!Number.isFinite(parsed)) {
			throw new ValidationError(`'${String(answer)}' is not a valid number.`);
		}
		value = parsed;
		displayValue = String(parsed);
	} else if (type === 'boolean') {
		if (typeof answer === 'boolean') {
			value = answer;
		} else if (answer === 'true' || answer === 'yes' || answer === 'on') {
			value = true;
		} else if (answer === 'false' || answer === 'no' || answer === 'off') {
			value = false;
		} else {
			throw new ValidationError(`Invalid boolean answer for question: ${question.question}`);
		}
		displayValue = value ? 'Yes' : 'No';
	} else {
		value = String(answer).trim();
		displayValue = value;
	}

	return {
		questionId: question.id,
		factKey: question.factKey,
		type,
		value,
		displayValue,
		answeredAt: now
	};
}
