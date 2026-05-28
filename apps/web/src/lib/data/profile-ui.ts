import type { ProfileData, ProfileSection } from './profile-types';

export const EVENT_SOURCE_CLOSED = 2;

export function shouldIgnoreProfileRequestError(error: unknown): boolean {
	if (error instanceof DOMException && error.name === 'AbortError') return true;

	const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

	return /abort|aborted|cancelled|canceled/i.test(message);
}

export function shouldLogProfilerStreamDisconnect(params: {
	intentionalClose: boolean;
	readyState: number;
}): boolean {
	return !params.intentionalClose && params.readyState !== EVENT_SOURCE_CLOSED;
}

export function applyProfileFieldValue(
	profile: ProfileData,
	update: {
		sectionId: string;
		fieldKey: string;
		value: string;
		updatedAt: string;
	}
): ProfileData {
	let didUpdate = false;

	const sections = profile.sections.map((section) => {
		if (section.sectionId !== update.sectionId) return section;

		let sectionUpdated = false;
		const fields = section.fields.map((field) => {
			if (field.key !== update.fieldKey) return field;
			sectionUpdated = true;
			didUpdate = true;
			return {
				...field,
				value: update.value,
				updatedAt: update.updatedAt,
				source: 'user_edit' as const,
				confidence: 1
			};
		});

		return sectionUpdated ? recomputeSection({ ...section, fields }) : section;
	});

	if (!didUpdate) return profile;

	const totalFields = sections.reduce((count, section) => count + section.fields.length, 0);
	const filledFields = sections.reduce(
		(count, section) => count + section.fields.filter((field) => field.value.trim() !== '').length,
		0
	);

	return {
		...profile,
		sections,
		totalFields,
		filledFields,
		overallCompletion: totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0,
		lastUpdated: update.updatedAt
	};
}

function recomputeSection(section: ProfileSection): ProfileSection {
	const schemaFields = section.fields.filter((field) => field.isSchema);
	const filledSchemaCount = schemaFields.filter((field) => field.value.trim() !== '').length;

	return {
		...section,
		filledSchemaCount,
		completionPct:
			schemaFields.length > 0 ? Math.round((filledSchemaCount / schemaFields.length) * 100) : 100
	};
}
