/** Profile types for the structured profiler system. */

export interface ProfileField {
	key: string;
	value: string;
	label: string;
	confidence: number;
	source: 'onboarding' | 'chat' | 'user_edit';
	isSchema: boolean;
	updatedAt: string;
}

export interface ProfileSection {
	sectionId: string;
	label: string;
	icon: string;
	order: number;
	fields: ProfileField[];
	schemaFieldCount: number;
	filledSchemaCount: number;
	completionPct: number;
}

export interface ProfileData {
	sections: ProfileSection[];
	overallCompletion: number;
	totalFields: number;
	filledFields: number;
	lastUpdated: string | null;
}
