/**
 * Reminders remote — CRUD operations for user_reminders.
 * Used by RemindersWidget and CalendarWidget for self-loading + inline mutations.
 */

import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { userReminders } from '@repo/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import z from 'zod/v4';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const loadReminders = query(async () => {
	const { db, userId } = getDbAndUser();

	return db
		.select()
		.from(userReminders)
		.where(eq(userReminders.user, userId))
		.orderBy(asc(userReminders.reminderDatetime));
});

// ── Commands ─────────────────────────────────────────────────────────────────

const createReminderSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	reminder_datetime: z.string().min(1),
	recurring: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'none']).default('none'),
	category: z.string().optional()
});

export const createReminder = command(createReminderSchema, async (data) => {
	const { db, userId } = getDbAndUser();
	const now = new Date().toISOString();

	const [result] = await db
		.insert(userReminders)
		.values({
			id: generateId(),
			user: userId,
			isActive: true,
			sent: false,
			title: data.title,
			description: data.description ?? null,
			reminderDatetime: data.reminder_datetime,
			recurring: data.recurring,
			category: data.category ?? null,
			created: now,
			updated: now
		})
		.returning();

	loadReminders().refresh();
	return result;
});

const updateReminderSchema = z.object({
	reminderId: z.string().min(1),
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	reminder_datetime: z.string().optional(),
	recurring: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'none']).optional(),
	category: z.string().optional()
});

export const updateReminder = command(updateReminderSchema, async (data) => {
	const { db, userId } = getDbAndUser();

	const updates: Partial<typeof userReminders.$inferInsert> = { updated: new Date().toISOString() };
	if (data.title !== undefined) updates.title = data.title;
	if (data.description !== undefined) updates.description = data.description;
	if (data.reminder_datetime !== undefined) updates.reminderDatetime = data.reminder_datetime;
	if (data.recurring !== undefined) updates.recurring = data.recurring;
	if (data.category !== undefined) updates.category = data.category;

	const [result] = await db
		.update(userReminders)
		.set(updates)
		.where(and(eq(userReminders.id, data.reminderId), eq(userReminders.user, userId)))
		.returning();

	loadReminders().refresh();
	return result;
});

const toggleReminderSchema = z.object({
	reminderId: z.string().min(1),
	sent: z.boolean()
});

export const toggleReminderDone = command(toggleReminderSchema, async (data) => {
	const { db, userId } = getDbAndUser();

	const [result] = await db
		.update(userReminders)
		.set({ sent: data.sent, updated: new Date().toISOString() })
		.where(and(eq(userReminders.id, data.reminderId), eq(userReminders.user, userId)))
		.returning();

	loadReminders().refresh();
	return result;
});

const deleteReminderSchema = z.object({
	reminderId: z.string().min(1)
});

export const deleteReminder = command(deleteReminderSchema, async (data) => {
	const { db, userId } = getDbAndUser();

	await db
		.delete(userReminders)
		.where(and(eq(userReminders.id, data.reminderId), eq(userReminders.user, userId)));

	loadReminders().refresh();
	return { deleted: true };
});
