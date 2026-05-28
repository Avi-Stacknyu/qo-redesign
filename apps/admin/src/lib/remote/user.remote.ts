import { command, getRequestEvent, query } from '$app/server';
import {
	users,
	userUploads,
	userDataSources,
	userCustomization,
	userCreditBalance,
	userOnboardingAssignments
} from '@repo/db/schema';
import { MemoryGraphService } from '@repo/db/graph';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { z } from 'zod/v4';

async function clearOnboardingSession(platform: App.Platform | undefined, userId: string) {
	const namespace = platform?.env?.ONBOARDING_SESSION;
	if (!namespace) return;
	const id = namespace.idFromName(userId);
	const stub = namespace.get(id);
	await stub.fetch('http://do/reset', { method: 'POST' });
}

export const deleteUser = command(z.object({ userId: z.string() }), async ({ userId }) => {
	const { locals, platform } = getRequestEvent();
	const db = locals.db;

	// 1. Delete all user files via FILE_SERVICE (cleans R2, Vectorize, graph chunks, DB records)
	if (platform?.env?.FILE_SERVICE) {
		const uploads = await db
			.select({ id: userUploads.id })
			.from(userUploads)
			.where(eq(userUploads.user, userId));
		for (const upload of uploads) {
			try {
				await platform.env.FILE_SERVICE.deleteFile({ fileId: upload.id, userId });
			} catch {
				// File may already be partially deleted — continue with remaining files
			}
		}
	}

	// 2. Clear memory graph data (nodes, edges, remaining chunks, cached suggestions/summaries)
	const graph = new MemoryGraphService(db, userId);
	await graph.clearAllData();

	// 3. Delete non-cascade required-relation records that would block user deletion
	await db.delete(userDataSources).where(eq(userDataSources.user, userId));

	// 4. Delete the user record
	// DB cascade handles: chats (-> chat_messages, chat_messages_debug), chat_file_references,
	// user_bookmarks, user_customization, user_dashboard_layouts, user_notes, user_profiles,
	// user_reminders, user_todos, user_widget_instances, user_family_office_members,
	// ai_composio_connections, user_chat_suggestions, user_tier_overrides, user_profile_summaries
	// Preserved (no cascade, nullable): core_credit_ledger, core_token_ledger, plan_payment_transactions
	await db.delete(users).where(eq(users.id, userId));

	return { success: true };
});

export const resetUserOnboarding = command(z.object({ userId: z.string() }), async ({ userId }) => {
	const { locals, platform } = getRequestEvent();
	const db = locals.db;

	// Delete onboarding-related user_customization records (tags, agent_shelf)
	await db
		.delete(userCustomization)
		.where(
			and(
				eq(userCustomization.user, userId),
				inArray(userCustomization.key, ['tags', 'agent_shelf'])
			)
		);

	// Reset onboarding flag
	await db.update(users).set({ onboardingComplete: false }).where(eq(users.id, userId));
	await db.delete(userOnboardingAssignments).where(eq(userOnboardingAssignments.user, userId));
	await clearOnboardingSession(platform, userId);

	return { success: true };
});

export const resetUserOnboardingAndMemory = command(
	z.object({ userId: z.string() }),
	async ({ userId }) => {
		const { locals, platform } = getRequestEvent();
		const db = locals.db;

		// 1. Delete onboarding-related user_customization records (tags, agent_shelf)
		await db
			.delete(userCustomization)
			.where(
				and(
					eq(userCustomization.user, userId),
					inArray(userCustomization.key, ['tags', 'agent_shelf'])
				)
			);

		// 2. Reset onboarding flag
		await db.update(users).set({ onboardingComplete: false }).where(eq(users.id, userId));
		await db.delete(userOnboardingAssignments).where(eq(userOnboardingAssignments.user, userId));
		await clearOnboardingSession(platform, userId);

		// 3. Clear all memory graph data (nodes, edges, chunks, cached suggestions/summaries)
		const graph = new MemoryGraphService(db, userId);
		await graph.clearAllData();

		return { success: true };
	}
);

export const getUserStats = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const [{ count: totalUsers }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(users);

	const [{ count: activeUsers }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(users)
		.where(eq(users.accountStatus, 'active'));

	const balances = await db
		.select({ lifetimePurchased: userCreditBalance.lifetimePurchased })
		.from(userCreditBalance);
	const totalCreditsAssigned = balances.reduce(
		(acc, curr) => acc + Number(curr.lifetimePurchased || 0),
		0
	);

	return {
		totalUsers,
		activeUsers,
		totalCreditsAssigned
	};
});
