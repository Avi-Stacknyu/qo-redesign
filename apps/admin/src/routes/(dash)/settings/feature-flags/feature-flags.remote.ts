import { getRequestEvent, query, command, form } from '$app/server';
import { configFeatureFlags, configTagCatalog, configTagNamespaces } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { asTagCatalogWithNamespace } from '$lib/utils/tag-helpers';
import { z } from 'zod';

const saveFlagSchema = z.object({
	id: z.string().optional(),
	flag_key: z.string().min(1, 'Flag key is required'),
	display_name: z.string().min(1, 'Display name is required'),
	description: z.string().optional(),
	is_enabled: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === 'true'),
	tag_rule: z.string().optional()
});

function parseTagRule(input: string | undefined) {
	if (!input || input.trim() === '') return null;
	try {
		return JSON.parse(input);
	} catch {
		return null;
	}
}

// ============================================================================
// Queries
// ============================================================================

export const getFeatureFlags = query(async () => {
	const { locals } = getRequestEvent();
	const flags = await locals.db
		.select()
		.from(configFeatureFlags)
		.orderBy(configFeatureFlags.flagKey);
	return { flags };
});

export const getTagCatalogForFlags = query(async () => {
	const { locals } = getRequestEvent();
	const rows = await locals.db
		.select()
		.from(configTagCatalog)
		.leftJoin(configTagNamespaces, eq(configTagCatalog.namespace, configTagNamespaces.id))
		.orderBy(configTagCatalog.namespace, configTagCatalog.tag);
	return {
		tags: asTagCatalogWithNamespace(
			rows.map((r) => ({
				...r.config_tag_catalog,
				expand: { namespace: r.config_tag_namespaces }
			}))
		)
	};
});

// ============================================================================
// Forms
// ============================================================================

export const saveFeatureFlag = form('unchecked', async (rawData) => {
	const { locals } = getRequestEvent();
	const data = saveFlagSchema.parse(rawData);
	const { id, ...rest } = data;
	const now = new Date().toISOString();

	try {
		const payload = {
			flagKey: rest.flag_key,
			displayName: rest.display_name,
			description: rest.description ?? null,
			isEnabled: rest.is_enabled,
			tagRule: parseTagRule(rest.tag_rule),
			updated: now
		};

		if (id) {
			await locals.db.update(configFeatureFlags).set(payload).where(eq(configFeatureFlags.id, id));
		} else {
			await locals.db.insert(configFeatureFlags).values({
				id: generateId(),
				...payload,
				created: now
			});
		}

		void getFeatureFlags().refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

// ============================================================================
// Commands
// ============================================================================

export const toggleFeatureFlag = command(
	z.object({ id: z.string(), is_enabled: z.boolean() }),
	async ({ id, is_enabled }) => {
		const { locals } = getRequestEvent();
		await locals.db
			.update(configFeatureFlags)
			.set({ isEnabled: is_enabled, updated: new Date().toISOString() })
			.where(eq(configFeatureFlags.id, id));
		void getFeatureFlags().refresh();
		return { success: true };
	}
);

export const deleteFeatureFlag = command(z.object({ id: z.string() }), async ({ id }) => {
	const { locals } = getRequestEvent();
	await locals.db.delete(configFeatureFlags).where(eq(configFeatureFlags.id, id));
	void getFeatureFlags().refresh();
	return { success: true };
});
