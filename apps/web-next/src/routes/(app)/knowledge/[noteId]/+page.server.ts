import { getNoteById, getNoteCategories } from '$lib/remote/knowledge.remote';
import { requireFeature } from '$lib/utils/route-guard';

export async function load({ params, parent }) {
	const { features } = await parent();
	requireFeature(features, 'page:knowledge');

	const [note, categories] = await Promise.all([
		getNoteById({ noteId: params.noteId }),
		getNoteCategories()
	]);
	return { note, categories };
}
