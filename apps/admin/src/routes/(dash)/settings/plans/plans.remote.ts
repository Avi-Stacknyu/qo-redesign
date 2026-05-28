import { form, query, getRequestEvent } from '$app/server';
import { asTagCatalogWithNamespace } from '$lib/utils/tag-helpers';
import {
	planPackages,
	planPackagesAllowedModels,
	planPackagesAllowedTools,
	aiAgentModels,
	aiTools,
	aiAgents,
	configTagCatalog,
	configTagNamespaces
} from '@repo/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import type { TagRule } from '@repo/shared/types';
import { planPackageSchema } from './schema';

export const getPlans = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const plans = await db
		.select()
		.from(planPackages)
		.orderBy(planPackages.type, sql`is_subscription DESC`, sql`highlight DESC`, sql`created DESC`);

	if (plans.length === 0) return [];

	const planIds = plans.map((p) => p.id);

	const [modelLinks, toolLinks, fallbackModelIds] = await Promise.all([
		db
			.select()
			.from(planPackagesAllowedModels)
			.innerJoin(aiAgentModels, eq(planPackagesAllowedModels.targetId, aiAgentModels.id))
			.where(inArray(planPackagesAllowedModels.sourceId, planIds)),
		db
			.select()
			.from(planPackagesAllowedTools)
			.innerJoin(aiTools, eq(planPackagesAllowedTools.targetId, aiTools.id))
			.where(inArray(planPackagesAllowedTools.sourceId, planIds)),
		Promise.resolve([...new Set(plans.map((p) => p.fallbackModel).filter(Boolean))] as string[])
	]);

	const fallbackModels =
		fallbackModelIds.length > 0
			? await db.select().from(aiAgentModels).where(inArray(aiAgentModels.id, fallbackModelIds))
			: [];
	const fallbackMap = new Map(fallbackModels.map((m) => [m.id, m]));

	const modelsMap = new Map<string, (typeof aiAgentModels.$inferSelect)[]>();
	for (const row of modelLinks) {
		const arr = modelsMap.get(row.plan_packages__allowed_models.sourceId) ?? [];
		arr.push(row.ai_agent_models);
		modelsMap.set(row.plan_packages__allowed_models.sourceId, arr);
	}

	const toolsMap = new Map<string, (typeof aiTools.$inferSelect)[]>();
	for (const row of toolLinks) {
		const arr = toolsMap.get(row.plan_packages__allowed_tools.sourceId) ?? [];
		arr.push(row.ai_tools);
		toolsMap.set(row.plan_packages__allowed_tools.sourceId, arr);
	}

	return plans.map((p) => ({
		...p,
		expand: {
			allowed_models: modelsMap.get(p.id) ?? [],
			allowed_tools: toolsMap.get(p.id) ?? [],
			fallback_model: fallbackMap.get(p.fallbackModel ?? '') ?? undefined
		}
	}));
});

export const getModelOptions = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db
		.select()
		.from(aiAgentModels)
		.where(and(eq(aiAgentModels.isActive, true), sql`(config_key = '' OR config_key IS NULL)`))
		.orderBy(aiAgentModels.displayName);
});

export const getToolOptions = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db
		.select()
		.from(aiTools)
		.where(eq(aiTools.isActive, true))
		.orderBy(aiTools.displayName);
});

export const getTagCatalogOptions = query(async () => {
	const { locals } = getRequestEvent();
	const rows = await locals.db
		.select()
		.from(configTagCatalog)
		.leftJoin(configTagNamespaces, eq(configTagCatalog.namespace, configTagNamespaces.id))
		.orderBy(configTagCatalog.namespace, configTagCatalog.tag);
	return asTagCatalogWithNamespace(
		rows.map((r) => ({
			...r.config_tag_catalog,
			expand: { namespace: r.config_tag_namespaces }
		}))
	);
});

export const savePlan = form(planPackageSchema, async (data) => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const {
		id,
		allowed_models,
		allowed_tools,
		granted_tags,
		credits,
		is_subscription,
		is_active,
		is_archived,
		highlight,
		...rest
	} = data;

	try {
		const parsedModels = allowed_models ? (JSON.parse(allowed_models as string) as string[]) : [];
		const parsedTools = allowed_tools ? (JSON.parse(allowed_tools as string) as string[]) : [];
		const parsedTags = granted_tags ? (JSON.parse(granted_tags as string) as string[]) : [];
		const tagPattern = /^[a-z0-9_-]+:[a-z0-9_-]+$/i;
		const invalidTag = parsedTags.find((t) => !tagPattern.test(t));
		if (invalidTag) throw new Error(`Invalid tag format "${invalidTag}" — must be namespace:value`);

		const now = new Date().toISOString();
		const payload = {
			title: rest.title,
			subtitle: rest.subtitle,
			description: rest.description,
			type: rest.type,
			provider: rest.provider,
			productId: rest.product_id,
			stripePriceId: rest.stripe_price_id,
			credits: String(Number(credits) || 0),
			isSubscription: is_subscription === 'true',
			isActive: is_active === 'true',
			isArchived: is_archived === 'true',
			highlight: highlight === 'true',
			grantedTags: parsedTags,
			fallbackModel: (rest.fallback_model as string) || null,
			updated: now
		};

		const planId = id || generateId();

		if (id) {
			await db.update(planPackages).set(payload).where(eq(planPackages.id, id));
		} else {
			await db.insert(planPackages).values({ id: planId, ...payload, created: now });
		}

		// Sync allowed_models M2M
		await db
			.delete(planPackagesAllowedModels)
			.where(eq(planPackagesAllowedModels.sourceId, planId));
		if (parsedModels.length > 0) {
			await db.insert(planPackagesAllowedModels).values(
				parsedModels.map((modelId, i) => ({
					sourceId: planId,
					targetId: modelId,
					position: i + 1
				}))
			);
		}

		// Sync allowed_tools M2M
		await db.delete(planPackagesAllowedTools).where(eq(planPackagesAllowedTools.sourceId, planId));
		if (parsedTools.length > 0) {
			await db.insert(planPackagesAllowedTools).values(
				parsedTools.map((toolId, i) => ({
					sourceId: planId,
					targetId: toolId,
					position: i + 1
				}))
			);
		}

		const [record] = await db.select().from(planPackages).where(eq(planPackages.id, planId));
		void getPlans().refresh();
		return { success: true as const, record };
	} catch (e) {
		return { success: false as const, error: (e as Error).message };
	}
});

/** Returns agents grouped by which tags they require, for cross-reference in plan editor. */
export const getAgentsByTag = query(async () => {
	const { locals } = getRequestEvent();
	const agents = await locals.db
		.select({
			id: aiAgents.id,
			name: aiAgents.name,
			tagRule: aiAgents.tagRule,
			isUniversal: aiAgents.isUniversal
		})
		.from(aiAgents)
		.orderBy(aiAgents.name);

	const tagToAgents: Record<string, { id: string; name: string }[]> = {};
	for (const agent of agents) {
		if (agent.isUniversal) continue;
		const rule = agent.tagRule as TagRule | null;
		const groups = rule?.groups ?? [];
		const tags = [...new Set(groups.flatMap((g) => g.tags))];
		for (const tag of tags) {
			(tagToAgents[tag] ??= []).push({ id: agent.id, name: agent.name ?? '(unnamed)' });
		}
	}
	return tagToAgents;
});
