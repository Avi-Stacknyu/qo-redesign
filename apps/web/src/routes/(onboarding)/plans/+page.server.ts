/**
 * @deprecated Plans page is deprecated. Trial plans are now auto-activated after onboarding.
 * Keeping this route for backwards compatibility — redirects to dashboard.
 * --meet
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { user } }) => {
	if (!user) {
		redirect(303, '/login');
	}

	if (!user.onboardingComplete) {
		redirect(303, '/onboarding');
	}

	// Plans page is deprecated — trial is auto-activated after onboarding
	redirect(303, '/');
};
