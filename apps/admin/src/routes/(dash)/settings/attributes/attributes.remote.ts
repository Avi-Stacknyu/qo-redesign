import { getRequestEvent, query, command, form } from '$app/server';
import z from 'zod/v4';
import { configDynamicAttributes } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@repo/db/id';

// ============================================================================
// Types
// ============================================================================

export type AttributeCategory = 'identity' | 'preference' | 'contextual' | 'derived';
export type AttributeUsage = 'prompt_injection' | 'notifications' | 'compliance' | 'analytics';
export type SourceType = 'cf_header' | 'user_fact' | 'client_provided' | 'explicit' | 'derived';
export type DataType = 'string' | 'number' | 'boolean' | 'array' | 'date';
export type AttributeRow = typeof configDynamicAttributes.$inferSelect;

// ============================================================================
// Zod Schemas
// ============================================================================

const categorySchema = z.enum(['identity', 'preference', 'contextual', 'derived']);
const usageSchema = z.enum(['prompt_injection', 'notifications', 'compliance', 'analytics']);
const sourceTypeSchema = z.enum([
	'cf_header',
	'user_fact',
	'client_provided',
	'explicit',
	'derived'
]);
const dataTypeSchema = z.enum(['string', 'number', 'boolean', 'array', 'date']);

const saveAttributeSchema = z.object({
	id: z.string().optional(),
	attribute_key: z.string().min(1),
	display_name: z.string().min(1),
	description: z.string().optional(),
	category: categorySchema,
	allowed_usages: z.string(), // JSON-serialized array
	source_type: sourceTypeSchema,
	source_config: z.string(), // JSON-serialized record
	data_type: dataTypeSchema,
	is_required_for_agents: z
		.union([z.boolean(), z.string()])
		.transform((v) => v === true || v === 'true'),
	is_active: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === 'true')
});

// ============================================================================
// Queries
// ============================================================================

export const getAttributesData = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const attributes = await db
		.select()
		.from(configDynamicAttributes)
		.orderBy(configDynamicAttributes.category, configDynamicAttributes.displayName);

	return { attributes };
});

// ============================================================================
// Forms
// ============================================================================

function parseJson(input: string | undefined) {
	if (!input || input.trim() === '') return null;
	try {
		return JSON.parse(input);
	} catch {
		return null;
	}
}

export const saveAttribute = form('unchecked', async (rawData) => {
	const { locals } = getRequestEvent();
	const data = saveAttributeSchema.parse(rawData);
	const { id, ...rest } = data;
	const now = new Date().toISOString();

	try {
		const allowedUsages = parseJson(rest.allowed_usages) ?? [];
		const sourceConfig = parseJson(rest.source_config) ?? {};

		const payload = {
			attributeKey: rest.attribute_key,
			displayName: rest.display_name,
			description: rest.description ?? null,
			category: rest.category,
			allowedUsages: allowedUsages,
			sourceType: rest.source_type,
			sourceConfig: sourceConfig,
			dataType: rest.data_type,
			isRequiredForAgents: rest.is_required_for_agents,
			isActive: rest.is_active,
			updated: now
		};

		if (id) {
			await locals.db
				.update(configDynamicAttributes)
				.set(payload)
				.where(eq(configDynamicAttributes.id, id));
		} else {
			await locals.db.insert(configDynamicAttributes).values({
				id: generateId(),
				...payload,
				created: now
			});
		}

		void getAttributesData().refresh();
		return { success: true };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

// ============================================================================
// Commands
// ============================================================================

export const toggleAttribute = command(
	z.object({ id: z.string(), is_active: z.boolean() }),
	async ({ id, is_active }) => {
		const { locals } = getRequestEvent();
		await locals.db
			.update(configDynamicAttributes)
			.set({ isActive: is_active, updated: new Date().toISOString() })
			.where(eq(configDynamicAttributes.id, id));
		void getAttributesData().refresh();
		return { success: true };
	}
);

export const deleteAttributeAction = command(z.object({ id: z.string() }), async ({ id }) => {
	const { locals } = getRequestEvent();
	await locals.db.delete(configDynamicAttributes).where(eq(configDynamicAttributes.id, id));
	void getAttributesData().refresh();
	return { success: true };
});
