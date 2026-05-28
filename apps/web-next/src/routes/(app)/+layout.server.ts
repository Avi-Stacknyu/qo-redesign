/**
 * App layout server load — provides profile data, user info, agents, and feature flags to the sidebar.
 * ensureDefaultProfile both creates defaults for new users AND returns all profiles,
 * so we avoid redundant loadProfiles + loadActiveProfile calls.
 */

import { getRequestEvent } from '$app/server';
import { getAgents } from '$lib/remote/agents.remote';
import { ensureDefaultProfile } from '$lib/remote/profile.remote';
import { getEnabledFeaturesFromWorker } from '$lib/utils/feature-flags';

export async function load() {
	const { locals, platform } = getRequestEvent();
	const userId = locals.user?.id;

	const [{ profiles, activeProfile }, agents, features] = await Promise.all([
		ensureDefaultProfile(),
		getAgents(),
		userId ? getEnabledFeaturesFromWorker(platform, userId) : Promise.resolve([] as string[])
	]);

	const rawAvatar = locals.user?.image ?? '';
	const avatarSrc = rawAvatar
		? rawAvatar.startsWith('http')
			? rawAvatar
			: '/api/avatar'
		: '';

	const user = locals.user
		? {
				name: locals.user.name || locals.user.email,
				email: locals.user.email,
				avatar: avatarSrc,
				plan: locals.user.plan
			}
		: null;

	return {
		profiles,
		activeProfile,
		agents,
		features,
		user
	};
}
