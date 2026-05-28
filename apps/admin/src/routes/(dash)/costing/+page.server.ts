import { getAiSpendAnalytics } from './costing.remote';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const analytics = await getAiSpendAnalytics({ range: '30d' });
	return { analytics };
};
