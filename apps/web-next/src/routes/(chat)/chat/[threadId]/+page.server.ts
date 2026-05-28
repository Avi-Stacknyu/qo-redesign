/**
 * Active chat thread server load — fetches thread, messages, and visible agents.
 */

import { error, redirect } from '@sveltejs/kit';
import { requireFeature } from '$lib/utils/route-guard';
import { loadChatPageData } from '$lib/server/chat-data';
import { eq, asc } from 'drizzle-orm';
import { chats, chatMessages } from '@repo/db/schema';
import type { PageServerLoad } from './$types';

/** Lightweight tier context for client-side gating. */
export type ChatTierContext = {
	allowedModelIds: string[];
	hasSubscription: boolean;
	creditBalance: number;
	planTitle: string | null;
};

type ChatMeta = {
	agentId?: string;
	icon?: string;
	favorite?: boolean;
};

export const load: PageServerLoad = async ({
	params,
	locals: { db, user },
	platform,
	request,
	parent
}) => {
	if (!db || !user) throw error(401, 'Unauthorized');

	const { features } = await parent();
	requireFeature(features, 'page:chat');

	const { threadId } = params;

	try {
		const [chat] = await db.select().from(chats).where(eq(chats.id, threadId)).limit(1);
		if (!chat) redirect(303, '/chat');
		if (chat.user !== user.id) throw error(403, 'Forbidden');

		const meta = (chat.meta ?? {}) as ChatMeta;

		const [data, messageRows] = await Promise.all([
			loadChatPageData(db, user.id, user.plan, platform, request),
			db
				.select()
				.from(chatMessages)
				.where(eq(chatMessages.chat, threadId))
				.orderBy(asc(chatMessages.created))
		]);

		const messages = messageRows.map((msg) => ({
			id: msg.id,
			role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
			content: msg.message ?? '',
			created_at: msg.created ?? new Date().toISOString(),
			files: (msg.meta as Record<string, unknown>)?.files as
				| Array<{ id: string; name: string; size: number; type: string; url: string }>
				| undefined,
			parts: (msg.meta as Record<string, unknown>)?.parts as unknown[] | undefined
		}));

		return {
			thread: {
				id: chat.id,
				title: chat.title ?? 'New Chat',
				agentId: (chat.agent || meta.agentId) ?? null,
				icon: meta.icon ?? null,
				favorite: meta.favorite ?? false,
				modelOverrideId: null
			},
			agents: data.agents,
			shelfAgentIds: data.shelfAgentIds,
			hasShelf: data.hasShelf,
			messages,
			availableModels: data.availableModels,
			tierContext: {
				allowedModelIds: data.tierContext.allowedModelIds,
				hasSubscription: data.tierContext.hasSubscription,
				creditBalance: data.tierContext.creditBalance,
				planTitle: data.tierContext.planTitle ?? null
			} satisfies ChatTierContext
		};
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err && 'location' in err) throw err;
		if (err && typeof err === 'object' && 'status' in err) {
			const status = (err as { status: number }).status;
			if (status === 403) throw error(403, 'Forbidden');
		}
		redirect(303, '/chat');
	}
};
