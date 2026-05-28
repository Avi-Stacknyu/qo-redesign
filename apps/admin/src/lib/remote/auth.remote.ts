import { form, getRequestEvent, query } from '$app/server';
import { env as PrivEnv } from '$env/dynamic/private';
import { buildAuthOptions, getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { redirect } from '@sveltejs/kit';
import { coreRolePermissions } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import z from 'zod/v4';

const loginFormSchema = z.object({
	email: z.email(),
	password: z.string().min(8, { message: 'Password must be at least 8 characters long' })
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function authAndDb() {
	const { platform, url } = getRequestEvent();
	const { db } = await getDb(platform!);
	return {
		auth: getAuth(db, buildAuthOptions(url.origin, PrivEnv, platform?.env)),
		db
	};
}

/**
 * Forward Set-Cookie headers from a Better Auth Response to SvelteKit cookies.
 */
function forwardAuthCookies(response: Response) {
	const event = getRequestEvent();
	type CookieOptions = NonNullable<Parameters<typeof event.cookies.set>[2]>;
	for (const raw of response.headers.getSetCookie()) {
		const parts = raw.split(';');
		const [head, ...attrs] = parts;
		const eqIdx = head.indexOf('=');
		if (eqIdx < 0) continue;
		const name = head.slice(0, eqIdx).trim();
		const value = head.slice(eqIdx + 1).trim();

		const opts: CookieOptions = { path: '/' };
		for (const attr of attrs) {
			const t = attr.trim();
			const tl = t.toLowerCase();
			if (tl === 'httponly') opts.httpOnly = true;
			else if (tl === 'secure') opts.secure = true;
			else if (tl.startsWith('max-age=')) opts.maxAge = parseInt(tl.split('=')[1]);
			else if (tl.startsWith('samesite=')) {
				const sameSite = t.split('=')[1].toLowerCase();
				if (sameSite === 'lax' || sameSite === 'strict' || sameSite === 'none') {
					opts.sameSite = sameSite;
				}
			} else if (tl.startsWith('path=')) opts.path = t.split('=')[1];
		}
		event.cookies.set(name, decodeURIComponent(value), opts);
	}
}

// ── Forms ────────────────────────────────────────────────────────────────────

export const signIn = form(loginFormSchema, async ({ email, password }) => {
	try {
		const event = getRequestEvent();
		const { auth, db } = await authAndDb();
		const response = await auth.api.signInEmail({
			body: { email, password },
			asResponse: true,
			headers: event.request.headers
		});

		if (!response.ok) {
			return {
				success: false,
				message: 'Invalid email or password. Please try again.'
			};
		}

		const data = (await response.json()) as { user?: Record<string, unknown> };

		if (!data.user) {
			return {
				success: false,
				message: 'Invalid email or password. Please try again.'
			};
		}

		// Check admin role
		const user = data.user as Record<string, unknown>;
		const roleId = user.role as string | null;

		if (roleId) {
			const [role] = await db
				.select({ entityType: coreRolePermissions.entityType })
				.from(coreRolePermissions)
				.where(eq(coreRolePermissions.id, roleId))
				.limit(1);

			if (
				role?.entityType !== 'root' &&
				role?.entityType !== 'staff' &&
				role?.entityType !== 'admin'
			) {
				return {
					success: false,
					message: 'Access denied. Admins/Staff only.'
				};
			}
		} else {
			return {
				success: false,
				message: 'Access denied. Admins/Staff only.'
			};
		}

		// Forward session cookies from Better Auth to the browser
		forwardAuthCookies(response);

		redirect(303, '/');
	} catch (error: unknown) {
		if (error && typeof error === 'object' && 'status' in error) {
			const statusError = error as { status: number };
			if (statusError.status === 303 || statusError.status === 307) throw error;
		}
		console.error('Error during sign-in:', error);
		return {
			success: false,
			message: 'Invalid email or password. Please try again.'
		};
	}
});

export const oauth2SignIn = form(z.object({ provider: z.string() }), async ({ provider }) => {
	const { url } = getRequestEvent();
	const callbackURL = `${url.origin}/`;
	const authURL = `${url.origin}/api/auth/sign-in/social?provider=${encodeURIComponent(provider)}&callbackURL=${encodeURIComponent(callbackURL)}`;
	throw redirect(303, authURL);
});

export const loadAuthMethods = query(async () => {
	const { auth } = await authAndDb();
	const enabledOAuth: string[] = [];
	const providers = ['google', 'apple', 'microsoft'] as const;
	for (const p of providers) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((auth.options?.socialProviders as any)?.[p]) enabledOAuth.push(p);
	}
	return {
		email: true,
		oauth2: enabledOAuth.length > 0 ? enabledOAuth : null
	};
});
