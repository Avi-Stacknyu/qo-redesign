import type { ProfileData } from './profile-types';

export function buildProfileRefreshKey(profile: ProfileData): string {
	const sectionShape = profile.sections
		.map((section) => `${section.sectionId}:${section.fields.length}:${section.completionPct}`)
		.join('|');

	return [
		profile.lastUpdated ?? 'never',
		profile.filledFields,
		profile.totalFields,
		profile.sections.length,
		sectionShape
	].join('::');
}