export type ProfilerData = Record<string, unknown>;

export type Question = {
	id: string;
	question?: string;
	type?:
		| 'checkbox'
		| 'multiselect'
		| 'single_select'
		| 'multi_select'
		| 'text'
		| 'number'
		| 'boolean';
	options?: unknown;
	description?: string;
	fact_key?: string;
	sidebar_title?: string;
	enabled?: boolean;
	required?: boolean;
	group?: string;
	showWhen?: ShowWhenRule | null;
	metadata?: Record<string, unknown> | null;
};

export type ShowWhenOperator =
	| 'exists'
	| 'not_exists'
	| 'equals'
	| 'not_equals'
	| 'includes'
	| 'includes_any';

export type ShowWhenCondition = {
	questionId?: string;
	factKey?: string;
	operator: ShowWhenOperator;
	value?: string | number | boolean | string[];
};

export type ShowWhenRule = {
	all?: ShowWhenCondition[];
	any?: ShowWhenCondition[];
};

export type QuestionData = {
	completed?: boolean;
	currentQuestion?: Question;
	progress?: {
		answered?: number;
		total?: number;
	};
	profilerData?: ProfilerData;
};
