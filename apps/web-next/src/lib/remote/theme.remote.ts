/**
 * Theme remote — persists theme preference to Postgres for cross-device sync.
 * Does NOT apply the theme. Theme is applied server-side via cookie + transformPageChunk.
 */

import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { userCustomization } from '@repo/db/schema';
import { and, eq } from 'drizzle-orm';
import z from 'zod/v4';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

const saveThemeSchema = z.object({
	preset: z.string().min(1).max(120),
	mode: z.enum(['light', 'dark'])
});

/** Save theme preference to user_customization for cross-device sync. */
export const saveThemePreference = command(saveThemeSchema, async (data) => {
	const { db, userId } = getDbAndUser();

	const value = { preset: data.preset, mode: data.mode };

	const [existing] = await db
		.select({ id: userCustomization.id })
		.from(userCustomization)
		.where(and(eq(userCustomization.user, userId), eq(userCustomization.key, 'theme')))
		.limit(1);

	if (existing) {
		await db
			.update(userCustomization)
			.set({ value, updated: new Date().toISOString() })
			.where(eq(userCustomization.id, existing.id));
		return { recordId: existing.id };
	}

	const id = generateId();
	const now = new Date().toISOString();
	await db.insert(userCustomization).values({
		id,
		user: userId,
		key: 'theme',
		value,
		created: now,
		updated: now
	});
	return { recordId: id };
});

/** Load saved theme preference (used on login for cross-device restore). */
export const loadThemePreference = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) return null;

	const [record] = await locals.db
		.select({ value: userCustomization.value })
		.from(userCustomization)
		.where(and(eq(userCustomization.user, locals.user.id), eq(userCustomization.key, 'theme')))
		.limit(1);

	if (!record) return null;

	const value = record.value as { preset?: string; mode?: string } | null;
	if (
		value &&
		typeof value.preset === 'string' &&
		(value.mode === 'light' || value.mode === 'dark')
	) {
		return { preset: value.preset, mode: value.mode as 'light' | 'dark' };
	}
	return null;
});
