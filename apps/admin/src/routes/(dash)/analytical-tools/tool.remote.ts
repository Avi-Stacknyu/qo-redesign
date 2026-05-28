import { query, form, command, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { toolSchema } from './schema';
import { analyticalTools, configTagCatalog, configTagNamespaces } from '@repo/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { getPaginatedData } from '$lib/functions/pagination';
import { asTagCatalogWithNamespace } from '$lib/utils/tag-helpers';

// ============================================================================
// Types
// ============================================================================

export type ToolRow = typeof analyticalTools.$inferSelect;

// ============================================================================
// Queries
// ============================================================================

export const getPaginatedTools = query(z.string(), async (id) => {
	const { locals, url, cookies } = getRequestEvent();
	return getPaginatedData({
		id,
		loadUrl: url,
		cookies,
		db: locals.db,
		table: analyticalTools,
		searchFilters: ['tool_key', 'display_name', 'description', 'category'],
		sortKey: 'display_name',
		defaultFilter: undefined
	});
});

export const getTagCatalogForTools = query(async () => {
	const { locals } = getRequestEvent();
	const rows = await locals.db
		.select()
		.from(configTagCatalog)
		.leftJoin(configTagNamespaces, eq(configTagCatalog.namespace, configTagNamespaces.id))
		.orderBy(configTagCatalog.namespace, configTagCatalog.tag);
	return asTagCatalogWithNamespace(
		rows.map((r) => ({ ...r.config_tag_catalog, expand: { namespace: r.config_tag_namespaces } }))
	);
});

// ============================================================================
// Mutations
// ============================================================================

function parseJsonOrNull(input: string | undefined): unknown {
	if (!input || input.trim() === '' || input.trim() === '[]') return [];
	try {
		return JSON.parse(input);
	} catch {
		throw new Error('Value must be valid JSON');
	}
}

function parseJsonObjectOrNull(input: string | undefined): unknown {
	if (!input || input.trim() === '' || input.trim() === '{}') return {};
	try {
		return JSON.parse(input);
	} catch {
		throw new Error('Value must be valid JSON');
	}
}

function parseTagRule(input: string | undefined): unknown {
	if (!input || input.trim() === '') return null;
	try {
		return JSON.parse(input);
	} catch {
		throw new Error('Tag rule must be valid JSON');
	}
}

export const saveTool = form('unchecked', async (rawData) => {
	const { locals } = getRequestEvent();
	const data = toolSchema.parse(rawData);
	const { id, ...rest } = data;
	const now = new Date().toISOString();

	try {
		const payload = {
			toolKey: rest.tool_key,
			displayName: rest.display_name,
			description: rest.description ?? '',
			category: rest.category ?? '',
			icon: rest.icon ?? '',
			computationType: rest.computation_type ?? 'worker',
			isActive: rest.is_active,
			inputSchema: parseJsonOrNull(rest.input_schema),
			outputConfig: parseJsonObjectOrNull(rest.output_config),
			tagRule: parseTagRule(rest.tag_rule),
			updated: now
		};

		if (id) {
			await locals.db.update(analyticalTools).set(payload).where(eq(analyticalTools.id, id));
			void getPaginatedTools('').refresh();
			return { success: true, id };
		}
		const newId = generateId();
		await locals.db.insert(analyticalTools).values({ id: newId, ...payload, created: now });
		void getPaginatedTools('').refresh();
		return { success: true, id: newId };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const deleteTool = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	try {
		await locals.db.delete(analyticalTools).where(eq(analyticalTools.id, id));
		void getPaginatedTools('').refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

// ============================================================================
// Bulk Tagging
// ============================================================================

const prefixedTag = z.string().regex(/^[a-z0-9_-]+:[a-z0-9_-]+$/i, 'Tag must be namespace:value');

export const getToolsForBulkPreview = command(
	z.object({ ids: z.array(z.string()) }),
	async ({ ids }) => {
		const { locals } = getRequestEvent();
		const items = await locals.db
			.select()
			.from(analyticalTools)
			.where(inArray(analyticalTools.id, ids));
		return items.map((t) => ({ id: t.id, name: t.displayName, tag_rule: t.tagRule }));
	}
);

export const bulkSetToolTagRule = command(
	z.object({
		ids: z.array(z.string()),
		tag_rule: z.object({ groups: z.array(z.object({ tags: z.array(prefixedTag) })) }),
		mode: z.enum(['replace', 'append'])
	}),
	async ({ ids, tag_rule, mode }) => {
		const { locals } = getRequestEvent();
		for (const id of ids) {
			let finalRule = tag_rule;
			if (mode === 'append') {
				const [existing] = await locals.db
					.select()
					.from(analyticalTools)
					.where(eq(analyticalTools.id, id));
				const existingGroups =
					(existing?.tagRule as { groups: { tags: string[] }[] } | null)?.groups ?? [];
				finalRule = { groups: [...existingGroups, ...tag_rule.groups] };
			}
			await locals.db
				.update(analyticalTools)
				.set({ tagRule: finalRule, updated: new Date().toISOString() })
				.where(eq(analyticalTools.id, id));
		}
		void getPaginatedTools('').refresh();
		return { success: true, updatedCount: ids.length };
	}
);
