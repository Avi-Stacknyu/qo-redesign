import { query, form, command, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { toolSchema } from './schema';
import { aiTools, aiProviders } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { getPaginatedData } from '$lib/functions/pagination';

function parseJsonOrThrow(input: string | undefined, fieldName: string) {
	if (!input || input.trim() === '') return null;
	try {
		return JSON.parse(input);
	} catch {
		throw new Error(`${fieldName} must be valid JSON`);
	}
}

export const getPaginatedTools = query(z.string(), async (id) => {
	const { locals, url, cookies } = getRequestEvent();
	return await getPaginatedData({
		id,
		loadUrl: url,
		cookies,
		db: locals.db,
		table: aiTools,
		searchFilters: ['display_name', 'tool_key', 'sdk_tool_name'],
		sortKey: 'display_name'
	});
});

export const getAllProviders = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db.select().from(aiProviders).orderBy(aiProviders.providerKey);
});

export const saveTool = form(toolSchema, async (data) => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const { id, ...rest } = data;

	try {
		const payload = {
			displayName: rest.display_name,
			toolKey: rest.tool_key,
			description: rest.description ?? null,
			category: rest.category ?? null,
			toolType: rest.tool_type,
			sdkToolName: rest.sdk_tool_name ?? null,
			provider: rest.provider ?? null,
			docsUrl: rest.docs_url ?? null,
			icon: rest.icon ?? null,
			isActive: rest.is_active ?? true,
			isEnabled: rest.is_enabled ?? true,
			configSchema: parseJsonOrThrow(rest.config_schema, 'Config Schema') ?? {},
			defaultConfig: parseJsonOrThrow(rest.default_config, 'Default Config') ?? {},
			executionConfig: parseJsonOrThrow(rest.execution_config, 'Execution Config') ?? {},
			updated: new Date().toISOString()
		};

		if (id) {
			await db.update(aiTools).set(payload).where(eq(aiTools.id, id));
			void getPaginatedTools('').refresh();
			return { success: true, id };
		} else {
			const newId = generateId();
			await db.insert(aiTools).values({
				id: newId,
				...payload,
				created: new Date().toISOString()
			});
			void getPaginatedTools('').refresh();
			return { success: true, id: newId };
		}
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const deleteTool = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	try {
		await locals.db.delete(aiTools).where(eq(aiTools.id, id));
		void getPaginatedTools('').refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});
