export type SelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

export type PersonalitySettingKey =
	| 'tone'
	| 'responseLength'
	| 'formality'
	| 'explanationType';

export type PersonalitySelectField = {
	key: PersonalitySettingKey;
	label: string;
	options: readonly SelectOption[];
};