import { query, form, getRequestEvent } from '$app/server';
import z from 'zod/v4';
import {
	aiPricingRates,
	creditExchangeRates,
	aiAgentModels,
	aiTools,
	aiProviders
} from '@repo/db/schema';
import { generateId } from '@repo/db/id';
import { desc, eq, ne } from 'drizzle-orm';

function todayDateString() {
	return new Date().toISOString().slice(0, 10);
}

const optionalNumberFromForm = z
	.union([z.number(), z.string()])
	.optional()
	.transform((value) => {
		if (value === undefined || value === '') return undefined;
		const n = typeof value === 'string' ? Number(value) : value;
		return Number.isFinite(n) ? n : undefined;
	})
	.pipe(z.number().optional());

const numberFromForm = z
	.union([z.number(), z.string()])
	.transform((value) => (typeof value === 'string' ? Number(value) : value));

export const getPricingAdminData = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const [rates, exchRates, modelsWithJoins, toolsWithJoins, configsWithJoins] = await Promise.all([
		db.select().from(aiPricingRates).orderBy(desc(aiPricingRates.created)),
		db.select().from(creditExchangeRates).orderBy(desc(creditExchangeRates.created)),
		db
			.select({
				model: aiAgentModels,
				provider: aiProviders,
				pricing: aiPricingRates
			})
			.from(aiAgentModels)
			.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
			.leftJoin(aiPricingRates, eq(aiAgentModels.currentPricing, aiPricingRates.id))
			.where(eq(aiAgentModels.configKey, ''))
			.orderBy(aiAgentModels.displayName),
		db
			.select({
				tool: aiTools,
				pricing: aiPricingRates
			})
			.from(aiTools)
			.leftJoin(aiPricingRates, eq(aiTools.currentPricing, aiPricingRates.id))
			.orderBy(aiTools.displayName),
		db
			.select({
				model: aiAgentModels,
				provider: aiProviders,
				pricing: aiPricingRates
			})
			.from(aiAgentModels)
			.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
			.leftJoin(aiPricingRates, eq(aiAgentModels.currentPricing, aiPricingRates.id))
			.where(ne(aiAgentModels.configKey, ''))
			.orderBy(aiAgentModels.serviceType, aiAgentModels.displayName)
	]);

	// Shape models to include expanded provider + current_pricing
	const models = modelsWithJoins.map((r) => ({
		...r.model,
		expand: {
			...(r.provider ? { provider: r.provider } : {}),
			...(r.pricing ? { current_pricing: r.pricing } : {})
		}
	}));

	const tools = toolsWithJoins.map((r) => ({
		...r.tool,
		expand: {
			...(r.pricing ? { current_pricing: r.pricing } : {})
		}
	}));

	const configs = configsWithJoins.map((r) => ({
		...r.model,
		expand: {
			...(r.provider ? { provider: r.provider } : {}),
			...(r.pricing ? { current_pricing: r.pricing } : {})
		}
	}));

	return {
		rates,
		exchangeRates: exchRates,
		models,
		tools,
		configs
	};
});

const pricingFieldsSchema = z.object({
	tier: z.enum(['standard', 'batch', 'flex', 'priority']).optional(),
	input_price_per_1m: optionalNumberFromForm,
	output_price_per_1m: optionalNumberFromForm,
	cached_input_price_per_1m: optionalNumberFromForm,
	reasoning_price_per_1m: optionalNumberFromForm,
	price_per_call: optionalNumberFromForm,
	price_per_image: optionalNumberFromForm,
	price_per_second: optionalNumberFromForm,
	price_per_minute: optionalNumberFromForm,
	price_per_character: optionalNumberFromForm,
	notes: z.string().optional()
});

const pricingInputSchema = pricingFieldsSchema.refine(
	(v) =>
		v.input_price_per_1m !== undefined ||
		v.output_price_per_1m !== undefined ||
		v.price_per_call !== undefined ||
		v.price_per_image !== undefined ||
		v.price_per_second !== undefined ||
		v.price_per_minute !== undefined ||
		v.price_per_character !== undefined ||
		v.cached_input_price_per_1m !== undefined ||
		v.reasoning_price_per_1m !== undefined,
	{ message: 'Provide at least one price field' }
);

async function createPricingAndLink(
	target: { table: 'aiAgentModels' | 'aiTools'; id: string },
	data: z.infer<typeof pricingInputSchema>
): Promise<{ success: true; pricingId: string }> {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const now = new Date().toISOString();
	const pricingId = generateId();

	await db.insert(aiPricingRates).values({
		id: pricingId,
		tier: data.tier,
		inputPricePer1M: data.input_price_per_1m != null ? String(data.input_price_per_1m) : null,
		outputPricePer1M: data.output_price_per_1m != null ? String(data.output_price_per_1m) : null,
		cachedInputPricePer1M:
			data.cached_input_price_per_1m != null ? String(data.cached_input_price_per_1m) : null,
		reasoningPricePer1M:
			data.reasoning_price_per_1m != null ? String(data.reasoning_price_per_1m) : null,
		pricePerCall: data.price_per_call != null ? String(data.price_per_call) : null,
		pricePerImage: data.price_per_image != null ? String(data.price_per_image) : null,
		pricePerSecond: data.price_per_second != null ? String(data.price_per_second) : null,
		pricePerMinute: data.price_per_minute != null ? String(data.price_per_minute) : null,
		pricePerCharacter: data.price_per_character != null ? String(data.price_per_character) : null,
		notes: data.notes,
		effectiveFrom: todayDateString(),
		isActive: true,
		created: now,
		updated: now
	});

	if (target.table === 'aiAgentModels') {
		await db
			.update(aiAgentModels)
			.set({ currentPricing: pricingId, updated: now })
			.where(eq(aiAgentModels.id, target.id));
	} else {
		await db
			.update(aiTools)
			.set({ currentPricing: pricingId, updated: now })
			.where(eq(aiTools.id, target.id));
	}

	return { success: true, pricingId };
}

export const setModelPricing = form(
	z.object({
		modelId: z.string().min(1),
		...pricingFieldsSchema.shape
	}),
	async ({ modelId, ...pricing }) => {
		const parsed = pricingInputSchema.parse(pricing);
		const result = await createPricingAndLink({ table: 'aiAgentModels', id: modelId }, parsed);
		void getPricingAdminData().refresh();
		return result;
	}
);

export const setToolPricing = form(
	z.object({
		toolId: z.string().min(1),
		...pricingFieldsSchema.shape
	}),
	async ({ toolId, ...pricing }) => {
		const parsed = pricingInputSchema.parse(pricing);
		const result = await createPricingAndLink({ table: 'aiTools', id: toolId }, parsed);
		void getPricingAdminData().refresh();
		return result;
	}
);

export const setInfraConfigPricing = form(
	z.object({
		configId: z.string().min(1),
		...pricingFieldsSchema.shape
	}),
	async ({ configId, ...pricing }) => {
		const parsed = pricingInputSchema.parse(pricing);
		const result = await createPricingAndLink({ table: 'aiAgentModels', id: configId }, parsed);
		void getPricingAdminData().refresh();
		return result;
	}
);

// Versioned credit conversion: create a new record and deactivate the previous active.
export const createCreditExchangeRate = form(
	z.object({
		rate: numberFromForm.pipe(z.number().min(0)),
		effective_from: z.string().optional(),
		notes: z.string().optional()
	}),
	async (data) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const now = new Date().toISOString();

		const [existingActive] = await db
			.select({ id: creditExchangeRates.id })
			.from(creditExchangeRates)
			.where(eq(creditExchangeRates.isActive, true))
			.orderBy(desc(creditExchangeRates.created))
			.limit(1);

		await db.insert(creditExchangeRates).values({
			id: generateId(),
			rate: String(data.rate),
			effectiveFrom: data.effective_from ?? todayDateString(),
			notes: data.notes,
			isActive: true,
			created: now,
			updated: now
		});

		if (existingActive) {
			await db
				.update(creditExchangeRates)
				.set({ isActive: false, effectiveUntil: todayDateString(), updated: now })
				.where(eq(creditExchangeRates.id, existingActive.id));
		}

		void getPricingAdminData().refresh();
		return { success: true };
	}
);
