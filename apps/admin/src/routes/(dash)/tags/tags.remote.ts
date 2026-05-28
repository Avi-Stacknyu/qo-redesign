import { getRequestEvent, query, command, form } from '$app/server';
import { configTagCatalog, configTagNamespaces, configTagRulePresets } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { z } from 'zod/v4';

export type TagWithNamespace = typeof configTagCatalog.$inferSelect & {
	expand: { namespace: typeof configTagNamespaces.$inferSelect | null };
};

// ============================================================================
// Namespace Queries & Forms
// ============================================================================

export const getTagNamespaces = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db
		.select()
		.from(configTagNamespaces)
		.orderBy(configTagNamespaces.sortOrder, configTagNamespaces.name);
});

const saveNamespaceSchema = z.object({
	id: z.string().optional(),
	name: z
		.string()
		.min(1)
		.regex(/^[a-z0-9_-]+$/, 'Name must be lowercase alphanumeric with dashes/underscores'),
	display_name: z.string().min(1),
	color_class: z.string().min(1),
	icon: z.string().optional(),
	description: z.string().optional(),
	is_assignable_onboarding: z
		.union([z.boolean(), z.string()])
		.transform((v) => v === true || v === 'true'),
	is_user_editable: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === 'true'),
	sort_order: z
		.union([z.number(), z.string()])
		.transform((v) => (typeof v === 'string' ? parseInt(v, 10) || 0 : v))
		.optional()
});

export const saveNamespace = form('unchecked', async (rawData) => {
	const { locals } = getRequestEvent();
	const data = saveNamespaceSchema.parse(rawData);
	const { id, ...rest } = data;
	const now = new Date().toISOString();

	try {
		const payload = {
			name: rest.name,
			displayName: rest.display_name,
			colorClass: rest.color_class,
			icon: rest.icon ?? null,
			description: rest.description ?? null,
			isAssignableOnboarding: rest.is_assignable_onboarding,
			isUserEditable: rest.is_user_editable,
			sortOrder: rest.sort_order != null ? String(rest.sort_order) : null,
			updated: now
		};

		if (id) {
			await locals.db
				.update(configTagNamespaces)
				.set(payload)
				.where(eq(configTagNamespaces.id, id));
		} else {
			await locals.db.insert(configTagNamespaces).values({
				id: generateId(),
				...payload,
				created: now
			});
		}

		void getTagNamespaces().refresh();
		void getTagCatalog().refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const deleteNamespaceAction = command(z.object({ id: z.string() }), async ({ id }) => {
	const { locals } = getRequestEvent();
	await locals.db.delete(configTagNamespaces).where(eq(configTagNamespaces.id, id));
	void getTagNamespaces().refresh();
	return { success: true };
});

// ============================================================================
// Tag Catalog Queries & Forms
// ============================================================================

const saveTagSchema = z.object({
	id: z.string().optional(),
	tag: z.string().min(1),
	namespace: z.string().min(1),
	description: z.string().optional()
});

export const getTagCatalog = query(async () => {
	const { locals } = getRequestEvent();
	const rows = await locals.db
		.select()
		.from(configTagCatalog)
		.leftJoin(configTagNamespaces, eq(configTagCatalog.namespace, configTagNamespaces.id))
		.orderBy(configTagCatalog.namespace, configTagCatalog.tag);

	const tags = rows.map((r) => ({
		...r.config_tag_catalog,
		expand: { namespace: r.config_tag_namespaces }
	}));

	return { tags };
});

export const saveTag = form('unchecked', async (rawData) => {
	const { locals } = getRequestEvent();
	const data = saveTagSchema.parse(rawData);
	const { id, ...rest } = data;
	const now = new Date().toISOString();

	try {
		const payload = {
			tag: rest.tag,
			namespace: rest.namespace,
			description: rest.description ?? null,
			updated: now
		};

		if (id) {
			await locals.db.update(configTagCatalog).set(payload).where(eq(configTagCatalog.id, id));
		} else {
			await locals.db.insert(configTagCatalog).values({
				id: generateId(),
				...payload,
				created: now
			});
		}

		void getTagCatalog().refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const deleteTagAction = command(z.object({ id: z.string() }), async ({ id }) => {
	const { locals } = getRequestEvent();
	await locals.db.delete(configTagCatalog).where(eq(configTagCatalog.id, id));
	void getTagCatalog().refresh();
	return { success: true };
});

// ============================================================================
// Tag Rule Presets
// ============================================================================

const prefixedTag = z.string().regex(/^[a-z0-9_-]+:[a-z0-9_-]+$/i, 'Tag must be namespace:value');
const tagRuleSchema = z.object({
	groups: z.array(z.object({ tags: z.array(prefixedTag) }))
});

export const getTagRulePresets = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db.select().from(configTagRulePresets).orderBy(configTagRulePresets.name);
});

const createPresetSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	tag_rule: tagRuleSchema
});

export const createPresetAction = command(createPresetSchema, async (data) => {
	const { locals } = getRequestEvent();
	await locals.db.insert(configTagRulePresets).values({
		id: generateId(),
		name: data.name,
		description: data.description ?? null,
		tagRule: data.tag_rule,
		created: new Date().toISOString(),
		updated: new Date().toISOString()
	});
	return { success: true };
});

export const deletePresetAction = command(z.object({ id: z.string() }), async ({ id }) => {
	const { locals } = getRequestEvent();
	await locals.db.delete(configTagRulePresets).where(eq(configTagRulePresets.id, id));
	return { success: true };
});
