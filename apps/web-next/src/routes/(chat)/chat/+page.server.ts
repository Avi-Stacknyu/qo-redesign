/**
 * Chat landing page server load — fetches visible agents for the agent shelf.
 */

import { error } from '@sveltejs/kit';
import { requireFeature } from '$lib/utils/route-guard';
import { loadChatPageData } from '$lib/server/chat-data';
import type { PageServerLoad } from './$types';

export type ChatLandingTierContext = {
	allowedModelIds: string[];
	hasSubscription: boolean;
	creditBalance: number;
};

export const load: PageServerLoad = async ({ locals: { db, user }, platform, request, parent }) => {
	if (!db || !user) throw error(401, 'Unauthorized');

	const { features } = await parent();
	requireFeature(features, 'page:chat');

	try {
		const data = await loadChatPageData(db, user.id, user.plan, platform, request);

		return {
			agents: data.agents,
			shelfAgentIds: data.shelfAgentIds,
			hasShelf: data.hasShelf,
			availableModels: data.availableModels,
			tierContext: {
				allowedModelIds: data.tierContext.allowedModelIds,
				hasSubscription: data.tierContext.hasSubscription,
				creditBalance: data.tierContext.creditBalance
			} satisfies ChatLandingTierContext
		};
	} catch (err) {
		console.error('Failed to load agents', err);
		return {
			agents: [],
			shelfAgentIds: [] as string[],
			hasShelf: false,
			availableModels: [],
			tierContext: { allowedModelIds: [], hasSubscription: false, creditBalance: 0 }
		};
	}
};
