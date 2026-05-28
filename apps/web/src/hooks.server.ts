import { building, dev } from '$app/environment';
import { env as PrivEnv } from '$env/dynamic/private';
import { buildAuthOptions, getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { createDevPlatformEnv } from '$lib/server/dev-rpc';
import { extractCampaignHint, writeCampaignHintCookie } from '$lib/server/onboarding-source-cookie';
import { parseThemeCookie, resolveTheme } from '$lib/server/theme';
import type { SessionUser } from '@repo/db/auth';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const AUTH_REQUIRED = new Set(['(app)', '(chat)', '(onboarding)']);
const PLAN_REQUIRED = new Set(['(app)', '(chat)']);

const THEME_COOKIE_NAME = 'qo-theme';

// ── Hook 1: Dev Bindings
const devBindings: Handle = async ({ event, resolve }) => {
	if (dev) {
		const devEnv = createDevPlatformEnv();
		event.platform = {
			...(event.platform ?? {}),
			context: event.platform?.context ?? {},
			env: {
				...(event.platform?.env ?? {}),
				...(devEnv as Record<string, unknown>)
			} as App.Platform['env']
		};
	}
	return resolve(event);
};

// ── Hook 2: Maintenance Mode
const maintenanceHandler: Handle = async ({ event, resolve }) => {
	if (String(PrivEnv.MAINTENANCE_MODE) === 'true') {
		if (event.url.pathname !== '/maintenance') {
			redirect(307, '/maintenance');
		}
	}
	return resolve(event);
};

// ── Hook 3: Onboarding Source Capture
const onboardingSourceCapture: Handle = async ({ event, resolve }) => {
	const hint = extractCampaignHint(event.url);
	if (hint.campaignSlug || hint.inviteCode) {
		writeCampaignHintCookie(event, hint);
	}
	return resolve(event);
};

// ── Hook 4: Theme Injection
/**
 * Read the `qo-theme` cookie at the edge and inject the resolved CSS variables
 * + dark class directly into the `<html>` tag via `transformPageChunk`.
 *
 * This ensures the HTML arrives with the correct theme. Zero FOUC.
 */
const themeInjection: Handle = async ({ event, resolve }) => {
	const routeId = event.route.id;
	if (!routeId) return resolve(event);

	const segments = routeId.split('/');
	const firstSegment = segments[1] || '';
	const isAuthRoute = firstSegment === '(auth)';
	const isOnboardingRoute = segments.includes('onboarding');

	if (isAuthRoute || isOnboardingRoute) {
		// Force light mode for auth/onboarding routes — explicit class="light"
		return resolve(event, {
			transformPageChunk({ html }) {
				return html.replace('<html lang="en">', '<html lang="en" class="light">');
			}
		});
	}

	const raw = event.cookies.get(THEME_COOKIE_NAME);
	const themeCookie = parseThemeCookie(raw);
	const theme = resolveTheme(themeCookie);

	return resolve(event, {
		transformPageChunk({ html }) {
			const darkClass = theme.mode === 'dark' ? ' class="dark"' : '';
			return html.replace(
				'<html lang="en">',
				`<html lang="en"${darkClass} style="${theme.cssInline}">`
			);
		}
	});
};

// ── Hook 5: Authentication
const authentication: Handle = async ({ event, resolve }) => {
	try {
		// Initialize database via Hyperdrive
		const { db } = await getDb(event.platform!);
		event.locals.db = db;

		// Better Auth session check
		const auth = getAuth(db, buildAuthOptions(event.url.origin, PrivEnv, event.platform?.env));

		let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
		try {
			session = await auth.api.getSession({ headers: event.request.headers });
		} catch {
			// Treat as unauthenticated — session lookup failed
		}

		if (session) {
			event.locals.user = session.user as SessionUser;
		} else {
			event.locals.user = undefined;
		}

		// Better Auth handles /api/auth/* routes, resolve() handles everything else
		return svelteKitHandler({ event, resolve, auth, building });
	} catch (err) {
		console.error('[hooks:auth]', err instanceof Error ? err.message : String(err));
		throw err;
	}
};

// ── Hook 6: Auth Guard
const authGuard: Handle = async ({ event, resolve }) => {
	const routeId = event.route.id;
	if (!routeId) return resolve(event);

	const segments = routeId.split('/');
	const firstSegment = segments[1] || '';
	const user = event.locals.user;

	// Banned users get force-logged out
	if (user && user.accountStatus === 'banned') {
		event.locals.user = undefined;
		redirect(303, '/login');
	}

	const requiresAuth = AUTH_REQUIRED.has(firstSegment);
	const isAuthRoute =
		firstSegment === '(auth)' && (segments.includes('login') || segments.includes('register'));
	const isOnboardingRoute = segments.includes('onboarding');
	const isAuthenticated = Boolean(user);
	const onboardingComplete = Boolean(user?.onboardingComplete);
	const planId = user?.plan || null;

	// RULE 0: Authenticated users cannot access login/register
	if (isAuthRoute && isAuthenticated) {
		redirect(303, '/');
	}

	// RULE 1: Protected routes require login
	if (requiresAuth && !isAuthenticated) {
		redirect(307, '/login');
	}

	if (!isAuthenticated) return resolve(event);

	// RULE 2: Incomplete onboarding → /onboarding.
	if (requiresAuth && !onboardingComplete && !isOnboardingRoute) {
		redirect(303, '/onboarding');
	}

	// RULE 3: No plan → /preferences/billing (rarely triggers — trial auto-assigned)
	const needsPlan = segments.some((seg) => PLAN_REQUIRED.has(seg)) || event.url.pathname === '/';
	const isBillingRoute =
		event.url.pathname.startsWith('/preferences/billing') || event.url.pathname === '/billing';
	if (onboardingComplete && !planId && needsPlan && !isBillingRoute) {
		redirect(303, '/preferences/billing');
	}

	// RULE 4: Completed onboarding → no revisiting /onboarding
	if (isOnboardingRoute && onboardingComplete) {
		redirect(303, '/');
	}

	return resolve(event);
};

// ── Export ────────────────────────────────────────────────────────────────────

export const handle: Handle = sequence(
	devBindings,
	maintenanceHandler,
	onboardingSourceCapture,
	themeInjection,
	authentication,
	authGuard
);
