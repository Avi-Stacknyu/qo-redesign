import { z } from 'zod';

// ── Question types ───────────────────────────────────────────────────────────

export type QuestionType =
	| 'checkbox'
	| 'multiselect'
	| 'single_select'
	| 'multi_select'
	| 'text'
	| 'number'
	| 'boolean';
export type QuestionPhase = 'preset' | 'ai-prompt' | 'ai-personalized';
export type OnboardingAnswerValue = string | number | boolean | string[];

export const optionSchema = z.object({
	value: z.string(),
	label: z.string(),
	icon: z.string().optional(),
	description: z.string().optional(),
	grantsTags: z.array(z.string()).optional()
});

export type QuestionOption = z.infer<typeof optionSchema>;

export const questionSchema = z.object({
	id: z.string(),
	factKey: z.string(),
	factLabel: z.string().optional(),
	type: z.enum([
		'checkbox',
		'multiselect',
		'single_select',
		'multi_select',
		'text',
		'number',
		'boolean'
	]),
	question: z.string(),
	description: z.string().optional(),
	options: z.array(optionSchema).optional(),
	placeholder: z.string().optional(),
	required: z.boolean().default(true),
	min: z.number().optional(),
	max: z.number().optional()
});

export type Question = z.infer<typeof questionSchema>;

// ── DO response shapes ───────────────────────────────────────────────────────

export interface AnsweredFact {
	label: string;
	value: string;
}

export interface QuestionData {
	success: boolean;
	question: Question;
	questionNumber: number;
	phase: QuestionPhase;
	presetCount: number;
	maxAiQuestions: number;
	answeredFacts?: AnsweredFact[];
}

export type DisclosureItemType = 'acknowledgement' | 'accept_deny';

export interface DisclosureItem {
	id: string;
	question: string;
	title?: string;
	body?: string;
	type: DisclosureItemType;
	required: boolean;
	acceptLabel?: string;
	rejectLabel?: string;
	rejectMessage?: string;
}

export interface DisclosureConfig {
	enabled: boolean;
	items: DisclosureItem[];
}

export interface DisclosureResult {
	success: boolean;
	disclosures?: DisclosureConfig;
	disclosuresPending?: boolean;
	rejectMessage?: string;
	error?: string;
}

export interface AnswerResult {
	success: boolean;
	completed: boolean;
	questionData?: QuestionData;
	redirectTo?: string;
	error?: string;
}

// ── Form schemas ─────────────────────────────────────────────────────────────

export const answerSchema = z
	.object({
		action: z.enum(['answer', 'skip']),
		answer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional()
	})
	.refine(
		(data) => {
			if (data.action === 'answer' && (data.answer === undefined || data.answer === null)) {
				return false;
			}
			return true;
		},
		{ message: 'Please select an option', path: ['answer'] }
	);
