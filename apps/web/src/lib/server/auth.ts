import { createAuth, type Auth, type AuthEmailPayload, type CreateAuthOpts } from '@repo/db/auth';
import type { Database } from '@repo/db/client';

type AuthEnv = Record<string, string | undefined> & {
	BETTER_AUTH_SECRET?: string;
	AUTH_FROM_EMAIL?: string;
	AUTH_FROM_NAME?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	APPLE_CLIENT_ID?: string;
	APPLE_CLIENT_SECRET?: string;
	MICROSOFT_CLIENT_ID?: string;
	MICROSOFT_CLIENT_SECRET?: string;
};

type EmailBinding = {
	send(message: {
		from: string | { name: string; email: string };
		to: string | string[];
		subject: string;
		text?: string;
		html?: string;
		headers?: Record<string, string>;
	}): Promise<unknown>;
};

type WorkerEnv = {
	SEND_EMAIL?: EmailBinding;
};

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function buildSendEmailProvider(env: AuthEnv, workerEnv?: WorkerEnv) {
	const binding = workerEnv?.SEND_EMAIL;
	if (!binding) return undefined;

	const fromEmail = env.AUTH_FROM_EMAIL || 'noreply@stacknyu.tech';
	const fromName = env.AUTH_FROM_NAME || 'Quant Orion';

	return async (payload: AuthEmailPayload) => {
		await binding.send({
			from: { name: fromName, email: fromEmail },
			to: payload.to.email,
			subject: payload.subject,
			text: payload.text || stripHtml(payload.html),
			html: payload.html
		});
	};
}

export function buildAuthOptions(
	origin: string,
	env: AuthEnv,
	workerEnv?: WorkerEnv
): CreateAuthOpts {
	return {
		baseURL: origin,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: ['*'],
		sendEmail: buildSendEmailProvider(env, workerEnv),
		google:
			env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
				? {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET
					}
				: undefined,
		apple:
			env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
				? {
						clientId: env.APPLE_CLIENT_ID,
						clientSecret: env.APPLE_CLIENT_SECRET
					}
				: undefined,
		microsoft:
			env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET
				? {
						clientId: env.MICROSOFT_CLIENT_ID,
						clientSecret: env.MICROSOFT_CLIENT_SECRET
					}
				: undefined
	};
}

export function getAuth(db: Database, opts?: CreateAuthOpts): Auth {
	return createAuth(db, {
		trustedOrigins: ['*'],
		...opts
	});
}
