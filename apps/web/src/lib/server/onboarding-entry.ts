export interface EntryResolution {
	campaignId: string | null;
	profileId: string;
	source: 'url' | 'invite_code' | 'manual';
}

export interface EntryInputs {
	urlCampaign: { campaignId: string; profileId: string } | null;
	inviteResolution: { campaignId: string; profileId: string } | null;
	manualProfileId: string | null;
}

export function decideEntryOutcome(input: EntryInputs):
	| {
			mode: 'resolved';
			campaignId: string | null;
			profileId: string;
			source: EntryResolution['source'];
	  }
	| { mode: 'chooser' } {
	if (input.urlCampaign) {
		return {
			mode: 'resolved',
			campaignId: input.urlCampaign.campaignId,
			profileId: input.urlCampaign.profileId,
			source: 'url'
		};
	}
	if (input.inviteResolution) {
		return {
			mode: 'resolved',
			campaignId: input.inviteResolution.campaignId,
			profileId: input.inviteResolution.profileId,
			source: 'invite_code'
		};
	}
	if (input.manualProfileId) {
		return {
			mode: 'resolved',
			campaignId: null,
			profileId: input.manualProfileId,
			source: 'manual'
		};
	}
	return { mode: 'chooser' };
}

export function lockAssignment<T extends { lockedAt: string | null }>(
	assignment: T
): Omit<T, 'lockedAt'> & { lockedAt: string } {
	return { ...assignment, lockedAt: assignment.lockedAt ?? new Date().toISOString() };
}
