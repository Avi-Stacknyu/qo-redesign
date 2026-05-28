import { env as PrivEnv } from '$env/dynamic/private';
import { forwardAuthCookiesFromResponse, getSafeCallbackPath } from '$lib/server/auth-response';
import { buildAuthOptions, getAuth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, request, cookies, locals, platform }) => {
	const token = url.searchParams.get('token');
	if (!token) return { success: false, message: 'Missing verification token.' };
	const callbackURL = getSafeCallbackPath(url.searchParams.get('callbackURL'), url.origin);

	try {
		const auth = getAuth(locals.db, buildAuthOptions(url.origin, PrivEnv, platform?.env));
		const response = await auth.api.verifyEmail({
			query: { token },
			asResponse: true,
			headers: request.headers
		});

		if (!response.ok) {
			return {
				success: false,
				message: 'Invalid or expired verification link. Please request a new one.'
			};
		}

		forwardAuthCookiesFromResponse(response, cookies);
		if (callbackURL) {
			redirect(303, callbackURL);
		}

		return { success: true, message: 'Your email has been verified successfully.' };
	} catch {
		return {
			success: false,
			message: 'Invalid or expired verification link. Please request a new one.'
		};
	}
};
