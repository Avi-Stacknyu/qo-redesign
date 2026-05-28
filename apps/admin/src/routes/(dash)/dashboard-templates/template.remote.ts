import { query, form, command, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { templateSchema } from './schema';
import { dashboardTemplates, configTagCatalog, configTagNamespaces } from '@repo/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { getPaginatedData } from '$lib/functions/pagination';
import { asTagCatalogWithNamespace } from '$lib/utils/tag-helpers';

// ============================================================================
// Types
// ============================================================================

export type TemplateRow = typeof dashboardTemplates.$inferSelect;

// ============================================================================
// Queries
// ============================================================================

export const getPaginatedTemplates = query(z.string(), async (id) => {
	const { locals, url, cookies } = getRequestEvent();
	return getPaginatedData({
		id,
		loadUrl: url,
		cookies,
		db: locals.db,
		table: dashboardTemplates,
		searchFilters: ['name', 'description', 'category'],
		sortKey: '-created',
		defaultFilter: undefined
	});
});

export const getTagCatalogForTemplates = query(async () => {
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

function parseTagRule(input: string | undefined): unknown {
	if (!input || input.trim() === '') return null;
	try {
		return JSON.parse(input);
	} catch {
		throw new Error('Tag rule must be valid JSON');
	}
}

export const saveTemplate = form('unchecked', async (rawData) => {
	const { locals } = getRequestEvent();
	const data = templateSchema.parse(rawData);
	const { id, ...rest } = data;
	const now = new Date().toISOString();

	try {
		const payload = {
			name: rest.name,
			description: rest.description ?? '',
			category: rest.category ?? '',
			icon: rest.icon ?? '',
			isActive: rest.is_active,
			defaultWidgets: parseJsonOrNull(rest.default_widgets),
			tagRule: parseTagRule(rest.tag_rule),
			updated: now
		};

		if (id) {
			await locals.db.update(dashboardTemplates).set(payload).where(eq(dashboardTemplates.id, id));
			void getPaginatedTemplates('').refresh();
			return { success: true, id };
		}
		const newId = generateId();
		await locals.db.insert(dashboardTemplates).values({ id: newId, ...payload, created: now });
		void getPaginatedTemplates('').refresh();
		return { success: true, id: newId };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const deleteTemplate = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	try {
		await locals.db.delete(dashboardTemplates).where(eq(dashboardTemplates.id, id));
		void getPaginatedTemplates('').refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const updateTemplateWidgets = command(
	z.object({
		id: z.string().min(1),
		default_widgets: z.string()
	}),
	async ({ id, default_widgets }) => {
		const { locals } = getRequestEvent();
		try {
			const parsed = JSON.parse(default_widgets);
			await locals.db
				.update(dashboardTemplates)
				.set({ defaultWidgets: parsed, updated: new Date().toISOString() })
				.where(eq(dashboardTemplates.id, id));
			void getPaginatedTemplates('').refresh();
			return { success: true };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}
);

// ============================================================================
// Bulk Tagging
// ============================================================================

const prefixedTag = z.string().regex(/^[a-z0-9_-]+:[a-z0-9_-]+$/i, 'Tag must be namespace:value');

export const getTemplatesForBulkPreview = command(
	z.object({ ids: z.array(z.string()) }),
	async ({ ids }) => {
		const { locals } = getRequestEvent();
		const items = await locals.db
			.select()
			.from(dashboardTemplates)
			.where(inArray(dashboardTemplates.id, ids));
		return items.map((t) => ({ id: t.id, name: t.name, tag_rule: t.tagRule }));
	}
);

export const bulkSetTemplateTagRule = command(
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
					.from(dashboardTemplates)
					.where(eq(dashboardTemplates.id, id));
				const existingGroups =
					(existing?.tagRule as { groups: { tags: string[] }[] } | null)?.groups ?? [];
				finalRule = { groups: [...existingGroups, ...tag_rule.groups] };
			}
			await locals.db
				.update(dashboardTemplates)
				.set({ tagRule: finalRule, updated: new Date().toISOString() })
				.where(eq(dashboardTemplates.id, id));
		}
		void getPaginatedTemplates('').refresh();
		return { success: true, updatedCount: ids.length };
	}
);
