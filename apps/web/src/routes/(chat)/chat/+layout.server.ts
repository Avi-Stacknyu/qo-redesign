import { getEnabledFeaturesFromWorker } from '$lib/utils/feature-flags';
import { getRequestEvent } from '$app/server';

export async function load() {
	const { locals, platform } = getRequestEvent();
	const userId = locals.user?.id;

	const features = userId ? await getEnabledFeaturesFromWorker(platform, userId) : [];

	return { features };
}
