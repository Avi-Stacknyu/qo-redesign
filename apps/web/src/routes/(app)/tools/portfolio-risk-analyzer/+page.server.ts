import { loadVisibleTools, loadToolResults } from '$lib/remote/tools.remote';
import { requireFeature } from '$lib/utils/route-guard';
import { error } from '@sveltejs/kit';

export async function load({ parent }) {
	const { features } = await parent();
	requireFeature(features, 'page:tools');

	const [tools, pastResults] = await Promise.all([
		loadVisibleTools(),
		loadToolResults({ toolKey: 'portfolio-risk-analyzer' })
	]);

	const tool = tools.find((t: { tool_key: string }) => t.tool_key === 'portfolio-risk-analyzer');
	if (!tool) error(404, 'Portfolio Risk Analyzer not found');

	return { tool, pastResults };
}
