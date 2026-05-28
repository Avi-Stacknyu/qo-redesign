import { getRequestEvent, query, command } from '$app/server';
import { configProfileSchema } from '@repo/db/schema';
import { desc, eq } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { z } from 'zod/v4';
import {
	activateGlobalSchemaVersion,
	deleteInactiveGlobalSchemaVersion
} from './global-schema-operations';

export const getGlobalSchemas = query(async () => {
	const { locals } = getRequestEvent();
	return await locals.db
		.select()
		.from(configProfileSchema)
		.orderBy(desc(configProfileSchema.created));
});

const fieldSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	type: z.enum(['text', 'number', 'date', 'list']),
	description: z.string().optional().default('')
});

const sectionSchema = z.object({
	section_id: z.string().min(1),
	label: z.string().min(1),
	icon: z.string().optional().default('user'),
	order: z.number().int().min(0),
	fields: z.array(fieldSchema)
});

const saveSchemaInput = z.object({
	id: z.string().optional(),
	name: z.string().min(1, 'Name is required'),
	description: z.string().optional().default(''),
	schema: z.array(sectionSchema),
	version: z.string().optional()
});

export const saveGlobalSchema = command(saveSchemaInput, async (data) => {
	const { locals } = getRequestEvent();
	const now = new Date().toISOString();

	try {
		if (data.id) {
			await locals.db
				.update(configProfileSchema)
				.set({
					name: data.name,
					description: data.description,
					schema: data.schema,
					updated: now
				})
				.where(eq(configProfileSchema.id, data.id));
			void getGlobalSchemas().refresh();
			return { success: true, id: data.id };
		}

		// New schema: deactivate all existing, then insert as active (atomic)
		const newId = generateId();
		const nextVersion = String(Number(data.version || '0') + 1);
		await locals.db.transaction(async (tx) => {
			await tx.update(configProfileSchema).set({ isActive: false, updated: now });
			await tx.insert(configProfileSchema).values({
				id: newId,
				name: data.name,
				description: data.description,
				schema: data.schema,
				version: nextVersion,
				isActive: true,
				created: now,
				updated: now
			});
		});
		void getGlobalSchemas().refresh();
		return { success: true, id: newId };
	} catch (e) {
		return { success: false, error: (e as Error).message };
	}
});

export const activateGlobalSchema = command(z.string().min(1), async (id) => {
	const { locals } = getRequestEvent();
	const result = await activateGlobalSchemaVersion(locals.db, id, new Date().toISOString());
	void getGlobalSchemas().refresh();
	return result;
});

export const deleteGlobalSchema = command(z.string().min(1), async (id) => {
	const { locals } = getRequestEvent();
	const result = await deleteInactiveGlobalSchemaVersion(locals.db, id);
	void getGlobalSchemas().refresh();
	return result;
});
