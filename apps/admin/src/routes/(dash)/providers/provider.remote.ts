import { form, query, command } from '$app/server';
import { getPaginatedData } from '$lib/functions/pagination';
import { aiProviders } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { z } from 'zod';
import { getRequestEvent } from '$app/server';
import { aiProviderSchema } from './schema';

export const getPaginatedProviders = query(z.string(), async (id) => {
	const { locals, url, cookies } = getRequestEvent();
	return await getPaginatedData({
		id,
		loadUrl: url,
		cookies,
		db: locals.db,
		table: aiProviders,
		searchFilters: ['display_name', 'provider_key', 'env_key_name'],
		sortKey: 'provider_key'
	});
});

export const saveProvider = form(aiProviderSchema, async (data) => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const { id, ...rest } = data;

	try {
		const payload = {
			providerKey: rest.provider_key,
			displayName: rest.display_name,
			envKeyName: rest.env_key_name,
			baseUrl: rest.base_url ?? null,
			docsUrl: rest.docs_url ?? null,
			websiteUrl: rest.website_url ?? null,
			defaultHeaders: rest.default_headers ?? null,
			isActive: rest.is_active ?? true,
			updated: new Date().toISOString()
		};
		if (id) {
			await db.update(aiProviders).set(payload).where(eq(aiProviders.id, id));
		} else {
			await db.insert(aiProviders).values({
				id: generateId(),
				...payload,
				created: new Date().toISOString()
			});
		}
		void getPaginatedProviders('').refresh();
		return { success: true };
	} catch (e) {
		console.error(e);
		return { success: false, error: (e as Error).message };
	}
});

export const deleteProvider = command(z.object({ id: z.string() }), async ({ id }) => {
	const { locals } = getRequestEvent();
	try {
		await locals.db.delete(aiProviders).where(eq(aiProviders.id, id));
		void getPaginatedProviders('').refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});
