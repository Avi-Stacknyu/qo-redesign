import { configProfileSchema } from '@repo/db/schema';
import type { Database } from '@repo/db/types';
import { eq } from 'drizzle-orm';

export async function activateGlobalSchemaVersion(db: Database, id: string, now: string) {
	const existing = await db.query.configProfileSchema.findFirst({
		where: eq(configProfileSchema.id, id)
	});

	if (!existing) {
		return { success: false, error: 'Schema version not found' };
	}

	await db.transaction(async (tx) => {
		await tx.update(configProfileSchema).set({ isActive: false, updated: now });
		await tx
			.update(configProfileSchema)
			.set({ isActive: true, updated: now })
			.where(eq(configProfileSchema.id, id));
	});

	return { success: true };
}

export async function deleteInactiveGlobalSchemaVersion(db: Database, id: string) {
	const existing = await db.query.configProfileSchema.findFirst({
		where: eq(configProfileSchema.id, id)
	});

	if (!existing) {
		return { success: false, error: 'Schema version not found' };
	}

	if (existing.isActive) {
		return { success: false, error: 'Cannot delete the active schema version' };
	}

	await db.delete(configProfileSchema).where(eq(configProfileSchema.id, id));
	return { success: true };
}
