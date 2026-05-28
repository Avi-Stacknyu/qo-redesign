import { getNotes, getNoteCategories } from '$lib/remote/knowledge.remote';
import { requireFeature } from '$lib/utils/route-guard';

export async function load({ parent }) {
	const { features } = await parent();
	requireFeature(features, 'page:knowledge');

	const [notes, categories] = await Promise.all([getNotes(), getNoteCategories()]);
	return { notes, categories };
}
