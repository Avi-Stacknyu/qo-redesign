import { loadVisibleTools } from '$lib/remote/tools.remote';
import { requireFeature } from '$lib/utils/route-guard';

export async function load({ parent }) {
	const { features } = await parent();
	requireFeature(features, 'page:tools');

	const tools = await loadVisibleTools();
	return { tools };
}
