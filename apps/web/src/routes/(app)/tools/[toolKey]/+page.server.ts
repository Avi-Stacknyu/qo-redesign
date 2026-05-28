import { loadVisibleTools, loadToolResults } from '$lib/remote/tools.remote';
import { requireFeature } from '$lib/utils/route-guard';
import { error } from '@sveltejs/kit';

export async function load({ parent, params }) {
	const { features } = await parent();
	requireFeature(features, 'page:tools');

	const [tools, pastResults] = await Promise.all([
		loadVisibleTools(),
		loadToolResults({ toolKey: params.toolKey })
	]);

	const tool = tools.find((t: { tool_key: string }) => t.tool_key === params.toolKey);
	if (!tool) error(404, `Tool "${params.toolKey}" not found`);

	return { tool, pastResults };
}
