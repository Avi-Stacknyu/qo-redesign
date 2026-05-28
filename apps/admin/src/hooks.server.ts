import { building, dev } from '$app/environment';
import { env as PrivEnv } from '$env/dynamic/private';
import { buildAuthOptions, getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import type { SessionUser } from '@repo/db/auth';
import { coreRolePermissions } from '@repo/db/schema';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { eq } from 'drizzle-orm';
import { createDevPlatformEnv } from '$lib/utils/dev-rpc-client';

const AUTH_REQUIRED = new Set(['(dash)']);

/**
 * Dev Bindings Handler — injects HTTP-backed binding proxies in local dev.
 *
 * When running `vite dev`, Miniflare's platformProxy creates binding stubs that
 * *exist* but fail with "Durable Object RPC is not yet supported between
 * multiple dev sessions". We ALWAYS override them in dev mode with our HTTP
 * proxies that route to the worker's `/dev-rpc/*` endpoints at localhost:8787.
 *
 * In production builds, this handler is a no-op (the `dev` constant is false).
 */
const devBindings: Handle = async ({ event, resolve }) => {
	console.log(
		'[DIAG:admin] Hook:devBindings path=' +
			event.url.pathname +
			' platform=' +
			(event.platform ? 'yes' : 'NO') +
			' HYPERDRIVE=' +
			(event.platform?.env?.HYPERDRIVE ? 'yes' : 'NO')
	);
	if (dev) {
		const devEnv = createDevPlatformEnv();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(event as any).platform = {
			...(event.platform ?? {}),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			context: (event.platform as any)?.context ?? {},
			env: {
				...(event.platform?.env ?? {}),
				...devEnv
			}
		};
	}
	return resolve(event);
};

export const authentication: Handle = async ({ event, resolve }) => {
	console.log('[DIAG:admin] Hook:auth path=' + event.url.pathname);
	try {
		// Initialize database via Hyperdrive
		const { db } = await getDb(event.platform!);
		console.log('[DIAG:admin] db created OK');
		event.locals.db = db;

		// Better Auth session check
		const auth = getAuth(db, buildAuthOptions(event.url.origin, PrivEnv, event.platform?.env));
		console.log('[DIAG:admin] auth created OK');
		const session = await auth.api.getSession({ headers: event.request.headers });
		console.log('[DIAG:admin] session=' + (session ? 'found' : 'none'));

		if (session) {
			event.locals.user = session.user as SessionUser;
		} else {
			event.locals.user = undefined;
		}

		// Better Auth handles /api/auth/* routes
		return svelteKitHandler({ event, resolve, auth, building });
	} catch (err) {
		const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
		console.error('[DIAG:admin] Hook:auth CRASHED type=' + typeof err + ' msg=' + msg);
		try {
			console.error('[DIAG:admin] JSON=' + JSON.stringify(err));
		} catch {
			console.error('[DIAG:admin] JSON serialization failed');
		}
		throw err;
	}
};

// Guard routes based on auth state and admin role
const authGuard: Handle = async ({ event, resolve }) => {
	const routeId = event.route.id;
	if (!routeId) return resolve(event);

	const segments = routeId.split('/');
	const firstSegment = segments[1] || '';
	const user = event.locals.user;

	const requiresAuth = AUTH_REQUIRED.has(firstSegment);

	const isAuthRoute =
		firstSegment === '(auth)' && (segments.includes('login') || segments.includes('register'));

	// Check admin role via DB lookup
	let isAdmin = false;
	if (user?.role) {
		const rows = await event.locals.db
			.select({ entityType: coreRolePermissions.entityType })
			.from(coreRolePermissions)
			.where(eq(coreRolePermissions.id, user.role))
			.limit(1);
		isAdmin = rows[0]?.entityType === 'root' || rows[0]?.entityType === 'admin';
	}

	if (isAuthRoute && isAdmin) {
		redirect(303, '/');
	}

	if (requiresAuth && !isAdmin) {
		event.locals.user = undefined;
		redirect(307, '/login');
	}

	if (!isAdmin) return resolve(event);

	return resolve(event);
};

const maintenanceHandler: Handle = async ({ event, resolve }) => {
	if (String(PrivEnv.ADMIN_MAINTENANCE_MODE) === 'true') {
		if (event.url.pathname !== '/maintenance') {
			redirect(307, '/maintenance');
		}
	}
	return resolve(event);
};

export const handle: Handle = sequence(devBindings, maintenanceHandler, authentication, authGuard);
