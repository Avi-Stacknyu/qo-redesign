import { describe, expect, it } from 'vitest';

import type { ProfileData } from '$lib/data/profile-types';
import { buildProfileRefreshKey } from '$lib/data/profile-refresh';

const baseProfile: ProfileData = {
	sections: [
		{
			sectionId: 'identity',
			label: 'Identity',
			icon: 'user',
			order: 1,
			fields: [],
			schemaFieldCount: 0,
			filledSchemaCount: 0,
			completionPct: 0
		}
	],
	overallCompletion: 20,
	totalFields: 5,
	filledFields: 1,
	lastUpdated: '2026-04-16T10:00:00.000Z'
};

describe('buildProfileRefreshKey', () => {
	it('stays stable for identical profile freshness inputs', () => {
		expect(buildProfileRefreshKey(baseProfile)).toBe(buildProfileRefreshKey(baseProfile));
	});

	it('changes when the profile freshness changes', () => {
		const nextProfile: ProfileData = {
			...baseProfile,
			filledFields: 2,
			lastUpdated: '2026-04-16T10:05:00.000Z'
		};

		expect(buildProfileRefreshKey(nextProfile)).not.toBe(buildProfileRefreshKey(baseProfile));
	});
});
