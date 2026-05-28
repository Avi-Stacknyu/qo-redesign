import { redirect } from '@sveltejs/kit';

// OAuth callbacks are now handled by Better Auth via svelteKitHandler at /api/auth/callback/*.
// This legacy route redirects in case old links are hit.
export const GET = async () => {
	throw redirect(303, '/login');
};
