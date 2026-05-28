import { query, form, command, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { widgetSchema } from './schema';
import { dashboardWidgets, configTagCatalog, configTagNamespaces } from '@repo/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { getPaginatedData } from '$lib/functions/pagination';
import { asTagCatalogWithNamespace } from '$lib/utils/tag-helpers';

// ============================================================================
// Queries
// ============================================================================

export const getPaginatedWidgets = query(z.string(), async (id) => {
	const { locals, url, cookies } = getRequestEvent();
	return getPaginatedData({
		id,
		loadUrl: url,
		cookies,
		db: locals.db,
		table: dashboardWidgets,
		searchFilters: ['name', 'widget_type', 'category', 'description'],
		sortKey: 'name',
		defaultFilter: undefined
	});
});

export const getTagCatalogForWidgets = query(async () => {
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

export const saveWidget = form(widgetSchema, async (data) => {
	const { locals } = getRequestEvent();
	const { id, ...rest } = data;
	const now = new Date().toISOString();

	try {
		const payload = {
			name: rest.name,
			widgetType: rest.widget_type,
			description: rest.description ?? '',
			category: rest.category ?? '',
			icon: rest.icon ?? '',
			baseType: rest.base_type ?? '',
			defaultSize: rest.default_size,
			isActive: rest.is_active,
			defaultConfig: parseJsonOrNull(rest.default_config),
			lockedConfig: rest.locked_config?.trim() ? parseJsonOrNull(rest.locked_config) : null,
			tagRule: parseTagRule(rest.tag_rule),
			updated: now
		};

		if (id) {
			await locals.db.update(dashboardWidgets).set(payload).where(eq(dashboardWidgets.id, id));
			void getPaginatedWidgets('').refresh();
			return { success: true, id };
		}
		const newId = generateId();
		await locals.db.insert(dashboardWidgets).values({ id: newId, ...payload, created: now });
		void getPaginatedWidgets('').refresh();
		return { success: true, id: newId };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const deleteWidget = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	try {
		await locals.db.delete(dashboardWidgets).where(eq(dashboardWidgets.id, id));
		void getPaginatedWidgets('').refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

// ============================================================================
// Bulk Tagging
// ============================================================================

const prefixedTag = z.string().regex(/^[a-z0-9_-]+:[a-z0-9_-]+$/i, 'Tag must be namespace:value');

export const getWidgetsForBulkPreview = command(
	z.object({ ids: z.array(z.string()) }),
	async ({ ids }) => {
		const { locals } = getRequestEvent();
		const items = await locals.db
			.select()
			.from(dashboardWidgets)
			.where(inArray(dashboardWidgets.id, ids));
		return items.map((w) => ({ id: w.id, name: w.name, tag_rule: w.tagRule }));
	}
);

export const bulkSetWidgetTagRule = command(
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
					.from(dashboardWidgets)
					.where(eq(dashboardWidgets.id, id));
				const existingGroups =
					(existing?.tagRule as { groups: { tags: string[] }[] } | null)?.groups ?? [];
				finalRule = { groups: [...existingGroups, ...tag_rule.groups] };
			}
			await locals.db
				.update(dashboardWidgets)
				.set({ tagRule: finalRule, updated: new Date().toISOString() })
				.where(eq(dashboardWidgets.id, id));
		}
		void getPaginatedWidgets('').refresh();
		return { success: true, updatedCount: ids.length };
	}
);
