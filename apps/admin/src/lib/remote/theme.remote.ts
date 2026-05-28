import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { userCustomization } from '@repo/db/schema';
import { generateId } from '@repo/db/id';
import { eq, and } from 'drizzle-orm';
import z from 'zod/v4';
import type { ThemeMode } from '$lib/components/theme-handler/types';

type ThemePreferenceValue = {
	preset: string;
	currentMode: ThemeMode;
};

const themeSchema = z.object({
	preset: z.string().min(1).max(120),
	currentMode: z.enum(['light', 'dark']),
	recordId: z.string().optional()
});

export const saveTheme = command(themeSchema, async (data) => {
	const { locals } = getRequestEvent();
	const { db, user } = locals;

	if (!db || !user) {
		throw error(401, 'Unauthorized');
	}

	const selection: ThemePreferenceValue = {
		preset: data.preset,
		currentMode: data.currentMode
	};

	const now = new Date().toISOString();

	if (data.recordId) {
		const [record] = await db
			.update(userCustomization)
			.set({ value: selection, updated: now })
			.where(eq(userCustomization.id, data.recordId))
			.returning({ id: userCustomization.id, value: userCustomization.value });
		return { recordId: record.id, value: record.value };
	}

	// Try to find existing theme record for this user
	const [existing] = await db
		.select({ id: userCustomization.id })
		.from(userCustomization)
		.where(and(eq(userCustomization.user, user.id), eq(userCustomization.key, 'theme')))
		.limit(1);

	if (existing) {
		const [record] = await db
			.update(userCustomization)
			.set({ value: selection, updated: now })
			.where(eq(userCustomization.id, existing.id))
			.returning({ id: userCustomization.id, value: userCustomization.value });
		return { recordId: record.id, value: record.value };
	}

	const [record] = await db
		.insert(userCustomization)
		.values({
			id: generateId(),
			user: user.id,
			key: 'theme',
			value: selection,
			created: now,
			updated: now
		})
		.returning({ id: userCustomization.id, value: userCustomization.value });
	return { recordId: record.id, value: record.value };
});
