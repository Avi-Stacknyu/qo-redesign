import { command, form, query } from '$app/server';
import { getPaginatedData } from '$lib/functions/pagination';
import { aiAgents, configTagCatalog, configTagNamespaces } from '@repo/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import type { TagRule } from '@repo/shared/types';
import { z } from 'zod';
import { getRequestEvent } from '$app/server';
import { asTagCatalogWithNamespace, getTagRuleTags } from '$lib/utils/tag-helpers';

export const getPaginatedAgents = query(z.string(), async (id) => {
	const { locals, url, cookies } = getRequestEvent();
	return getPaginatedData({
		id,
		loadUrl: url,
		cookies,
		db: locals.db,
		table: aiAgents,
		searchFilters: ['name', 'description', 'status'],
		sortKey: '-created',
		defaultFilter: undefined
	});
});

const agentSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, 'Name is required'),
	description: z.string().optional(),
	status: z.enum(['active', 'inactive', 'development']).default('development'),
	purpose: z.enum(['chat', 'discovery']).default('chat')
});

export const saveAgent = form(agentSchema, async (data) => {
	const { locals } = getRequestEvent();
	const { id, ...rest } = data;
	const now = new Date().toISOString();

	try {
		const payload = {
			name: rest.name,
			description: rest.description ?? '',
			status: rest.status,
			purpose: rest.purpose,
			updated: now
		};

		if (id) {
			await locals.db.update(aiAgents).set(payload).where(eq(aiAgents.id, id));
		} else {
			await locals.db.insert(aiAgents).values({ id: generateId(), ...payload, created: now });
		}
		void getPaginatedAgents('').refresh();
		return { success: true };
	} catch (e) {
		console.error(e);
		return { success: false, error: (e as Error).message };
	}
});

export const deleteAgent = form(z.object({ id: z.string() }), async ({ id }) => {
	const { locals } = getRequestEvent();
	try {
		const [agent] = await locals.db.select().from(aiAgents).where(eq(aiAgents.id, id));
		if (!agent) return { success: false, error: 'Agent not found' };
		if (agent.purpose === 'discovery') {
			return { success: false, error: 'Discovery agents cannot be deleted' };
		}
		await locals.db.delete(aiAgents).where(eq(aiAgents.id, id));
		void getPaginatedAgents('').refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

// ============================================================================
// Tag Catalog + Bulk Tagging
// ============================================================================

export const getTagCatalogForBulk = query(async () => {
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

const bulkPreviewSchema = z.object({
	agentIds: z.array(z.string())
});

export const getAgentsForBulkPreview = command(bulkPreviewSchema, async ({ agentIds }) => {
	const { locals } = getRequestEvent();
	const agents = await locals.db.select().from(aiAgents).where(inArray(aiAgents.id, agentIds));
	return agents.map((a) => ({
		id: a.id,
		name: a.name ?? '(unnamed)',
		tags: getTagRuleTags((a.tagRule as TagRule | null) ?? null)
	}));
});

const prefixedTag = z.string().regex(/^[a-z0-9_-]+:[a-z0-9_-]+$/i, 'Tag must be namespace:value');
const bulkSetSchema = z.object({
	agentIds: z.array(z.string()),
	tag_rule: z.object({
		groups: z.array(z.object({ tags: z.array(prefixedTag) }))
	}),
	mode: z.enum(['replace', 'append']).default('replace')
});

export const bulkSetAgentTagRule = command(bulkSetSchema, async ({ agentIds, tag_rule, mode }) => {
	const { locals } = getRequestEvent();

	for (const agentId of agentIds) {
		let finalRule = tag_rule;
		if (mode === 'append') {
			const [existing] = await locals.db.select().from(aiAgents).where(eq(aiAgents.id, agentId));
			const existingGroups =
				(existing?.tagRule as { groups: { tags: string[] }[] } | null)?.groups ?? [];
			finalRule = { groups: [...existingGroups, ...tag_rule.groups] };
		}
		await locals.db
			.update(aiAgents)
			.set({ tagRule: finalRule, updated: new Date().toISOString() })
			.where(eq(aiAgents.id, agentId));
	}

	void getPaginatedAgents('').refresh();
	return { success: true, updatedCount: agentIds.length };
});
