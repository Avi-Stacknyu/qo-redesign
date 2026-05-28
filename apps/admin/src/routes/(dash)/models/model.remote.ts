import { form, query, command } from '$app/server';
import { getPaginatedData } from '$lib/functions/pagination';
import type { Database } from '@repo/db/client';
import {
	aiAgentModels,
	aiProviders,
	aiTools,
	aiAgentModelsSupportedTools,
	configTagCatalog,
	configTagNamespaces,
	profilerAgents,
	configOnboarding,
	planPackages,
	planPackagesAllowedModels,
	userCustomization,
	aiAgentFlows
} from '@repo/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import z from 'zod/v4';
import { getRequestEvent } from '$app/server';
import { aiAgentModelSchema } from './schema';
import { asTagCatalogWithNamespace } from '$lib/utils/tag-helpers';
import { getPricingAdminData } from '$lib/remote/pricing.remote';
import {
	buildModelEditorData,
	buildModelTableItems,
	modelEditorSelection,
	modelTableSelection,
	type ModelEditorSourceRow,
	type ModelTableProviderRow,
	type ModelTableSourceRow
} from './model-page-data';

function parseJsonField(value: string | undefined, fieldName: string) {
	if (!value || value.trim() === '') return undefined;
	try {
		return JSON.parse(value) as unknown;
	} catch {
		throw new Error(`${fieldName} must be valid JSON`);
	}
}

function getModelDisplayName(model: {
	id: string;
	displayName?: string | null;
	modelId?: string | null;
}) {
	return model.displayName ?? model.modelId ?? model.id;
}

export const getPaginatedAiAgentModels = query(z.string(), async (id) => {
	const { locals, url, cookies } = getRequestEvent();
	const db = locals.db;
	const result = (await getPaginatedData({
		id,
		loadUrl: url,
		cookies,
		db,
		table: aiAgentModels,
		select: modelTableSelection,
		searchFilters: ['display_name', 'model_id'],
		sortKey: '-created',
		defaultFilter: sql`${aiAgentModels.configKey} = '' OR ${aiAgentModels.configKey} IS NULL`
	})) as {
		items: ModelTableSourceRow[];
		totalItems: number;
		totalPages: number;
		page: number;
		perPage: number;
	};

	if (result.items.length === 0) return result;

	const modelIds = result.items.map((m) => m.id);
	const providerIds = [...new Set(result.items.map((m) => m.provider).filter(Boolean))] as string[];

	const [providers, toolCounts] = await Promise.all([
		providerIds.length > 0
			? db
					.select({
						id: aiProviders.id,
						providerKey: aiProviders.providerKey,
						displayName: aiProviders.displayName,
						logo: aiProviders.logo
					})
					.from(aiProviders)
					.where(inArray(aiProviders.id, providerIds))
			: [],
		modelIds.length > 0
			? db
					.select({
						modelId: aiAgentModelsSupportedTools.sourceId,
						count: sql<number>`count(*)::int`
					})
					.from(aiAgentModelsSupportedTools)
					.where(inArray(aiAgentModelsSupportedTools.sourceId, modelIds))
					.groupBy(aiAgentModelsSupportedTools.sourceId)
			: []
	]);

	return {
		...result,
		items: buildModelTableItems({
			models: result.items,
			providers: providers as ModelTableProviderRow[],
			toolCounts
		})
	};
});

export const getProviderOptions = query(async () => {
	const { locals } = getRequestEvent();
	return locals.db
		.select()
		.from(aiProviders)
		.where(eq(aiProviders.isActive, true))
		.orderBy(aiProviders.displayName);
});

export const getToolOptions = query(async () => {
	const { locals } = getRequestEvent();
	return locals.db
		.select()
		.from(aiTools)
		.where(eq(aiTools.isActive, true))
		.orderBy(aiTools.displayName);
});

export const getTagCatalogForModels = query(async () => {
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

export const getModelEditorData = query(z.string(), async (modelId) => {
	const { locals } = getRequestEvent();

	if (!modelId) throw new Error('Model ID is required');

	const [model, toolLinks] = await Promise.all([
		locals.db
			.select(modelEditorSelection)
			.from(aiAgentModels)
			.where(eq(aiAgentModels.id, modelId))
			.limit(1),
		locals.db
			.select({ toolId: aiAgentModelsSupportedTools.targetId })
			.from(aiAgentModelsSupportedTools)
			.where(eq(aiAgentModelsSupportedTools.sourceId, modelId))
			.orderBy(aiAgentModelsSupportedTools.position)
	]);

	const data = buildModelEditorData(
		model[0] as ModelEditorSourceRow | undefined,
		toolLinks.map((row) => row.toolId)
	);
	if (!data) throw new Error('Model not found');

	return data;
});

export const saveAiAgentModel = form('unchecked', async (rawData) => {
	const { locals } = getRequestEvent();
	const data = aiAgentModelSchema.parse(rawData);
	const { id, supported_tools, options_schema, default_options, capabilities, tag_rule, ...rest } =
		data;
	const db = locals.db;
	const now = new Date().toISOString();

	try {
		const parsedTools = supported_tools ? (JSON.parse(supported_tools) as unknown) : [];
		if (!Array.isArray(parsedTools) || parsedTools.some((v) => typeof v !== 'string')) {
			throw new Error('supported_tools must be a JSON array of tool ids');
		}

		const parsedTagRule = parseJsonField(tag_rule, 'tag_rule') ?? null;
		if (parsedTagRule && typeof parsedTagRule === 'object' && 'groups' in parsedTagRule) {
			const tagPattern = /^[a-z0-9_-]+:[a-z0-9_-]+$/i;
			for (const g of (parsedTagRule as { groups: { tags: string[] }[] }).groups) {
				const bad = g.tags.find((t) => !tagPattern.test(t));
				if (bad) throw new Error(`Invalid tag "${bad}" — must be namespace:value`);
			}
		}

		const payload = {
			displayName: rest.display_name,
			modelId: rest.model_id,
			provider: rest.provider,
			description: rest.description ?? '',
			contextWindow: rest.context_window != null ? String(rest.context_window) : null,
			maxOutputTokens: rest.max_output_tokens != null ? String(rest.max_output_tokens) : null,
			isActive: rest.is_active,
			isEnabled: rest.is_enabled,
			isSystemDefault: rest.is_system_default,
			optionsSchema: parseJsonField(options_schema, 'options_schema'),
			defaultOptions: parseJsonField(default_options, 'default_options'),
			capabilities: parseJsonField(capabilities, 'capabilities'),
			tagRule: parsedTagRule,
			updated: now
		};

		const modelId = id ?? generateId();

		if (id) {
			await db.update(aiAgentModels).set(payload).where(eq(aiAgentModels.id, id));
		} else {
			await db.insert(aiAgentModels).values({ id: modelId, ...payload, created: now });
		}

		// Sync supported_tools M2M
		await db
			.delete(aiAgentModelsSupportedTools)
			.where(eq(aiAgentModelsSupportedTools.sourceId, modelId));
		if (parsedTools.length > 0) {
			await db.insert(aiAgentModelsSupportedTools).values(
				(parsedTools as string[]).map((toolId, i) => ({
					sourceId: modelId,
					targetId: toolId,
					position: i + 1
				}))
			);
		}

		void getPaginatedAiAgentModels('').refresh();
		return { success: true, id: modelId };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const setSystemDefaultModel = command(
	z.object({ id: z.string().min(1) }),
	async ({ id }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		try {
			const [target] = await db.select().from(aiAgentModels).where(eq(aiAgentModels.id, id));
			if (!target) return { success: false, error: 'Model not found' };
			if (target.configKey) {
				return { success: false, error: 'Infra configs cannot be set as the system default model' };
			}
			// Clear existing system default(s)
			await db
				.update(aiAgentModels)
				.set({ isSystemDefault: false, updated: new Date().toISOString() })
				.where(
					and(
						eq(aiAgentModels.isSystemDefault, true),
						sql`(${aiAgentModels.configKey} = '' OR ${aiAgentModels.configKey} IS NULL)`
					)
				);
			// Set the new one
			await db
				.update(aiAgentModels)
				.set({ isSystemDefault: true, updated: new Date().toISOString() })
				.where(eq(aiAgentModels.id, id));
			void getPaginatedAiAgentModels('').refresh();
			return { success: true };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}
);

/** @deprecated Use deleteModelWithReplacement instead — this bypasses dependency reassignment */
const _deleteAiAgentModel_REMOVED = null;

export const triggerModelSync = command(async () => {
	const event = getRequestEvent();
	const worker = event.platform?.env?.CF_WORKER;
	if (!worker) return { success: false, error: 'Worker binding unavailable' };
	try {
		const result = await worker.syncModelsFromOpenRouter();
		void getPaginatedAiAgentModels('').refresh();
		void getPricingAdminData().refresh();
		return { success: true, ...result };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const toggleSyncLock = command(z.object({ id: z.string().min(1) }), async ({ id }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	try {
		const [model] = await db
			.select({ syncStatus: aiAgentModels.syncStatus })
			.from(aiAgentModels)
			.where(eq(aiAgentModels.id, id));
		if (!model) return { success: false, error: 'Model not found' };
		const newStatus = model.syncStatus === 'override' ? 'synced' : 'override';
		await db
			.update(aiAgentModels)
			.set({ syncStatus: newStatus, updated: new Date().toISOString() })
			.where(eq(aiAgentModels.id, id));
		void getPaginatedAiAgentModels('').refresh();
		return { success: true, syncStatus: newStatus };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

// ============================================================================
// Smart Deletion — dependency check + replacement
// ============================================================================

export interface ModelDependency {
	agents: { id: string; name: string }[];
	onboardingConfigs: { id: string }[];
	planFallbacks: { id: string; title: string }[];
	planAllowedModels: { planId: string; title: string }[];
	userPreferences: number;
	flowNodePins: { flowId: string; agentName: string; nodeCount: number }[];
	isSystemDefault: boolean;
	hasDependencies: boolean;
}

export interface BulkBlockedModel {
	id: string;
	name: string;
	reasons: string[];
}

export interface BulkModelMutationResult {
	success: boolean;
	action: 'activate' | 'deactivate' | 'lockSync' | 'unlockSync' | 'delete';
	processed: number;
	changed: number;
	skipped: number;
	blocked: BulkBlockedModel[];
	error?: string;
}

function emptyModelDependency(): ModelDependency {
	return {
		agents: [],
		onboardingConfigs: [],
		planFallbacks: [],
		planAllowedModels: [],
		userPreferences: 0,
		flowNodePins: [],
		isSystemDefault: false,
		hasDependencies: false
	};
}

function summarizeDependencyReasons(dep: ModelDependency) {
	const reasons: string[] = [];
	if (dep.isSystemDefault) reasons.push('system default');
	if (dep.agents.length > 0)
		reasons.push(`${dep.agents.length} profiler agent${dep.agents.length === 1 ? '' : 's'}`);
	if (dep.onboardingConfigs.length > 0) {
		reasons.push(
			`${dep.onboardingConfigs.length} onboarding config${dep.onboardingConfigs.length === 1 ? '' : 's'}`
		);
	}
	if (dep.planFallbacks.length > 0) {
		reasons.push(
			`${dep.planFallbacks.length} fallback plan${dep.planFallbacks.length === 1 ? '' : 's'}`
		);
	}
	if (dep.planAllowedModels.length > 0) {
		reasons.push(
			`${dep.planAllowedModels.length} allowed-model plan${dep.planAllowedModels.length === 1 ? '' : 's'}`
		);
	}
	if (dep.userPreferences > 0) {
		reasons.push(`${dep.userPreferences} user preference${dep.userPreferences === 1 ? '' : 's'}`);
	}
	const flowNodeCount = dep.flowNodePins.reduce((sum, flow) => sum + flow.nodeCount, 0);
	if (flowNodeCount > 0)
		reasons.push(`${flowNodeCount} flow node pin${flowNodeCount === 1 ? '' : 's'}`);
	return reasons;
}

async function getModelDependencySnapshot(db: Database, id: string) {
	const [model] = await db
		.select({
			id: aiAgentModels.id,
			displayName: aiAgentModels.displayName,
			modelId: aiAgentModels.modelId,
			isSystemDefault: aiAgentModels.isSystemDefault,
			configKey: aiAgentModels.configKey
		})
		.from(aiAgentModels)
		.where(eq(aiAgentModels.id, id));

	if (!model) return null;

	const agents = await db
		.select({ id: profilerAgents.id, name: profilerAgents.name })
		.from(profilerAgents)
		.where(eq(profilerAgents.model, id));

	const onboardingConfigs = await db
		.select({ id: configOnboarding.id })
		.from(configOnboarding)
		.where(eq(configOnboarding.model, id));

	const planFallbacks = await db
		.select({ id: planPackages.id, title: planPackages.title })
		.from(planPackages)
		.where(eq(planPackages.fallbackModel, id));

	const allowedModelRows = await db
		.select({
			planId: planPackagesAllowedModels.sourceId,
			title: planPackages.title
		})
		.from(planPackagesAllowedModels)
		.innerJoin(planPackages, eq(planPackagesAllowedModels.sourceId, planPackages.id))
		.where(eq(planPackagesAllowedModels.targetId, id));

	const [prefCount] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(userCustomization)
		.where(
			and(
				eq(userCustomization.key, 'model_preference'),
				sql`${userCustomization.value}->>'model_id' = ${id}`
			)
		);

	const flowRows = await db
		.select({
			flowId: aiAgentFlows.id,
			agentId: aiAgentFlows.agent,
			flowData: aiAgentFlows.flowData
		})
		.from(aiAgentFlows)
		.where(sql`${aiAgentFlows.flowData}::text LIKE ${'%' + id + '%'}`);

	const flowNodePins: { flowId: string; agentName: string; nodeCount: number }[] = [];
	for (const row of flowRows) {
		const fd = row.flowData as {
			nodes?: {
				data?: {
					model_id?: string;
					context_management?: { summarization?: { model_id?: string } };
				};
			}[];
		} | null;
		let pinned = fd?.nodes?.filter((n) => n.data?.model_id === id).length ?? 0;
		pinned +=
			fd?.nodes?.filter((n) => n.data?.context_management?.summarization?.model_id === id).length ??
			0;
		if (pinned > 0) {
			flowNodePins.push({
				flowId: row.flowId,
				agentName: row.agentId ?? 'Unknown',
				nodeCount: pinned
			});
		}
	}

	const isSystemDefault = model.isSystemDefault === true;
	const dependency: ModelDependency = {
		agents: agents.map((agent) => ({ id: agent.id, name: agent.name ?? 'Unnamed' })),
		onboardingConfigs: onboardingConfigs.map((config) => ({ id: config.id })),
		planFallbacks: planFallbacks.map((plan) => ({
			id: plan.id,
			title: plan.title ?? 'Untitled'
		})),
		planAllowedModels: allowedModelRows.map((plan) => ({
			planId: plan.planId,
			title: plan.title ?? 'Untitled'
		})),
		userPreferences: prefCount?.count ?? 0,
		flowNodePins,
		isSystemDefault,
		hasDependencies:
			agents.length > 0 ||
			onboardingConfigs.length > 0 ||
			planFallbacks.length > 0 ||
			allowedModelRows.length > 0 ||
			(prefCount?.count ?? 0) > 0 ||
			flowNodePins.length > 0 ||
			isSystemDefault
	};

	return { model, dependency };
}

function createBlockedModel(
	model: { id: string; displayName?: string | null; modelId?: string | null },
	dependency: ModelDependency
): BulkBlockedModel {
	return {
		id: model.id,
		name: getModelDisplayName(model),
		reasons: summarizeDependencyReasons(dependency)
	};
}

export const getModelDependencies = command(
	z.object({ id: z.string().min(1) }),
	async ({ id }): Promise<ModelDependency & { success: boolean; error?: string }> => {
		const { locals } = getRequestEvent();
		const db = locals.db;

		try {
			const snapshot = await getModelDependencySnapshot(db, id);
			if (!snapshot) return { ...emptyModelDependency(), success: false, error: 'Model not found' };
			return { ...snapshot.dependency, success: true };
		} catch (e) {
			return { ...emptyModelDependency(), success: false, error: (e as Error).message };
		}
	}
);

export const bulkUpdateAiAgentModels = command(
	z.object({
		ids: z.array(z.string().min(1)).min(1),
		action: z.enum(['activate', 'deactivate', 'lockSync', 'unlockSync'])
	}),
	async ({ ids, action }): Promise<BulkModelMutationResult> => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const uniqueIds = [...new Set(ids)];
		const emptyResult: BulkModelMutationResult = {
			success: true,
			action,
			processed: uniqueIds.length,
			changed: 0,
			skipped: 0,
			blocked: []
		};

		try {
			const models = await db
				.select({
					id: aiAgentModels.id,
					displayName: aiAgentModels.displayName,
					modelId: aiAgentModels.modelId,
					syncStatus: aiAgentModels.syncStatus
				})
				.from(aiAgentModels)
				.where(inArray(aiAgentModels.id, uniqueIds));

			if (models.length === 0) {
				return { ...emptyResult, success: false, error: 'No models found' };
			}

			const now = new Date().toISOString();
			const targetIds: string[] = [];
			const blocked: BulkBlockedModel[] = [];
			let skipped = uniqueIds.length - models.length;

			if (action === 'activate') {
				for (const model of models) targetIds.push(model.id);
				if (targetIds.length > 0) {
					await db
						.update(aiAgentModels)
						.set({ isActive: true, isEnabled: true, updated: now })
						.where(inArray(aiAgentModels.id, targetIds));
				}
			} else if (action === 'deactivate') {
				for (const model of models) {
					const snapshot = await getModelDependencySnapshot(db, model.id);
					if (!snapshot) {
						skipped += 1;
						continue;
					}
					if (snapshot.dependency.hasDependencies) {
						blocked.push(createBlockedModel(snapshot.model, snapshot.dependency));
						continue;
					}
					targetIds.push(model.id);
				}
				if (targetIds.length > 0) {
					await db
						.update(aiAgentModels)
						.set({ isActive: false, isEnabled: false, updated: now })
						.where(inArray(aiAgentModels.id, targetIds));
				}
			} else if (action === 'lockSync') {
				for (const model of models) {
					if (model.syncStatus === 'synced' || model.syncStatus === 'override') {
						targetIds.push(model.id);
					} else {
						skipped += 1;
					}
				}
				if (targetIds.length > 0) {
					await db
						.update(aiAgentModels)
						.set({ syncStatus: 'override', updated: now })
						.where(inArray(aiAgentModels.id, targetIds));
				}
			} else {
				for (const model of models) {
					if (model.syncStatus === 'override') {
						targetIds.push(model.id);
					} else {
						skipped += 1;
					}
				}
				if (targetIds.length > 0) {
					await db
						.update(aiAgentModels)
						.set({ syncStatus: 'synced', updated: now })
						.where(inArray(aiAgentModels.id, targetIds));
				}
			}

			void getPaginatedAiAgentModels('').refresh();
			return {
				...emptyResult,
				changed: targetIds.length,
				skipped,
				blocked
			};
		} catch (e) {
			return { ...emptyResult, success: false, error: (e as Error).message };
		}
	}
);

export const bulkDeleteAiAgentModels = command(
	z.object({ ids: z.array(z.string().min(1)).min(1) }),
	async ({ ids }): Promise<BulkModelMutationResult> => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const uniqueIds = [...new Set(ids)];
		const emptyResult: BulkModelMutationResult = {
			success: true,
			action: 'delete',
			processed: uniqueIds.length,
			changed: 0,
			skipped: 0,
			blocked: []
		};

		try {
			const safeIds: string[] = [];
			const blocked: BulkBlockedModel[] = [];
			let skipped = 0;

			for (const id of uniqueIds) {
				const snapshot = await getModelDependencySnapshot(db, id);
				if (!snapshot) {
					skipped += 1;
					continue;
				}
				if (snapshot.dependency.hasDependencies) {
					blocked.push(createBlockedModel(snapshot.model, snapshot.dependency));
					continue;
				}
				safeIds.push(id);
			}

			if (safeIds.length > 0) {
				await db.delete(aiAgentModels).where(inArray(aiAgentModels.id, safeIds));
			}

			void getPaginatedAiAgentModels('').refresh();
			return {
				...emptyResult,
				changed: safeIds.length,
				skipped,
				blocked
			};
		} catch (e) {
			return { ...emptyResult, success: false, error: (e as Error).message };
		}
	}
);

/** Get active models for the replacement selector (excludes the model being deleted) */
export const getReplacementModelOptions = command(
	z.object({ excludeId: z.string().min(1) }),
	async ({ excludeId }) => {
		const { locals } = getRequestEvent();
		return locals.db
			.select({
				id: aiAgentModels.id,
				displayName: aiAgentModels.displayName,
				modelId: aiAgentModels.modelId,
				providerKey: aiProviders.providerKey,
				isSystemDefault: aiAgentModels.isSystemDefault
			})
			.from(aiAgentModels)
			.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
			.where(
				and(
					eq(aiAgentModels.isActive, true),
					sql`${aiAgentModels.id} != ${excludeId}`,
					sql`(${aiAgentModels.configKey} = '' OR ${aiAgentModels.configKey} IS NULL)`
				)
			)
			.orderBy(aiAgentModels.displayName);
	}
);

/** Delete a model after reassigning all dependencies to a replacement model */
export const deleteModelWithReplacement = command(
	z.object({
		id: z.string().min(1),
		replacementId: z.string().min(1).optional()
	}),
	async ({ id, replacementId }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const now = new Date().toISOString();

		try {
			// Verify the target model exists
			const [target] = await db
				.select({
					id: aiAgentModels.id,
					displayName: aiAgentModels.displayName,
					isSystemDefault: aiAgentModels.isSystemDefault
				})
				.from(aiAgentModels)
				.where(eq(aiAgentModels.id, id));
			if (!target) return { success: false, error: 'Model not found' };

			// Guard: deleting the system default requires a replacement
			if (target.isSystemDefault && !replacementId) {
				return {
					success: false,
					error: 'Cannot delete the system default model without a replacement'
				};
			}

			// If a replacement is specified, verify it exists
			if (replacementId) {
				const [replacement] = await db
					.select({ id: aiAgentModels.id })
					.from(aiAgentModels)
					.where(eq(aiAgentModels.id, replacementId));
				if (!replacement) return { success: false, error: 'Replacement model not found' };
			}

			// 1. Reassign profiler agents
			if (replacementId) {
				await db
					.update(profilerAgents)
					.set({ model: replacementId, updated: now })
					.where(eq(profilerAgents.model, id));
			}

			// 2. Reassign onboarding configs
			if (replacementId) {
				await db
					.update(configOnboarding)
					.set({ model: replacementId, updated: now })
					.where(eq(configOnboarding.model, id));
			}

			// 3. Reassign plan package fallback models
			if (replacementId) {
				await db
					.update(planPackages)
					.set({ fallbackModel: replacementId, updated: now })
					.where(eq(planPackages.fallbackModel, id));
			}

			// 4. Reassign user model preferences (JSONB update)
			if (replacementId) {
				await db
					.update(userCustomization)
					.set({
						value: sql`jsonb_set(${userCustomization.value}, '{model_id}', to_jsonb(${replacementId}::text))`,
						updated: now
					})
					.where(
						and(
							eq(userCustomization.key, 'model_preference'),
							sql`${userCustomization.value}->>'model_id' = ${id}`
						)
					);
			} else {
				// No replacement — clear the preferences that reference this model
				await db
					.delete(userCustomization)
					.where(
						and(
							eq(userCustomization.key, 'model_preference'),
							sql`${userCustomization.value}->>'model_id' = ${id}`
						)
					);
			}

			// 5. Reassign flow node model pins + summarization model (JSONB update in flowData)
			//    Also invalidate compiled_config so runtime doesn't use stale model refs
			const flowRows = await db
				.select({
					flowId: aiAgentFlows.id,
					flowData: aiAgentFlows.flowData
				})
				.from(aiAgentFlows)
				.where(sql`${aiAgentFlows.flowData}::text LIKE ${'%' + id + '%'}`);

			for (const row of flowRows) {
				const fd = row.flowData as {
					nodes?: {
						data?: {
							model_id?: string;
							context_management?: {
								summarization?: { model_id?: string };
							};
						};
					}[];
				} | null;
				if (!fd?.nodes) continue;
				let changed = false;
				for (const node of fd.nodes) {
					// Handle node-level model pins (LLM/Classifier nodes)
					if (node.data?.model_id === id) {
						if (replacementId) {
							node.data.model_id = replacementId;
						} else {
							delete node.data.model_id;
						}
						changed = true;
					}
					// Handle context_management.summarization.model_id (start node)
					if (node.data?.context_management?.summarization?.model_id === id) {
						if (replacementId) {
							node.data.context_management.summarization.model_id = replacementId;
						} else {
							delete node.data.context_management.summarization.model_id;
						}
						changed = true;
					}
				}
				if (changed) {
					// Update flowData AND invalidate compiled_config so runtime picks up changes
					await db
						.update(aiAgentFlows)
						.set({
							flowData: fd,
							compiledConfig: null,
							validationStatus: 'stale'
						})
						.where(eq(aiAgentFlows.id, row.flowId));
				}
			}

			// 6. Transfer system default to replacement
			if (target.isSystemDefault && replacementId) {
				await db
					.update(aiAgentModels)
					.set({ isSystemDefault: true, updated: now })
					.where(eq(aiAgentModels.id, replacementId));
			}

			// 7. Reassign plan allowed model entries (before CASCADE deletes them)
			if (replacementId) {
				// Find plans that have the deleted model in allowed_models
				const allowedEntries = await db
					.select({
						sourceId: planPackagesAllowedModels.sourceId,
						position: planPackagesAllowedModels.position
					})
					.from(planPackagesAllowedModels)
					.where(eq(planPackagesAllowedModels.targetId, id));

				for (const entry of allowedEntries) {
					// Check if replacement already exists in this plan's allowed models
					const [existing] = await db
						.select({ sourceId: planPackagesAllowedModels.sourceId })
						.from(planPackagesAllowedModels)
						.where(
							and(
								eq(planPackagesAllowedModels.sourceId, entry.sourceId),
								eq(planPackagesAllowedModels.targetId, replacementId)
							)
						);
					if (!existing) {
						// Swap target to replacement (keeps the plan slot)
						await db
							.update(planPackagesAllowedModels)
							.set({ targetId: replacementId })
							.where(
								and(
									eq(planPackagesAllowedModels.sourceId, entry.sourceId),
									eq(planPackagesAllowedModels.position, entry.position)
								)
							);
					}
					// If replacement already exists, CASCADE will just remove the old row
				}
			}

			// 8. Delete the model (CASCADE handles supported_tools M2M and remaining plan allowed_models M2M)
			await db.delete(aiAgentModels).where(eq(aiAgentModels.id, id));

			void getPaginatedAiAgentModels('').refresh();
			return { success: true };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}
);
