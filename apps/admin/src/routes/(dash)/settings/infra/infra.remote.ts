import { form, getRequestEvent, query } from '$app/server';
import z from 'zod/v4';
import { aiAgentModels, aiPrompts, aiProviders, aiPricingRates } from '@repo/db/schema';
import { eq, ne, and, sql, desc, inArray } from 'drizzle-orm';
import { generateId } from '@repo/db/id';

export const getInfraAdminData = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const [configs, prompts, providers] = await Promise.all([
		db
			.select()
			.from(aiAgentModels)
			.where(sql`config_key <> '' AND config_key IS NOT NULL`)
			.orderBy(aiAgentModels.configKey, desc(aiAgentModels.created)),
		db
			.select()
			.from(aiPrompts)
			.where(ne(aiPrompts.promptKey, 'onboarding_profiler'))
			.orderBy(aiPrompts.promptKey, desc(aiPrompts.version), desc(aiPrompts.created)),
		db
			.select()
			.from(aiProviders)
			.where(eq(aiProviders.isActive, true))
			.orderBy(aiProviders.displayName)
	]);

	// Enrich configs with provider + current_pricing expand
	const providerIds = [...new Set(configs.map((c) => c.provider).filter(Boolean))] as string[];
	const pricingIds = [...new Set(configs.map((c) => c.currentPricing).filter(Boolean))] as string[];

	const [providerRows, pricingRows] = await Promise.all([
		providerIds.length > 0
			? db.select().from(aiProviders).where(inArray(aiProviders.id, providerIds))
			: [],
		pricingIds.length > 0
			? db.select().from(aiPricingRates).where(inArray(aiPricingRates.id, pricingIds))
			: []
	]);

	const providerMap = new Map(providerRows.map((p) => [p.id, p]));
	const pricingMap = new Map(pricingRows.map((p) => [p.id, p]));

	const enrichedConfigs = configs.map((c) => ({
		...c,
		expand: {
			provider: providerMap.get(c.provider ?? '') ?? undefined,
			current_pricing: pricingMap.get(c.currentPricing ?? '') ?? undefined
		}
	}));

	return { configs: enrichedConfigs, prompts, providers };
});

export const createInfraConfigVersion = form(
	z.object({
		config_key: z.string().min(1, 'Config key is required'),
		previous_id: z.string().optional(),
		display_name: z.string().min(1, 'Display name is required'),
		model_id: z.string().min(1, 'Model id is required'),
		service_type: z.string().min(1),
		description: z.string().optional(),
		provider: z.string().min(1, 'Provider is required')
	}),
	async ({ previous_id, ...data }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;

		const previous = previous_id
			? ((await db.select().from(aiAgentModels).where(eq(aiAgentModels.id, previous_id)))[0] ??
				null)
			: null;

		if (previous && previous.configKey !== data.config_key) {
			return { success: false, error: 'Previous config_key does not match' };
		}

		try {
			const staleActiveVersions = await db
				.select()
				.from(aiAgentModels)
				.where(and(eq(aiAgentModels.configKey, data.config_key), eq(aiAgentModels.isActive, true)));

			for (const record of staleActiveVersions) {
				await db
					.update(aiAgentModels)
					.set({ isActive: false, updated: new Date().toISOString() })
					.where(eq(aiAgentModels.id, record.id));
			}

			try {
				const now = new Date().toISOString();
				const newId = generateId();
				await db.insert(aiAgentModels).values({
					id: newId,
					configKey: data.config_key,
					displayName: data.display_name,
					modelId: data.model_id,
					serviceType: data.service_type,
					description: data.description,
					provider: data.provider,
					isActive: true,
					isEnabled: false,
					...(previous?.currentPricing ? { currentPricing: previous.currentPricing } : {}),
					created: now,
					updated: now
				});

				const [record] = await db.select().from(aiAgentModels).where(eq(aiAgentModels.id, newId));
				void getInfraAdminData().refresh();
				return { success: true, record };
			} catch (error) {
				for (const record of staleActiveVersions) {
					await db
						.update(aiAgentModels)
						.set({ isActive: true, updated: new Date().toISOString() })
						.where(eq(aiAgentModels.id, record.id));
				}
				throw error;
			}
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}
);

export const createPromptVersion = form(
	z.object({
		prompt_key: z.string().min(1, 'Prompt key is required'),
		previous_id: z.string().optional(),
		display_name: z.string().min(1, 'Display name is required'),
		description: z.string().optional(),
		prompt_template: z.string().min(1, 'Prompt template is required'),
		change_notes: z.string().optional()
	}),
	async ({ previous_id, ...data }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;

		const previous = previous_id
			? ((await db.select().from(aiPrompts).where(eq(aiPrompts.id, previous_id)))[0] ?? null)
			: null;

		if (previous && previous.promptKey !== data.prompt_key) {
			return { success: false, error: 'Previous prompt_key does not match' };
		}

		try {
			const versions = await db
				.select()
				.from(aiPrompts)
				.where(eq(aiPrompts.promptKey, data.prompt_key))
				.orderBy(desc(aiPrompts.version), desc(aiPrompts.created));

			const nextVersion = versions.reduce((max, v) => Math.max(max, v.version ?? 0), 0) + 1;

			const now = new Date().toISOString();
			const newId = generateId();
			await db.insert(aiPrompts).values({
				id: newId,
				promptKey: data.prompt_key,
				displayName: data.display_name,
				description: data.description ?? previous?.description ?? undefined,
				promptTemplate: data.prompt_template,
				category: previous?.category ?? 'system',
				isActive: true,
				version: nextVersion,
				changeNotes: data.change_notes ?? undefined,
				created: now,
				updated: now
			});

			for (const version of versions) {
				if (!version.isActive || version.id === newId) continue;
				await db
					.update(aiPrompts)
					.set({ isActive: false, updated: now })
					.where(eq(aiPrompts.id, version.id));
			}

			const [record] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, newId));
			void getInfraAdminData().refresh();
			return { success: true, record };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}
);

export const rollbackPromptVersion = form(
	z.object({
		source_id: z.string().min(1, 'Source version ID is required'),
		prompt_key: z.string().min(1, 'Prompt key is required'),
		change_notes: z.string().optional()
	}),
	async ({ source_id, prompt_key, change_notes }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;

		try {
			const [source] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, source_id));
			if (!source) return { success: false, error: 'Source version not found' };

			if (source.promptKey !== prompt_key) {
				return { success: false, error: 'Source prompt_key does not match' };
			}

			const versions = await db
				.select()
				.from(aiPrompts)
				.where(eq(aiPrompts.promptKey, prompt_key))
				.orderBy(desc(aiPrompts.version), desc(aiPrompts.created));

			const nextVersion = Math.max(source.version ?? 0, ...versions.map((v) => v.version ?? 0)) + 1;

			const now = new Date().toISOString();
			const newId = generateId();
			await db.insert(aiPrompts).values({
				id: newId,
				promptKey: prompt_key,
				displayName: source.displayName,
				description: source.description ?? undefined,
				promptTemplate: source.promptTemplate,
				category: source.category ?? 'system',
				isActive: true,
				version: nextVersion,
				changeNotes: change_notes || `Rolled back to v${source.version ?? '?'}`,
				created: now,
				updated: now
			});

			for (const version of versions) {
				if (!version.isActive || version.id === newId) continue;
				await db
					.update(aiPrompts)
					.set({ isActive: false, updated: now })
					.where(eq(aiPrompts.id, version.id));
			}

			const [record] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, newId));
			void getInfraAdminData().refresh();
			return { success: true, record };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}
);
