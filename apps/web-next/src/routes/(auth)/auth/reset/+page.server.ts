import type { PageServerLoad, Actions } from './$types';
import { env as PrivEnv } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import { buildAuthOptions, getAuth } from '$lib/server/auth';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token) return { token: null, error: 'Missing reset token.' };
	return { token, error: null };
};

export const actions = {
	default: async ({ request, locals, url, platform }) => {
		const formData = await request.formData();
		const token = formData.get('token') as string;
		const password = formData.get('password') as string;
		const passwordConfirm = formData.get('passwordConfirm') as string;

		if (!token) return fail(400, { success: false, message: 'Missing reset token.' });
		if (!password || password.length < 8) {
			return fail(400, { success: false, message: 'Password must be at least 8 characters.' });
		}
		if (password !== passwordConfirm) {
			return fail(400, { success: false, message: 'Passwords do not match.' });
		}

		try {
			const auth = getAuth(locals.db, buildAuthOptions(url.origin, PrivEnv, platform?.env));
			await auth.api.resetPassword({ body: { newPassword: password, token } });
			return { success: true, message: 'Your password has been reset successfully.' };
		} catch {
			return fail(400, {
				success: false,
				message: 'Invalid or expired reset link. Please request a new one.'
			});
		}
	}
} satisfies Actions;
