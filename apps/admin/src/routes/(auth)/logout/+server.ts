import { buildAuthOptions, getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { env as PrivEnv } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';

export const GET = async ({ cookies, request, platform, url }) => {
	// Better Auth session revocation
	try {
		const { db } = await getDb(platform!);
		const auth = getAuth(db, buildAuthOptions(url.origin, PrivEnv, platform?.env));
		await auth.api.signOut({ headers: request.headers });
	} catch {
		// Ignore — session may already be invalid
	}

	// Explicitly clear session cookies (signOut response headers aren't propagated
	// through redirect(), so the browser keeps stale tokens without this)
	cookies.delete('better-auth.session_token', { path: '/' });
	cookies.delete('__Secure-better-auth.session_token', { path: '/', secure: true });
	cookies.delete('qo-theme', { path: '/' });

	return redirect(303, '/login');
};
