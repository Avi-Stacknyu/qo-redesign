import { describe, it, expect } from 'vitest';
import { decideEntryOutcome, lockAssignment } from './onboarding-entry';

describe('decideEntryOutcome', () => {
	it('URL campaign wins over invite code when both exist', () => {
		const result = decideEntryOutcome({
			urlCampaign: { campaignId: 'camp-1', profileId: 'prof-url' },
			inviteResolution: { campaignId: 'camp-2', profileId: 'prof-invite' },
			manualProfileId: null
		});
		expect(result).toEqual({
			mode: 'resolved',
			campaignId: 'camp-1',
			profileId: 'prof-url',
			source: 'url'
		});
	});

	it('falls back to chooser when nothing resolves', () => {
		const result = decideEntryOutcome({
			urlCampaign: null,
			inviteResolution: null,
			manualProfileId: null
		});
		expect(result).toEqual({ mode: 'chooser' });
	});

	it('invite code resolves when URL is null', () => {
		const result = decideEntryOutcome({
			urlCampaign: null,
			inviteResolution: { campaignId: 'camp-inv', profileId: 'prof-inv' },
			manualProfileId: null
		});
		expect(result).toEqual({
			mode: 'resolved',
			campaignId: 'camp-inv',
			profileId: 'prof-inv',
			source: 'invite_code'
		});
	});

	it('manual profile resolves when nothing else does', () => {
		const result = decideEntryOutcome({
			urlCampaign: null,
			inviteResolution: null,
			manualProfileId: 'prof-manual'
		});
		expect(result).toEqual({
			mode: 'resolved',
			campaignId: null,
			profileId: 'prof-manual',
			source: 'manual'
		});
	});
});

describe('lockAssignment', () => {
	it('marks assignment with lockedAt timestamp', () => {
		const assignment = { id: 'a1', profile: 'p1', lockedAt: null };
		const locked = lockAssignment(assignment);
		expect(locked.lockedAt).toBeTypeOf('string');
		expect(new Date(locked.lockedAt).getTime()).toBeGreaterThan(0);
	});

	it('preserves existing lockedAt if already set', () => {
		const existing = '2025-01-01T00:00:00.000Z';
		const assignment = { id: 'a1', profile: 'p1', lockedAt: existing };
		const locked = lockAssignment(assignment);
		expect(locked.lockedAt).toBe(existing);
	});
});
