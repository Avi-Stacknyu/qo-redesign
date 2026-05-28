import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { userFamilyOfficeMembers } from '@repo/db/schema';
import { eq, asc } from 'drizzle-orm';
import z from 'zod/v4';

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

/** Load all family members for current user */
export const getFamilyMembers = query(async () => {
	const { db, userId } = getDbAndUser();

	return db
		.select()
		.from(userFamilyOfficeMembers)
		.where(eq(userFamilyOfficeMembers.user, userId))
		.orderBy(asc(userFamilyOfficeMembers.created));
});

const createMemberSchema = z.object({
	name: z.string().min(1),
	role: z.string().optional(),
	email: z.string().email().optional().or(z.literal('')),
	responsibilities: z.array(z.string()).default([]),
	parent_id: z.string().optional()
});

/** Add a new family member */
export const addFamilyMember = command(createMemberSchema, async (data) => {
	const { db, userId } = getDbAndUser();
	const now = new Date().toISOString();

	const [result] = await db
		.insert(userFamilyOfficeMembers)
		.values({
			id: generateId(),
			user: userId,
			name: data.name,
			role: data.role ?? '',
			email: data.email ?? '',
			responsibilities: data.responsibilities,
			parentId: data.parent_id ?? '',
			created: now,
			updated: now
		})
		.returning();

	return result;
});

const updateMemberSchema = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	role: z.string().optional(),
	email: z.string().email().optional().or(z.literal('')),
	responsibilities: z.array(z.string()).optional(),
	parent_id: z.string().optional()
});

/** Update an existing family member */
export const updateFamilyMember = command(updateMemberSchema, async (data) => {
	const { db, userId } = getDbAndUser();

	const updates: Partial<typeof userFamilyOfficeMembers.$inferInsert> = {
		updated: new Date().toISOString()
	};
	if (data.name !== undefined) updates.name = data.name;
	if (data.role !== undefined) updates.role = data.role;
	if (data.email !== undefined) updates.email = data.email;
	if (data.responsibilities !== undefined) updates.responsibilities = data.responsibilities;
	if (data.parent_id !== undefined) updates.parentId = data.parent_id;

	const [result] = await db
		.update(userFamilyOfficeMembers)
		.set(updates)
		.where(eq(userFamilyOfficeMembers.id, data.id))
		.returning();

	return result;
});

const updatePositionSchema = z.object({
	id: z.string(),
	position_x: z.number(),
	position_y: z.number()
});

/** Save node position after drag */
export const updateMemberPosition = command(updatePositionSchema, async (data) => {
	const { db } = getDbAndUser();

	const [result] = await db
		.update(userFamilyOfficeMembers)
		.set({
			positionX: String(data.position_x),
			positionY: String(data.position_y),
			updated: new Date().toISOString()
		})
		.where(eq(userFamilyOfficeMembers.id, data.id))
		.returning();

	return result;
});

const deleteMemberSchema = z.object({ id: z.string() });

/** Delete a family member */
export const deleteFamilyMember = command(deleteMemberSchema, async (data) => {
	const { db } = getDbAndUser();

	await db
		.delete(userFamilyOfficeMembers)
		.where(eq(userFamilyOfficeMembers.id, data.id));

	return { deleted: true };
});
