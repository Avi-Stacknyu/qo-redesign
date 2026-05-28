import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { userCustomization } from '@repo/db/schema';
import { and, eq } from 'drizzle-orm';
import z from 'zod/v4';
import { aiPersonalitySchema, type AiPersonality } from '$lib/types/ai';

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

/** Upsert helper for user_customization key-value pairs. */
async function upsertCustomization(
	db: ReturnType<typeof getDbAndUser>['db'],
	userId: string,
	key: string,
	value: unknown
) {
	const [existing] = await db
		.select()
		.from(userCustomization)
		.where(and(eq(userCustomization.user, userId), eq(userCustomization.key, key)))
		.limit(1);

	if (existing) {
		await db
			.update(userCustomization)
			.set({ value, updated: new Date().toISOString() })
			.where(eq(userCustomization.id, existing.id));
		return { recordId: existing.id };
	}

	const now = new Date().toISOString();
	const [record] = await db
		.insert(userCustomization)
		.values({ id: generateId(), user: userId, key, value, created: now, updated: now })
		.returning();
	return { recordId: record.id };
}

/** Load a user_customization record by key, or null if not found. */
async function loadCustomization(
	db: ReturnType<typeof getDbAndUser>['db'],
	userId: string,
	key: string
) {
	const [record] = await db
		.select()
		.from(userCustomization)
		.where(and(eq(userCustomization.user, userId), eq(userCustomization.key, key)))
		.limit(1);
	return record ?? null;
}

/** Save AI Agent preferences to user_customization. */
export const saveAiPersonality = command(aiPersonalitySchema, async (data: AiPersonality) => {
	const { db, userId } = getDbAndUser();
	return upsertCustomization(db, userId, 'ai_agent_personality', data);
});

/** Load AI Agent preferences. */
export const loadAiPersonality = query(async (): Promise<AiPersonality> => {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) return aiPersonalitySchema.parse({});

	const record = await loadCustomization(locals.db, locals.user.id, 'ai_agent_personality');
	return aiPersonalitySchema.parse(record?.value || {});
});

// ── Home Location ────────────────────────────────────────────────────────────

export interface HomeLocation {
	country: string;
	timezone: string;
	city: string;
}

const homeLocationDefaults: HomeLocation = { country: '', timezone: '', city: '' };

const homeLocationSchema = z.object({
	country: z.string().max(3).default(''),
	timezone: z.string().max(60).default(''),
	city: z.string().max(100).default('')
});

/** Load home location from user_customization. */
export const loadHomeLocation = query(async (): Promise<HomeLocation> => {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) return homeLocationDefaults;

	const record = await loadCustomization(locals.db, locals.user.id, 'home_location');
	return homeLocationSchema.parse(record?.value || {});
});

/** Save home location to user_customization. */
export const saveHomeLocation = command(homeLocationSchema, async (data) => {
	const { db, userId } = getDbAndUser();
	return upsertCustomization(db, userId, 'home_location', data);
});
