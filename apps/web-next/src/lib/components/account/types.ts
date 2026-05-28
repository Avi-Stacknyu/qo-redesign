export type SelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

export type PersonalitySelectField = {
	key: 'tone' | 'response_length' | 'formality' | 'explanation_style';
	label: string;
	options: readonly SelectOption[];
};