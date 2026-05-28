import { describe, expect, it } from 'vitest';

import type { ProfileData } from './profile-types';
import {
	EVENT_SOURCE_CLOSED,
	applyProfileFieldValue,
	shouldIgnoreProfileRequestError,
	shouldLogProfilerStreamDisconnect
} from './profile-ui';

const baseProfile: ProfileData = {
	sections: [
		{
			sectionId: 'identity',
			label: 'Identity',
			icon: 'user',
			order: 1,
			fields: [
				{
					key: 'name',
					label: 'Name',
					value: '',
					confidence: 0.4,
					source: 'chat',
					isSchema: true,
					updatedAt: ''
				}
			],
			schemaFieldCount: 1,
			filledSchemaCount: 0,
			completionPct: 0
		}
	],
	overallCompletion: 0,
	totalFields: 1,
	filledFields: 0,
	lastUpdated: null
};

describe('shouldIgnoreProfileRequestError', () => {
	it('ignores abort-like errors', () => {
		expect(
			shouldIgnoreProfileRequestError(new DOMException('The operation was aborted.', 'AbortError'))
		).toBe(true);
		expect(
			shouldIgnoreProfileRequestError(new Error('Request was canceled by a newer refresh'))
		).toBe(true);
	});

	it('does not ignore real errors', () => {
		expect(shouldIgnoreProfileRequestError(new Error('Database unavailable'))).toBe(false);
	});
});

describe('shouldLogProfilerStreamDisconnect', () => {
	it('suppresses intentional closes and already-closed streams', () => {
		expect(shouldLogProfilerStreamDisconnect({ intentionalClose: true, readyState: 0 })).toBe(
			false
		);
		expect(
			shouldLogProfilerStreamDisconnect({
				intentionalClose: false,
				readyState: EVENT_SOURCE_CLOSED
			})
		).toBe(false);
	});

	it('logs unexpected disconnects for active streams', () => {
		expect(shouldLogProfilerStreamDisconnect({ intentionalClose: false, readyState: 1 })).toBe(
			true
		);
	});
});

describe('applyProfileFieldValue', () => {
	it('updates the field value and recomputes completion counters', () => {
		const updated = applyProfileFieldValue(baseProfile, {
			sectionId: 'identity',
			fieldKey: 'name',
			value: 'Ada Lovelace',
			updatedAt: '2026-04-17T10:00:00.000Z'
		});

		expect(updated.sections[0]?.fields[0]?.value).toBe('Ada Lovelace');
		expect(updated.sections[0]?.filledSchemaCount).toBe(1);
		expect(updated.sections[0]?.completionPct).toBe(100);
		expect(updated.filledFields).toBe(1);
		expect(updated.overallCompletion).toBe(100);
		expect(updated.lastUpdated).toBe('2026-04-17T10:00:00.000Z');
	});
});
