import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const rawAvatar = locals.user?.image ?? '';
	const avatarSrc = rawAvatar
		? rawAvatar.startsWith('http')
			? rawAvatar
			: '/api/avatar'
		: '';

	return {
		user: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name,
					email: locals.user.email,
					avatar: avatarSrc,
					onboardingComplete: locals.user.onboardingComplete,
					plan: locals.user.plan
				}
			: undefined
	};
};
