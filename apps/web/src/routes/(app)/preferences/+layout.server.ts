import { requireFeature } from '$lib/utils/route-guard';

export async function load({ parent }) {
	const { features } = await parent();
	requireFeature(features, 'page:settings');
}
