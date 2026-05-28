import { form, getRequestEvent, query } from '$app/server';
import { env as PrivEnv } from '$env/dynamic/private';
import { buildAuthOptions, getAuth } from '$lib/server/auth';
import { getSignInErrorMessage } from '$lib/server/auth-error-message';
import { getDb } from '$lib/server/db';
import { redirect } from '@sveltejs/kit';
import z from 'zod/v4';

// ── Schemas ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
	email: z.email('Invalid email address'),
	_password: z.string().min(8, 'Password must be at least 8 characters')
});

const registerSchema = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters'),
	email: z.email('Invalid email address'),
	_password: z.string().min(8, 'Password must be at least 8 characters'),
	_passwordConfirm: z.string().min(1, 'Please confirm your password')
});

const forgotPasswordSchema = z.object({
	email: z.email('Invalid email address')
});

const otpRequestSchema = z.object({
	email: z.email('Invalid email address')
});

const otpVerifySchema = z.object({
	email: z.string().min(1, 'Email is required'),
	otp: z.string().min(1, 'OTP code is required')
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function auth() {
	const { platform, url } = getRequestEvent();
	const { db } = await getDb(platform!);
	return getAuth(db, buildAuthOptions(url.origin, PrivEnv, platform?.env));
}

/**
 * Forward Set-Cookie headers from a Better Auth Response to SvelteKit cookies.
 */
function forwardAuthCookies(response: Response) {
	const event = getRequestEvent();
	for (const raw of response.headers.getSetCookie()) {
		const parts = raw.split(';');
		const [head, ...attrs] = parts;
		const eqIdx = head.indexOf('=');
		if (eqIdx < 0) continue;
		const name = head.slice(0, eqIdx).trim();
		const value = head.slice(eqIdx + 1).trim();

		const opts: Record<string, unknown> = { path: '/' };
		for (const attr of attrs) {
			const t = attr.trim();
			const tl = t.toLowerCase();
			if (tl === 'httponly') opts.httpOnly = true;
			else if (tl === 'secure') opts.secure = true;
			else if (tl.startsWith('max-age=')) opts.maxAge = parseInt(tl.split('=')[1]);
			else if (tl.startsWith('samesite=')) opts.sameSite = t.split('=')[1].toLowerCase();
			else if (tl.startsWith('path=')) opts.path = t.split('=')[1];
		}
		event.cookies.set(
			name,
			decodeURIComponent(value),
			opts as unknown as Parameters<typeof event.cookies.set>[2]
		);
	}
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const loadAuthMethods = query(async () => {
	const a = await auth();
	// Check which social providers are configured
	const enabledOAuth: string[] = [];
	const providers = ['google', 'apple', 'microsoft'] as const;
	for (const p of providers) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((a.options?.socialProviders as any)?.[p]) enabledOAuth.push(p);
	}
	return {
		email: true,
		otp: true,
		oauth2: enabledOAuth.length > 0 ? enabledOAuth : null
	};
});

// ── Forms ────────────────────────────────────────────────────────────────────

export const signIn = form(loginSchema, async ({ email, _password }) => {
	try {
		const event = getRequestEvent();
		const a = await auth();
		const response = await a.api.signInEmail({
			body: { email, password: _password },
			asResponse: true,
			headers: event.request.headers
		});
		const payload = (await response.json().catch(() => null)) as
			| { user?: { emailVerified?: boolean; onboardingComplete?: boolean | null } }
			| { code?: string; message?: string }
			| null;
		const errorPayload =
			payload && ('code' in payload || 'message' in payload)
				? { code: payload.code, message: payload.message }
				: null;
		const successPayload = payload && 'user' in payload ? payload : null;

		if (!response.ok) {
			return {
				success: false,
				message: getSignInErrorMessage(response.status, errorPayload)
			};
		}

		if (!successPayload?.user?.emailVerified) {
			return {
				success: false,
				message:
					'Please verify your email before signing in. Check your inbox for a verification link.'
			};
		}

		// Forward session cookies from Better Auth to the browser
		forwardAuthCookies(response);

		const user = successPayload.user as Record<string, unknown>;
		if (!user.onboardingComplete) {
			redirect(303, '/onboarding');
		}

		redirect(303, '/');
	} catch (error: unknown) {
		if (error && typeof error === 'object' && 'status' in error) {
			const statusError = error as { status: number };
			if (statusError.status === 303 || statusError.status === 307) throw error;
		}
		return {
			success: false,
			message: 'Unable to sign in right now. Please try again.'
		};
	}
});

export const signUp = form(registerSchema, async ({ name, email, _password, _passwordConfirm }) => {
	if (_password !== _passwordConfirm) {
		return {
			success: false,
			message: 'Passwords do not match.'
		};
	}

	try {
		const a = await auth();
		const res = await a.api.signUpEmail({
			body: { name, email, password: _password }
		});

		return {
			success: true,
			message: 'Account created! Please check your email to verify your account.'
		};
	} catch (error: unknown) {
		console.error('[auth.remote:signUp] ERROR:', error);
		const message =
			error instanceof Error ? error.message : 'Registration failed. Please try again.';
		return { success: false, message };
	}
});

export const requestPasswordReset = form(forgotPasswordSchema, async ({ email }) => {
	try {
		const a = await auth();
		await a.api.requestPasswordReset({ body: { email, redirectTo: '/auth/reset' } });
	} catch {
		// Swallow errors — always return success to prevent email enumeration
	}

	return {
		success: true,
		message: "If an account exists with that email, you'll receive a reset link."
	};
});

// ── OAuth2 ───────────────────────────────────────────────────────────────────

export const oauth2SignIn = form(z.object({ provider: z.string() }), async ({ provider }) => {
	const { url } = getRequestEvent();
	const callbackURL = `${url.origin}/`;
	const authURL = `${url.origin}/api/auth/sign-in/social?provider=${encodeURIComponent(provider)}&callbackURL=${encodeURIComponent(callbackURL)}`;
	throw redirect(303, authURL);
});

// ── OTP ──────────────────────────────────────────────────────────────────────

export const requestOTP = form(otpRequestSchema, async ({ email }) => {
	try {
		const a = await auth();
		await a.api.sendVerificationOTP({
			body: { email, type: 'sign-in' }
		});
		return {
			success: true,
			email,
			message: 'A verification code has been sent to your email.'
		};
	} catch (err) {
		console.error('[auth.remote:requestOTP] ERROR:', err);
		return {
			success: false,
			email: null as string | null,
			message: 'Failed to send verification code. Please try again.'
		};
	}
});

export const verifyOTP = form(otpVerifySchema, async ({ email, otp }) => {
	try {
		const event = getRequestEvent();
		const a = await auth();
		const response = await a.api.signInEmailOTP({
			body: { email, otp },
			asResponse: true,
			headers: event.request.headers
		});

		if (!response.ok) {
			return {
				success: false,
				message: 'Invalid or expired code. Please try again.'
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
		return {
			success: false,
			message: 'Invalid or expired code. Please try again.'
		};
	}
});
