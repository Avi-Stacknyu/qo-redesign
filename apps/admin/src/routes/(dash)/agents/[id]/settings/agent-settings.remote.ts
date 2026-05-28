import { getRequestEvent, query, command, form } from '$app/server';
import { aiAgents, configTagCatalog, configTagNamespaces } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { asTagCatalogWithNamespace } from '$lib/utils/tag-helpers';
import { z } from 'zod';

// ============================================================================
// Queries
// ============================================================================

export const getTagCatalog = query(async () => {
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

export const getAgentSettings = query(z.string(), async (agentId) => {
	const { locals } = getRequestEvent();

	if (!agentId) throw new Error('Agent ID is required');

	const [agent] = await locals.db.select().from(aiAgents).where(eq(aiAgents.id, agentId));

	if (!agent) throw new Error('Agent not found');

	const avatarUrl = agent.avatar ? `/api/agent-avatar/${agent.id}` : null;

	return {
		avatar: agent.avatar || null,
		avatar_url: avatarUrl
	};
});

// ============================================================================
// Mutations
// ============================================================================

const prefixedTag = z.string().regex(/^[a-z0-9_-]+:[a-z0-9_-]+$/i, 'Tag must be namespace:value');
const tagGroupSchema = z.object({ tags: z.array(prefixedTag) });
const tagRuleSchema = z.object({ groups: z.array(tagGroupSchema) });

const updateAgentTagsSchema = z.object({
	agentId: z.string(),
	tag_rule: tagRuleSchema,
	is_universal: z.boolean()
});

export const updateAgentTagsAction = command(updateAgentTagsSchema, async (data) => {
	const { locals } = getRequestEvent();
	const now = new Date().toISOString();

	await locals.db
		.update(aiAgents)
		.set({
			tagRule: data.tag_rule,
			isUniversal: data.is_universal,
			updated: now
		})
		.where(eq(aiAgents.id, data.agentId));

	void getAgentSettings(data.agentId).refresh();
	return { success: true };
});

// ============================================================================
// Avatar
// ============================================================================

export const uploadAvatarAction = form(
	z.object({
		agentId: z.string(),
		avatar: z.instanceof(File)
	}),
	async ({ agentId, avatar }) => {
		const { locals, platform } = getRequestEvent();

		if (avatar.size > 2 * 1024 * 1024) {
			return { success: false, error: 'File too large (max 2MB)' };
		}

		const bucket = platform?.env?.DOCUMENTS_BUCKET;
		if (!bucket) return { success: false, error: 'Storage not available' };

		const key = `assets/avatars/ai_agents/${agentId}/${avatar.name}`;
		await bucket.put(key, await avatar.arrayBuffer(), {
			httpMetadata: { contentType: avatar.type }
		});

		const now = new Date().toISOString();
		await locals.db
			.update(aiAgents)
			.set({ avatar: key, updated: now })
			.where(eq(aiAgents.id, agentId));

		void getAgentSettings(agentId).refresh();
		return { success: true };
	}
);

export const deleteAvatarAction = command(
	z.object({ agentId: z.string() }),
	async ({ agentId }) => {
		const { locals, platform } = getRequestEvent();

		const [agent] = await locals.db
			.select({ avatar: aiAgents.avatar })
			.from(aiAgents)
			.where(eq(aiAgents.id, agentId));

		if (agent?.avatar) {
			const bucket = platform?.env?.DOCUMENTS_BUCKET;
			if (bucket) {
				const keyToDelete = agent.avatar.startsWith('assets/')
					? agent.avatar
					: `assets/avatars/ai_agents/${agentId}/${agent.avatar}`;
				await bucket.delete(keyToDelete);
			}
		}

		const now = new Date().toISOString();
		await locals.db
			.update(aiAgents)
			.set({ avatar: null, updated: now })
			.where(eq(aiAgents.id, agentId));

		void getAgentSettings(agentId).refresh();
		return { success: true };
	}
);
