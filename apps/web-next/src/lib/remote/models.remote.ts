/**
 * Models Remote — queries and commands for AI model selection.
 * Provides available models list, user model preference CRUD.
 */
import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { aiAgentModels, aiProviders, userCustomization } from '@repo/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import z from 'zod/v4';

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

/** Flattened model for the client — no PB internals exposed. */
export interface AvailableModel {
	id: string;
	model_id: string;
	display_name: string;
	provider_key: string;
	provider_name: string;
	context_window?: number;
	max_output_tokens?: number;
	capabilities?: Record<string, unknown>;
	is_system_default: boolean;
}

/** Load all active + enabled models with their provider info. */
export const getAvailableModels = query(async (): Promise<AvailableModel[]> => {
	const { db } = getDbAndUser();

	const rows = await db
		.select({
			id: aiAgentModels.id,
			modelId: aiAgentModels.modelId,
			displayName: aiAgentModels.displayName,
			contextWindow: aiAgentModels.contextWindow,
			maxOutputTokens: aiAgentModels.maxOutputTokens,
			capabilities: aiAgentModels.capabilities,
			isSystemDefault: aiAgentModels.isSystemDefault,
			providerKey: aiProviders.providerKey,
			providerName: aiProviders.displayName,
			providerActive: aiProviders.isActive
		})
		.from(aiAgentModels)
		.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
		.where(
			and(
				eq(aiAgentModels.isActive, true),
				eq(aiAgentModels.isEnabled, true),
				eq(aiAgentModels.configKey, '')
			)
		)
		.orderBy(asc(aiAgentModels.displayName));

	return rows
		.filter((r) => r.providerActive === true)
		.map((r) => ({
			id: r.id,
			model_id: r.modelId ?? '',
			display_name: r.displayName ?? '',
			provider_key: r.providerKey ?? '',
			provider_name: r.providerName ?? '',
			context_window: r.contextWindow ? Number(r.contextWindow) : undefined,
			max_output_tokens: r.maxOutputTokens ? Number(r.maxOutputTokens) : undefined,
			capabilities: (r.capabilities as Record<string, unknown>) ?? undefined,
			is_system_default: r.isSystemDefault ?? false
		}));
});

/** Load the user's global model preference (PB record ID). */
export const getUserModelPreference = query(async (): Promise<string | null> => {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) return null;

	const [record] = await locals.db
		.select()
		.from(userCustomization)
		.where(
			and(
				eq(userCustomization.user, locals.user.id),
				eq(userCustomization.key, 'model_preference')
			)
		)
		.limit(1);

	if (!record) return null;
	const value = record.value as { model_id?: string } | null;
	return value?.model_id ?? null;
});

/** Save the user's global model preference. Pass null to clear. */
export const saveUserModelPreference = command(
	z.object({ model_id: z.string().nullable() }),
	async ({ model_id }) => {
		const { db, userId } = getDbAndUser();
		const value = model_id ? { model_id } : null;

		const [existing] = await db
			.select()
			.from(userCustomization)
			.where(
				and(
					eq(userCustomization.user, userId),
					eq(userCustomization.key, 'model_preference')
				)
			)
			.limit(1);

		if (existing) {
			if (!model_id) {
				await db
					.delete(userCustomization)
					.where(eq(userCustomization.id, existing.id));
			} else {
				await db
					.update(userCustomization)
					.set({ value, updated: new Date().toISOString() })
					.where(eq(userCustomization.id, existing.id));
			}
		} else if (model_id) {
			const now = new Date().toISOString();
			await db.insert(userCustomization).values({
				id: generateId(),
				user: userId,
				key: 'model_preference',
				value,
				created: now,
				updated: now
			});
		}

		return { saved: true };
	}
);
