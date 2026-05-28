import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq, and, gt } from 'drizzle-orm';
import { verifications, users } from '@repo/db/schema';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token) return { token: null, error: 'Missing confirmation token.' };
	return { token, error: null };
};

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const token = formData.get('token') as string;
		const password = formData.get('password') as string;

		if (!token) return fail(400, { success: false, message: 'Missing confirmation token.' });
		if (!password) return fail(400, { success: false, message: 'Password is required.' });

		try {
			const [record] = await locals.db
				.select()
				.from(verifications)
				.where(
					and(
						eq(verifications.identifier, token),
						gt(verifications.expiresAt, new Date().toISOString())
					)
				)
				.limit(1);

			if (!record) {
				return fail(400, { success: false, message: 'Invalid or expired token.' });
			}

			const newEmail = record.value;
			if (!newEmail) {
				return fail(400, { success: false, message: 'Invalid token data.' });
			}

			if (!locals.user) return fail(401, { success: false, message: 'Unauthorized.' });

			await locals.db
				.update(users)
				.set({ email: newEmail, updated: new Date().toISOString() })
				.where(eq(users.id, locals.user.id));

			await locals.db.delete(verifications).where(eq(verifications.id, record.id));

			return { success: true, message: 'Your email address has been updated successfully.' };
		} catch {
			return fail(400, {
				success: false,
				message: 'Invalid token or incorrect password. Please try again.'
			});
		}
	}
} satisfies Actions;
