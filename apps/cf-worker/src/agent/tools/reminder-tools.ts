import { z } from 'zod';
import { tool } from 'ai';
import { userReminders } from '@repo/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { ValidationError } from '../../utils/errors';
import type { ToolContext } from './types';

export function createReminderTools(ctx: ToolContext) {
	return {
		create_reminder: tool({
			description:
				'Create a new reminder with title, datetime, optional description, and notification lead time.',
			inputSchema: z.object({
				title: z.string().describe('The reminder title'),
				reminder_datetime: z
					.string()
					.describe('The date and time for the reminder (ISO format, e.g., 2024-12-31T14:00:00Z)'),
				description: z.string().optional().describe('Optional reminder description'),
				notification_minutes_before: z
					.number()
					.min(0)
					.optional()
					.default(10)
					.describe('Minutes before the reminder to send notification (default: 10)')
			}),
			execute: async ({
				title,
				reminder_datetime,
				description,
				notification_minutes_before
			}: {
				title: string;
				reminder_datetime: string;
				description?: string;
				notification_minutes_before?: number;
			}) => {
				const now = new Date().toISOString();
				await ctx.db.insert(userReminders).values({
					id: generateId(),
					user: ctx.userId,
					title,
					description: description || undefined,
					reminderDatetime: reminder_datetime,
					notificationMinutesBefore: String(notification_minutes_before ?? 10),
					sent: false,
					includeInMemory: true,
					created: now,
					updated: now
				});
				return `Created reminder: "${title}" for ${new Date(reminder_datetime).toLocaleString()}`;
			}
		}),

		get_reminders: tool({
			description:
				'Retrieve all user reminders with their IDs. Returns reminder ID, title, datetime, and optional description.',
			inputSchema: z.object({
				include_past: z.boolean().optional().default(false).describe('Include past/sent reminders')
			}),
			execute: async ({ include_past }: { include_past?: boolean }) => {
				const conditions = [eq(userReminders.user, ctx.userId)];
				if (!include_past) {
					conditions.push(eq(userReminders.sent, false));
				}

				const reminders = await ctx.db
					.select()
					.from(userReminders)
					.where(and(...conditions))
					.orderBy(asc(userReminders.reminderDatetime))
					.limit(100);
				if (reminders.length === 0) return 'No reminders found';

				const remindersList = reminders.map((reminder) => {
					const datetime = reminder.reminderDatetime
						? new Date(reminder.reminderDatetime).toLocaleString()
						: 'Unknown';
					const title = reminder.title ?? 'Untitled reminder';
					const desc = reminder.description ? `\n  Description: "${reminder.description}"` : '';
					const notifyBefore = reminder.notificationMinutesBefore
						? `\n  Notify: ${Number(reminder.notificationMinutesBefore)} minutes before`
						: '';
					const sentStatus = reminder.sent ? ' [SENT]' : '';
					return `• ID: ${reminder.id}\n  Title: "${title}"${sentStatus}\n  When: ${datetime}${notifyBefore}${desc}`;
				});
				return `Found ${reminders.length} reminder(s):\n\n${remindersList.join('\n\n')}`;
			}
		}),

		update_reminder: tool({
			description:
				"Update an existing reminder's details. Use get_reminders first to get the reminder ID.",
			inputSchema: z.object({
				reminder_id: z
					.string()
					.describe('The ID of the reminder to update (get this from get_reminders tool)'),
				title: z.string().optional().describe('The new title for the reminder'),
				description: z.string().optional().describe('The new description for the reminder'),
				reminder_datetime: z.string().optional().describe('The new date and time (ISO format)'),
				notification_minutes_before: z
					.number()
					.min(0)
					.optional()
					.describe('Minutes before to notify')
			}),
			execute: async ({
				reminder_id,
				title,
				description,
				reminder_datetime,
				notification_minutes_before
			}: {
				reminder_id: string;
				title?: string;
				description?: string;
				reminder_datetime?: string;
				notification_minutes_before?: number;
			}) => {
				const reminder = await ctx.db.query.userReminders.findFirst({
					columns: { id: true },
					where: and(eq(userReminders.id, reminder_id), eq(userReminders.user, ctx.userId))
				});
				if (!reminder) throw new ValidationError('Reminder not found');

				const updateData: Record<string, unknown> = { updated: new Date().toISOString() };
				if (title !== undefined) updateData.title = title;
				if (description !== undefined) updateData.description = description;
				if (reminder_datetime !== undefined) updateData.reminderDatetime = reminder_datetime;
				if (notification_minutes_before !== undefined)
					updateData.notificationMinutesBefore = String(notification_minutes_before);

				await ctx.db.update(userReminders).set(updateData).where(eq(userReminders.id, reminder_id));
				return `Updated reminder`;
			}
		}),

		delete_reminder: tool({
			description: 'Delete a reminder. Use get_reminders first to get the reminder ID.',
			inputSchema: z.object({
				reminder_id: z
					.string()
					.describe('The ID of the reminder to delete (get this from get_reminders tool)')
			}),
			execute: async ({ reminder_id }: { reminder_id: string }) => {
				const reminder = await ctx.db.query.userReminders.findFirst({
					columns: { id: true },
					where: and(eq(userReminders.id, reminder_id), eq(userReminders.user, ctx.userId))
				});
				if (!reminder) throw new ValidationError('Reminder not found');
				await ctx.db.delete(userReminders).where(eq(userReminders.id, reminder_id));
				return `Deleted reminder`;
			}
		})
	};
}
