/**
 * Todo remote — CRUD operations for user_todos.
 * Used by TodoWidget for self-loading + inline mutations.
 */

import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { userTodos } from '@repo/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import z from 'zod/v4';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const loadTodos = query(async () => {
	const { db, userId } = getDbAndUser();

	return db
		.select()
		.from(userTodos)
		.where(eq(userTodos.user, userId))
		.orderBy(desc(userTodos.created));
});

// ── Commands ─────────────────────────────────────────────────────────────────

const createTodoSchema = z.object({
	task: z.string().min(1),
	description: z.string().optional(),
	priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
	due_date: z.string().optional(),
	category: z.string().optional()
});

export const createTodo = command(createTodoSchema, async (data) => {
	const { db, userId } = getDbAndUser();
	const now = new Date().toISOString();

	const [result] = await db
		.insert(userTodos)
		.values({
			id: generateId(),
			user: userId,
			status: 'pending',
			task: data.task,
			description: data.description ?? null,
			priority: data.priority,
			dueDate: data.due_date ?? null,
			category: data.category ?? null,
			created: now,
			updated: now
		})
		.returning();

	loadTodos().refresh();
	return result;
});

const updateTodoSchema = z.object({
	todoId: z.string().min(1),
	task: z.string().min(1).optional(),
	description: z.string().optional(),
	priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
	due_date: z.string().optional(),
	category: z.string().optional()
});

export const updateTodo = command(updateTodoSchema, async (data) => {
	const { db, userId } = getDbAndUser();

	const updates: Partial<typeof userTodos.$inferInsert> = { updated: new Date().toISOString() };
	if (data.task !== undefined) updates.task = data.task;
	if (data.description !== undefined) updates.description = data.description;
	if (data.priority !== undefined) updates.priority = data.priority;
	if (data.due_date !== undefined) updates.dueDate = data.due_date;
	if (data.category !== undefined) updates.category = data.category;

	const [result] = await db
		.update(userTodos)
		.set(updates)
		.where(and(eq(userTodos.id, data.todoId), eq(userTodos.user, userId)))
		.returning();

	loadTodos().refresh();
	return result;
});

const toggleTodoSchema = z.object({
	todoId: z.string().min(1),
	status: z.enum(['completed', 'pending', 'in_progress', 'cancelled'])
});

export const toggleTodoStatus = command(toggleTodoSchema, async (data) => {
	const { db, userId } = getDbAndUser();

	const [result] = await db
		.update(userTodos)
		.set({ status: data.status, updated: new Date().toISOString() })
		.where(and(eq(userTodos.id, data.todoId), eq(userTodos.user, userId)))
		.returning();

	loadTodos().refresh();
	return result;
});

const deleteTodoSchema = z.object({
	todoId: z.string().min(1)
});

export const deleteTodo = command(deleteTodoSchema, async (data) => {
	const { db, userId } = getDbAndUser();

	await db.delete(userTodos).where(and(eq(userTodos.id, data.todoId), eq(userTodos.user, userId)));

	loadTodos().refresh();
	return { deleted: true };
});
