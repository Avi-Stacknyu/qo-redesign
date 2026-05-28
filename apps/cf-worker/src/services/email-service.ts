/**
 * Email Service
 * Handles sending reminder notifications via Cloudflare Email Routing bindings.
 */

import { EmailMessage } from 'cloudflare:email';
import { createLogger, formatError } from '../utils/logger';

interface SendEmailBinding {
	send(message: EmailMessage): Promise<unknown>;
}

interface WorkerEmailConfig {
	binding: SendEmailBinding;
	fromEmail: string;
	fromName: string;
}

interface EmailTemplate {
	subject: string;
	body: string;
}

export class EmailService {
	private config: WorkerEmailConfig;

	constructor(
		binding: SendEmailBinding,
		fromEmail: string = 'quant-orion-reminders@stacknyu.tech',
		fromName: string = 'Quant Orion Reminders'
	) {
		this.config = {
			binding,
			fromEmail,
			fromName
		};
	}

	private buildRawMimeEmail(
		toEmail: string,
		toName: string | undefined,
		template: EmailTemplate
	): string {
		const boundary = `cf-boundary-${crypto.randomUUID()}`;
		const plainText = template.body
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		const toHeader = toName ? `${toName} <${toEmail}>` : toEmail;

		return [
			`From: ${this.config.fromName} <${this.config.fromEmail}>`,
			`To: ${toHeader}`,
			`Subject: ${template.subject}`,
			`Date: ${new Date().toUTCString()}`,
			`Message-ID: <${crypto.randomUUID()}@quantpm.app>`,
			'MIME-Version: 1.0',
			`Content-Type: multipart/alternative; boundary="${boundary}"`,
			'',
			`--${boundary}`,
			'Content-Type: text/plain; charset=UTF-8',
			'Content-Transfer-Encoding: 7bit',
			'',
			plainText,
			'',
			`--${boundary}`,
			'Content-Type: text/html; charset=UTF-8',
			'Content-Transfer-Encoding: 7bit',
			'',
			template.body,
			'',
			`--${boundary}--`
		].join('\r\n');
	}

	/**
	 * Generate email template for reminder notification
	 */
	private generateReminderEmail(
		reminderTitle: string,
		reminderDescription: string | undefined,
		reminderDatetime: string,
		minutesBefore: number
	): EmailTemplate {
		const reminderDate = new Date(reminderDatetime);

		const dateStr = reminderDate.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
		const timeStr = reminderDate.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit'
		});

		const subject = `⏰ Reminder: ${reminderTitle}`;

		const body = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<style>
    @media only screen and (max-width: 620px) {
        .container { width: 100% !important; }
        .content { padding: 20px !important; }
        .col-stack { display: block !important; width: 100% !important; padding-bottom: 10px; }
    }
</style>
</head>
<body style="background-color: #f4f5f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body" style="background-color: #f4f5f7; width: 100%;">
        <tr>
            <td style="display: block; margin: 0 auto !important; max-width: 600px; padding: 10px; width: 600px;">
                <div style="height: 20px; line-height: 20px; font-size: 1px;">&nbsp;</div>
                <div class="container" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 6px solid #6366f1;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                        <tr>
                            <td class="content" style="padding: 40px 40px 20px 40px; text-align: center;">
                                <div style="display: inline-block; background-color: #e0e7ff; border-radius: 50%; padding: 15px; margin-bottom: 20px;">
                                    <span style="font-size: 32px; line-height: 1;">⏰</span>
                                </div>
                                <h1 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0; line-height: 1.2;">
                                    ${reminderTitle}
                                </h1>
                                ${
																	reminderDescription
																		? `<p style="color: #6b7280; font-size: 16px; margin-top: 10px; margin-bottom: 0;">${reminderDescription}</p>`
																		: ''
																}
                            </td>
                        </tr>
                    </table>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                        <tr>
                            <td style="padding: 0 40px 30px 40px;">
                                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                                        <tr>
                                            <td class="col-stack" style="vertical-align: middle; width: 50%;">
                                                <p style="margin: 0; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Date</p>
                                                <p style="margin: 5px 0 0 0; color: #1f2937; font-size: 18px; font-weight: 600;">${dateStr}</p>
                                            </td>
                                            <td class="col-stack" style="vertical-align: middle; width: 50%; border-left: 1px solid #e5e7eb; padding-left: 20px;">
                                                <p style="margin: 0; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Time</p>
                                                <p style="margin: 5px 0 0 0; color: #1f2937; font-size: 18px; font-weight: 600;">${timeStr}</p>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                                ${
																	minutesBefore > 0
																		? `
                                <div style="margin-top: 20px; background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px; text-align: center;">
                                    <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">
                                        🔔 You are being notified <strong>${minutesBefore} minutes</strong> in advance.
                                    </p>
                                </div>
                                `
																		: ''
																}
                            </td>
                        </tr>
                    </table>
                </div>
                <div style="padding-top: 20px; color: #9ca3af; font-size: 12px; text-align: center;">
                    <p style="margin: 0 0 10px 0;">Quant Orion &bull; Stay Organized</p>
                    <p style="margin: 0;">&copy; ${new Date().getFullYear()} Quant Orion. All rights reserved.</p>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

		return { subject, body };
	}

	/**
	 * Send reminder notification email via Cloudflare Email Routing
	 */
	async sendReminderNotification(
		toEmail: string,
		toName: string,
		reminderTitle: string,
		reminderDescription: string | undefined,
		reminderDatetime: string,
		minutesBefore: number
	): Promise<boolean> {
		const template = this.generateReminderEmail(
			reminderTitle,
			reminderDescription,
			reminderDatetime,
			minutesBefore
		);

		try {
			const raw = this.buildRawMimeEmail(toEmail, toName, template);
			const message = new EmailMessage(this.config.fromEmail, toEmail, raw);
			const result = await this.config.binding.send(message);
			const log = createLogger('EmailService');
			log.info('email_sent', { result });
			return true;
		} catch (error) {
			const log = createLogger('EmailService');
			log.error('send_failed', { ...formatError(error) });
			return false;
		}
	}

	/**
	 * Send test email to verify configuration
	 */
	async sendTestEmail(toEmail: string): Promise<boolean> {
		try {
			const template: EmailTemplate = {
				subject: 'Test Email from Quant Orion Reminders',
				body: '<h1>Test Email</h1><p>Your Cloudflare Email Routing integration is working correctly!</p>'
			};
			const raw = this.buildRawMimeEmail(toEmail, 'Test User', template);
			const message = new EmailMessage(this.config.fromEmail, toEmail, raw);
			await this.config.binding.send(message);
			return true;
		} catch (error) {
			const log = createLogger('EmailService');
			log.error('test_email_failed', { ...formatError(error) });
			return false;
		}
	}
}
