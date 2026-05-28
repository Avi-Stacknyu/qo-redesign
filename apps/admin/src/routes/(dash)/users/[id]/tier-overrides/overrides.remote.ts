import { command, query, getRequestEvent } from '$app/server';
import { userTierOverrides, aiAgentModels, aiTools } from '@repo/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

function getUserIdFromParams() {
	const { params } = getRequestEvent();
	const userId = params.id;
	if (!userId) throw error(400, 'Missing user id');
	return userId;
}

export const getOverrides = query(async () => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();

	return await locals.db
		.select()
		.from(userTierOverrides)
		.where(eq(userTierOverrides.user, userId))
		.orderBy(desc(userTierOverrides.created));
});

export const getModelOptions = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db
		.select()
		.from(aiAgentModels)
		.where(and(eq(aiAgentModels.isActive, true), sql`(config_key = '' OR config_key IS NULL)`))
		.orderBy(aiAgentModels.displayName);
});

export const getToolOptions = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db
		.select()
		.from(aiTools)
		.where(eq(aiTools.isActive, true))
		.orderBy(aiTools.displayName);
});

export const createOverride = command(
	z.object({
		userId: z.string().min(1),
		override_type: z.enum(['model', 'tool', 'feature']),
		target_id: z.string().min(1),
		reason: z.string().optional(),
		expires_at: z.string().optional()
	}),
	async (data) => {
		const { locals } = getRequestEvent();
		if (!locals.user) throw error(401, 'Unauthorized');

		const now = new Date().toISOString();
		const id = generateId();
		await locals.db.insert(userTierOverrides).values({
			id,
			user: data.userId,
			overrideType: data.override_type,
			targetId: data.target_id,
			grantedBy: locals.user.id,
			reason: data.reason || '',
			expiresAt: data.expires_at || null,
			isActive: true,
			created: now,
			updated: now
		});

		const [record] = await locals.db
			.select()
			.from(userTierOverrides)
			.where(eq(userTierOverrides.id, id));
		return record;
	}
);

export const toggleOverride = command(
	z.object({ overrideId: z.string().min(1), is_active: z.boolean() }),
	async ({ overrideId, is_active }) => {
		const { locals } = getRequestEvent();
		const now = new Date().toISOString();
		await locals.db
			.update(userTierOverrides)
			.set({ isActive: is_active, updated: now })
			.where(eq(userTierOverrides.id, overrideId));

		const [record] = await locals.db
			.select()
			.from(userTierOverrides)
			.where(eq(userTierOverrides.id, overrideId));
		return record;
	}
);

export const deleteOverride = command(
	z.object({ overrideId: z.string().min(1) }),
	async ({ overrideId }) => {
		const { locals } = getRequestEvent();
		await locals.db.delete(userTierOverrides).where(eq(userTierOverrides.id, overrideId));
	}
);
