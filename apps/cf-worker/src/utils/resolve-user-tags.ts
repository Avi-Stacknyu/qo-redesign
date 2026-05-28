/**
 * Resolve User Tags
 *
 * Fetches user plan + stored profile tags in parallel, then computes the
 * effective tag set. Replaces the ~12-line inline pattern that was duplicated
 * across 5+ RPCs in index.ts.
 */

import type { Database } from '@repo/db/types';
import { users, userCustomization, planPackages } from '@repo/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserTags } from './tag-resolver';
import { resolveUserTier } from './tier-resolver';
import type { UserTierContext } from './tier-resolver';

export async function resolveUserTags(userId: string, db: Database): Promise<string[]> {
	const [userResult, userTagsResult] = await Promise.allSettled([
		db.query.users
			.findFirst({
				where: eq(users.id, userId),
				columns: { plan: true }
			})
			.then(async (row) => {
				if (!row?.plan) return { plan: null };
				const planRow = await db.query.planPackages.findFirst({
					where: eq(planPackages.id, row.plan),
					columns: { grantedTags: true }
				});
				return { plan: planRow ?? null };
			}),
		db.query.userCustomization
			.findFirst({
				where: and(eq(userCustomization.user, userId), eq(userCustomization.key, 'tags')),
				columns: { value: true }
			})
			.then((row) => row ?? null)
	]);

	const planData = userResult.status === 'fulfilled' ? (userResult.value?.plan ?? null) : null;
	const customizationData =
		userTagsResult.status === 'fulfilled' ? (userTagsResult.value?.value ?? null) : null;

	return getUserTags(
		planData ? { granted_tags: (planData as any).grantedTags ?? null } : null,
		customizationData as { tags?: string[] } | null
	);
}

export async function resolveUserTagsAndTier(
	userId: string,
	db: Database
): Promise<{
	userTags: string[];
	tierContext: UserTierContext;
}> {
	const [userRow, userTags] = await Promise.all([
		db.query.users.findFirst({
			columns: { plan: true },
			where: eq(users.id, userId)
		}),
		resolveUserTags(userId, db)
	]);

	const tierContext = await resolveUserTier(db, userId, userRow?.plan ?? undefined, userTags);
	return { userTags, tierContext };
}
