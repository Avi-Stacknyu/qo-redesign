import { redirect, fail, type RequestEvent } from '@sveltejs/kit';
import { eq, and, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import {
	readCampaignHintCookie,
	clearCampaignHintCookie
} from '$lib/server/onboarding-source-cookie';
import {
	configOnboardingProfiles,
	configOnboardingCampaigns,
	configOnboardingInviteCodes,
	userOnboardingAssignments
} from '@repo/db/schema';
import { generateId } from '@repo/db/id';

async function applyInviteCodeToUser(event: RequestEvent, rawCode: string) {
	const user = event.locals.user!;
	const db = event.locals.db;
	const code = rawCode.trim();
	const codeCandidates = Array.from(new Set([code, code.toUpperCase()]));

	if (!code) return { success: false, error: 'Please enter an invite code' };

	const [invite] = await db
		.select()
		.from(configOnboardingInviteCodes)
		.where(
			and(
				inArray(configOnboardingInviteCodes.code, codeCandidates),
				eq(configOnboardingInviteCodes.isActive, true)
			)
		)
		.limit(1);

	if (!invite) return { success: false, error: 'Invalid or expired invite code' };

	if (invite.maxUses && (invite.usedCount ?? 0) >= invite.maxUses) {
		return { success: false, error: 'This invite code has reached its usage limit' };
	}

	if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
		return { success: false, error: 'This invite code has expired' };
	}

	const [campaign] = await db
		.select()
		.from(configOnboardingCampaigns)
		.where(eq(configOnboardingCampaigns.id, invite.campaign))
		.limit(1);

	if (!campaign) return { success: false, error: 'Invalid invite code configuration' };

	const profileId = invite.profileOverride ?? campaign.defaultProfile;
	const [existing] = await db
		.select()
		.from(userOnboardingAssignments)
		.where(eq(userOnboardingAssignments.user, user.id))
		.limit(1);

	if (existing) {
		await db
			.update(userOnboardingAssignments)
			.set({
				profile: profileId,
				campaign: campaign.id,
				inviteCode: invite.id,
				resolutionSource: 'invite_code',
				sourceValue: invite.code,
				lockedAt: new Date().toISOString()
			})
			.where(eq(userOnboardingAssignments.id, existing.id));
	} else {
		await db.insert(userOnboardingAssignments).values({
			id: generateId(),
			user: user.id,
			profile: profileId,
			campaign: campaign.id,
			inviteCode: invite.id,
			resolutionSource: 'invite_code',
			sourceValue: invite.code,
			lockedAt: new Date().toISOString()
		});
	}

	await db
		.update(configOnboardingInviteCodes)
		.set({ usedCount: (invite.usedCount ?? 0) + 1 })
		.where(eq(configOnboardingInviteCodes.id, invite.id));

	return { success: true };
}

async function loadActiveProfiles(event: RequestEvent) {
	return await event.locals.db
		.select({
			id: configOnboardingProfiles.id,
			key: configOnboardingProfiles.key,
			name: configOnboardingProfiles.name,
			description: configOnboardingProfiles.description
		})
		.from(configOnboardingProfiles)
		.where(
			and(
				eq(configOnboardingProfiles.isActive, true),
				eq(configOnboardingProfiles.visibility, 'public')
			)
		);
}

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user!;
	const db = event.locals.db;
	const disclosureRejected = event.url.searchParams.get('disclosure') === 'rejected';
	const rejectedMessage = event.url.searchParams.get('message')?.trim();

	// Check for existing locked assignment → go straight to runner
	const existing = await db
		.select()
		.from(userOnboardingAssignments)
		.where(eq(userOnboardingAssignments.user, user.id))
		.limit(1);

	if (existing.length > 0 && existing[0].lockedAt) {
		if (disclosureRejected) {
			const [profile] = await db
				.select({
					id: configOnboardingProfiles.id,
					name: configOnboardingProfiles.name,
					description: configOnboardingProfiles.description
				})
				.from(configOnboardingProfiles)
				.where(eq(configOnboardingProfiles.id, existing[0].profile))
				.limit(1);

			return {
				profiles: [],
				resumeOnboarding: {
					profileId: existing[0].profile,
					profileName: profile?.name ?? 'Current onboarding',
					profileDescription: profile?.description ?? null,
					rejectMessage:
						rejectedMessage ||
						'You can leave onboarding for now and return when you are ready to accept the required disclosures.'
				}
			};
		}

		redirect(303, '/onboarding/run');
	}

	// Try auto-resolution via campaign cookie
	const hint = readCampaignHintCookie(event);
	if (hint?.inviteCode) {
		clearCampaignHintCookie(event);
		const result = await applyInviteCodeToUser(event, hint.inviteCode);
		if (result.success) redirect(303, '/onboarding/run');

		const profiles = await loadActiveProfiles(event);
		return { profiles, error: result.error, inviteCode: hint.inviteCode };
	}

	if (hint?.campaignSlug) {
		const [campaign] = await db
			.select()
			.from(configOnboardingCampaigns)
			.where(
				and(
					eq(configOnboardingCampaigns.slug, hint.campaignSlug),
					eq(configOnboardingCampaigns.isActive, true)
				)
			)
			.limit(1);

		if (campaign) {
			clearCampaignHintCookie(event);

			// Create or update assignment and lock it
			if (existing.length > 0) {
				await db
					.update(userOnboardingAssignments)
					.set({
						profile: campaign.defaultProfile,
						campaign: campaign.id,
						resolutionSource: 'url',
						sourceValue: hint.campaignSlug,
						lockedAt: new Date().toISOString()
					})
					.where(eq(userOnboardingAssignments.id, existing[0].id));
			} else {
				await db.insert(userOnboardingAssignments).values({
					id: generateId(),
					user: user.id,
					profile: campaign.defaultProfile,
					campaign: campaign.id,
					resolutionSource: 'url',
					sourceValue: hint.campaignSlug,
					lockedAt: new Date().toISOString()
				});
			}

			redirect(303, '/onboarding/run');
		}
	}

	// Load available profiles for the chooser
	const profiles = await loadActiveProfiles(event);

	return { profiles, resumeOnboarding: null };
};

export const actions: Actions = {
	applyInviteCode: async (event) => {
		const formData = await event.request.formData();
		const code = formData.get('code')?.toString()?.trim();

		if (!code) return fail(400, { error: 'Please enter an invite code' });
		const result = await applyInviteCodeToUser(event, code);
		if (!result.success) return fail(400, { error: result.error });

		redirect(303, '/onboarding/run');
	},

	chooseProfile: async (event) => {
		const user = event.locals.user!;
		const db = event.locals.db;
		const formData = await event.request.formData();
		const profileId = formData.get('profileId')?.toString()?.trim();

		if (!profileId) return fail(400, { error: 'Please select a profile' });

		// Verify profile exists and is active
		const [profile] = await db
			.select()
			.from(configOnboardingProfiles)
			.where(
				and(
					eq(configOnboardingProfiles.id, profileId),
					eq(configOnboardingProfiles.isActive, true),
					eq(configOnboardingProfiles.visibility, 'public')
				)
			)
			.limit(1);

		if (!profile) return fail(400, { error: 'Invalid profile selection' });

		// Create or update assignment
		const [existing] = await db
			.select()
			.from(userOnboardingAssignments)
			.where(eq(userOnboardingAssignments.user, user.id))
			.limit(1);

		if (existing) {
			await db
				.update(userOnboardingAssignments)
				.set({
					profile: profileId,
					campaign: null,
					resolutionSource: 'manual',
					sourceValue: profile.key,
					lockedAt: new Date().toISOString()
				})
				.where(eq(userOnboardingAssignments.id, existing.id));
		} else {
			await db.insert(userOnboardingAssignments).values({
				id: generateId(),
				user: user.id,
				profile: profileId,
				resolutionSource: 'manual',
				sourceValue: profile.key,
				lockedAt: new Date().toISOString()
			});
		}

		redirect(303, '/onboarding/run');
	}
} satisfies Actions;
