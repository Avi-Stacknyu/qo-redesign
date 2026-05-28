import { getGlobalAnalytics } from '$lib/remote/analytics.remote';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const analytics = await getGlobalAnalytics({ range: '30d' });
	return { analytics };
};
