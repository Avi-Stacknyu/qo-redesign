import { query, form, command, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { profilerAgentSchema } from './schema';
import {
	profilerAgents,
	aiAgentModels,
	aiProviders,
	configTagCatalog,
	configTagNamespaces,
	configTagRulePresets,
	configProfileSchema
} from '@repo/db/schema';
import { eq, and, sql, inArray, desc } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { getPaginatedData } from '$lib/functions/pagination';
import { asTagCatalogWithNamespace } from '$lib/utils/tag-helpers';

// ============================================================================
// Types
// ============================================================================

export type ProfilerRow = typeof profilerAgents.$inferSelect & {
	expand?: {
		model?: typeof aiAgentModels.$inferSelect & {
			expand?: { provider?: typeof aiProviders.$inferSelect };
		};
	};
};

// ============================================================================
// Queries
// ============================================================================

export const getPaginatedProfilers = query(z.string(), async (id) => {
	const { locals, url, cookies } = getRequestEvent();
	const db = locals.db;
	const result = await getPaginatedData({
		id,
		loadUrl: url,
		cookies,
		db,
		table: profilerAgents,
		searchFilters: ['name', 'description', 'status'],
		sortKey: '-created',
		defaultFilter: undefined
	});

	if (result.items.length === 0) return result;

	const modelIds = [...new Set(result.items.map((p) => p.model).filter(Boolean))] as string[];
	let modelMap = new Map<
		string,
		typeof aiAgentModels.$inferSelect & { expand: { provider?: typeof aiProviders.$inferSelect } }
	>();

	if (modelIds.length > 0) {
		const models = await db.select().from(aiAgentModels).where(inArray(aiAgentModels.id, modelIds));
		const providerIds = [...new Set(models.map((m) => m.provider).filter(Boolean))] as string[];
		const providers =
			providerIds.length > 0
				? await db.select().from(aiProviders).where(inArray(aiProviders.id, providerIds))
				: [];
		const providerMap = new Map(providers.map((p) => [p.id, p]));
		modelMap = new Map(
			models.map((m) => [
				m.id,
				{ ...m, expand: { provider: providerMap.get(m.provider ?? '') ?? undefined } }
			])
		);
	}

	const enriched = result.items.map((p) => ({
		...p,
		expand: { model: modelMap.get(p.model ?? '') ?? undefined }
	}));

	return { ...result, items: enriched };
});

export const getModelOptions = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const models = await db
		.select()
		.from(aiAgentModels)
		.where(
			and(
				eq(aiAgentModels.isActive, true),
				eq(aiAgentModels.isEnabled, true),
				sql`(${aiAgentModels.configKey} = '' OR ${aiAgentModels.configKey} IS NULL)`
			)
		)
		.orderBy(aiAgentModels.displayName);

	const providerIds = [...new Set(models.map((m) => m.provider).filter(Boolean))] as string[];
	const providers =
		providerIds.length > 0
			? await db.select().from(aiProviders).where(inArray(aiProviders.id, providerIds))
			: [];
	const providerMap = new Map(providers.map((p) => [p.id, p]));

	return models.map((m) => ({
		...m,
		expand: { provider: providerMap.get(m.provider ?? '') ?? undefined }
	}));
});

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

export const getTagRulePresets = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db.select().from(configTagRulePresets).orderBy(configTagRulePresets.name);
});

export const getGlobalSchemaSections = query(async () => {
	const { locals } = getRequestEvent();
	const rows = await locals.db
		.select()
		.from(configProfileSchema)
		.where(eq(configProfileSchema.isActive, true))
		.orderBy(desc(configProfileSchema.created))
		.limit(1);
	if (rows.length === 0) return [];
	const schema = rows[0].schema;
	if (!Array.isArray(schema)) return [];
	return (schema as Array<{ section_id: string; label: string; order: number }>).map((s) => ({
		section_id: s.section_id,
		label: s.label,
		order: s.order ?? 99
	}));
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

function parseTagRuleOrNull(input: string | undefined): unknown {
	if (!input || input.trim() === '') return null;
	try {
		return JSON.parse(input);
	} catch {
		throw new Error('Tag rule must be valid JSON');
	}
}

export const saveProfiler = form(profilerAgentSchema, async (data) => {
	const { locals } = getRequestEvent();
	const { id, ...rest } = data;
	const now = new Date().toISOString();

	try {
		const payload = {
			name: rest.name,
			description: rest.description ?? '',
			status: rest.status,
			systemPrompt: rest.system_prompt,
			model: rest.model ?? null,
			maxTokens: rest.max_tokens != null ? String(rest.max_tokens) : null,
			focusSections: parseJsonOrNull(rest.focus_sections),
			priority: rest.priority ?? null,
			tagRule: parseTagRuleOrNull(rest.tag_rule),
			updated: now
		};

		if (id) {
			await locals.db.update(profilerAgents).set(payload).where(eq(profilerAgents.id, id));
			void getPaginatedProfilers('').refresh();
			return { success: true, id };
		}
		const newId = generateId();
		await locals.db.insert(profilerAgents).values({ id: newId, ...payload, created: now });
		void getPaginatedProfilers('').refresh();
		return { success: true, id: newId };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const deleteProfiler = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	try {
		await locals.db.delete(profilerAgents).where(eq(profilerAgents.id, id));
		void getPaginatedProfilers('').refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const generateProfileSchema = command(
	z.object({
		system_prompt: z.string().min(1, 'Provide a system prompt first'),
		model_id: z.string().min(1, 'Select a model first')
	}),
	async ({ system_prompt, model_id }) => {
		const { platform } = getRequestEvent();
		const worker = platform?.env?.CF_WORKER;
		if (!worker) {
			return { success: false, error: 'Worker not available' };
		}

		const result: { success: boolean; schema?: string; error?: string } =
			await worker.generateProfileSchema({ systemPrompt: system_prompt, modelId: model_id });

		return result;
	}
);
