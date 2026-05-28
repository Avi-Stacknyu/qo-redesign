/**
 * Reminder Scheduler
 *
 * Handles scheduled reminder checks and email notifications using Cloudflare Cron Triggers.
 * This is a cost-effective alternative to Durable Objects for time-based scheduling.
 *
 * Usage:
 * - Cron trigger calls `scheduledHandler` every minute
 * - HTTP endpoints available for testing: /reminders/check, /reminders/test-email
 */

import { getDb } from '../lib/db';
import { userReminders, users } from '@repo/db/schema';
import { eq, asc } from 'drizzle-orm';
import { EmailService } from './email-service';
import type { Env } from '../types';
import { createLogger, formatError } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

type ReminderEnv = Env;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check for reminders that need to be sent
 */
async function checkReminders(env: ReminderEnv): Promise<{ checked: number; sent: number }> {
	const stats = { checked: 0, sent: 0 };

	try {
		const db = await getDb(env);
		if (!env.SEND_EMAIL) {
			const log = createLogger('ReminderScheduler');
			log.error('missing_send_email_binding');
			return stats;
		}
		const emailService = new EmailService(
			env.SEND_EMAIL,
			env.AUTH_FROM_EMAIL || 'quant-orion-reminders@stacknyu.tech',
			env.AUTH_FROM_NAME || 'Quant Orion Reminders'
		);
		const now = new Date();

		// Find unsent reminders with user data
		const reminders = await db
			.select({
				reminder: userReminders,
				user: {
					id: users.id,
					email: users.email,
					name: users.name
				}
			})
			.from(userReminders)
			.leftJoin(users, eq(userReminders.user, users.id))
			.where(eq(userReminders.sent, false))
			.orderBy(asc(userReminders.reminderDatetime));

		stats.checked = reminders.length;
		const log = createLogger('ReminderScheduler');
		log.info('checking_reminders', { count: reminders.length });

		for (const { reminder, user } of reminders) {
			const reminderDate = new Date(reminder.reminderDatetime!);
			const minutesBefore = Number(reminder.notificationMinutesBefore) || 0;
			const notificationDate = new Date(reminderDate.getTime() - minutesBefore * 60000);

			// Send if notification time has passed (including overdue reminders)
			const shouldSend = now >= notificationDate;

			if (shouldSend) {
				if (!user || !user.email) {
					log.error('missing_user_email', { reminderId: reminder.id });
					continue;
				}

				log.info('sending_reminder', { title: reminder.title, reminderId: reminder.id });

				const emailSent = await emailService.sendReminderNotification(
					user.email,
					user.name || 'User',
					reminder.title!,
					reminder.description ?? undefined,
					reminder.reminderDatetime!,
					minutesBefore
				);

				if (emailSent) {
					await db
						.update(userReminders)
						.set({
							sent: true,
							updated: new Date().toISOString()
						})
						.where(eq(userReminders.id, reminder.id));
					stats.sent++;
					log.info('reminder_sent', { reminderId: reminder.id });
				} else {
					log.error('reminder_send_failed', { reminderId: reminder.id });
				}
			}
		}

		return stats;
	} catch (error) {
		const log = createLogger('ReminderScheduler');
		log.error('check_reminders_failed', { ...formatError(error) });
		throw error;
	}
}

// ============================================================================
// Scheduled Handler (Cron Trigger)
// ============================================================================

/**
 * Called by Cloudflare Cron Triggers
 * Configure in wrangler.jsonc: [triggers] crons = ["* * * * *"]
 */
export async function scheduledHandler(
	_event: ScheduledEvent,
	env: ReminderEnv,
	ctx: ExecutionContext
): Promise<void> {
	const log = createLogger('ReminderScheduler');
	log.info('cron_trigger', { time: new Date().toISOString() });
	ctx.waitUntil(checkReminders(env));
}
