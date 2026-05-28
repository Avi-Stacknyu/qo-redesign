/**
 * Chat Threads Remote — CRUD operations for chat threads.
 * Split from V1 chat.remote.ts to stay under 200 LOC.
 */
import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { chats, aiAgents, userCreditBalance } from '@repo/db/schema';
import { and, eq, ne, desc, sql } from 'drizzle-orm';
import z from 'zod/v4';

type ChatMeta = {
	agentId?: string;
	icon?: string;
	favorite?: boolean;
};

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

export const createThread = command(
	z.object({
		agent_id: z.string(),
		title: z.string().optional().default('New Chat'),
		model_override: z.string().optional(),
		source: z.enum(['app', 'discovery']).optional().default('app')
	}),
	async ({ agent_id, title, model_override, source }) => {
		const { db, userId } = getDbAndUser();

		const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, agent_id)).limit(1);
		if (!agent) throw error(404, 'Agent not found');
		if (agent.status === 'inactive') throw error(400, 'Agent is inactive');

		const now = new Date().toISOString();
		const [chat] = await db
			.insert(chats)
			.values({
				id: generateId(),
				title: title || 'New Chat',
				user: userId,
				agent: agent_id,
				source,
				meta: model_override ? { model_override } : null,
				created: now,
				updated: now
			})
			.returning();

		return {
			id: chat.id,
			title: chat.title ?? 'New Chat',
			created_at: chat.created ?? now,
			updated: chat.updated ?? now,
			agentId: agent_id
		};
	}
);

export const updateThreadAgent = command(
	z.object({ thread_id: z.string(), agent_id: z.string() }),
	async ({ thread_id, agent_id }) => {
		const { db, userId } = getDbAndUser();

		const [chat] = await db.select().from(chats).where(eq(chats.id, thread_id)).limit(1);
		if (!chat) throw error(404, 'Thread not found');
		if (chat.user !== userId) throw error(403, 'Forbidden');

		const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, agent_id)).limit(1);
		if (!agent || agent.status === 'inactive') throw error(400, 'Invalid or inactive agent');

		await db
			.update(chats)
			.set({ agent: agent_id, updated: new Date().toISOString() })
			.where(eq(chats.id, thread_id));

		return { id: thread_id, agent_id };
	}
);

export const updateThreadModel = command(
	z.object({ thread_id: z.string(), model_id: z.string().nullable() }),
	async ({ thread_id, model_id }) => {
		const { db, userId } = getDbAndUser();

		const [chat] = await db.select().from(chats).where(eq(chats.id, thread_id)).limit(1);
		if (!chat) throw error(404, 'Thread not found');
		if (chat.user !== userId) throw error(403, 'Forbidden');

		const meta = (chat.meta ?? {}) as Record<string, unknown>;
		if (model_id) {
			meta.model_override = model_id;
		} else {
			delete meta.model_override;
		}

		await db
			.update(chats)
			.set({ meta, updated: new Date().toISOString() })
			.where(eq(chats.id, thread_id));

		return { id: thread_id, model_id };
	}
);

export const toggleThreadFavorite = command(
	z.object({ thread_id: z.string(), favorite: z.boolean() }),
	async ({ thread_id, favorite }) => {
		const { db, userId } = getDbAndUser();

		const [chat] = await db.select().from(chats).where(eq(chats.id, thread_id)).limit(1);
		if (!chat) throw error(404, 'Thread not found');
		if (chat.user !== userId) throw error(403, 'Forbidden');

		const meta = { ...((chat.meta ?? {}) as ChatMeta), favorite };

		await db
			.update(chats)
			.set({ meta, updated: new Date().toISOString() })
			.where(eq(chats.id, thread_id));

		return { id: thread_id, favorite };
	}
);

export const deleteThread = command(z.string(), async (thread_id) => {
	const { db, userId } = getDbAndUser();

	const [chat] = await db.select().from(chats).where(eq(chats.id, thread_id)).limit(1);
	if (!chat) throw error(404, 'Thread not found');
	if (chat.user !== userId) throw error(403, 'Forbidden');

	await db.delete(chats).where(eq(chats.id, thread_id));
	return { id: thread_id, deleted: true };
});

export const getThreadList = query(async () => {
	const { db, userId } = getDbAndUser();

	const rows = await db
		.select({
			id: chats.id,
			title: chats.title,
			meta: chats.meta,
			created: chats.created,
			updated: chats.updated,
			agent: chats.agent
		})
		.from(chats)
		.where(
			and(eq(chats.user, userId), ne(chats.source, 'admin_test'), ne(chats.source, 'discovery'))
		)
		.orderBy(desc(chats.updated));

	return rows.map((chat) => {
		const meta = (chat.meta ?? {}) as ChatMeta;
		return {
			id: chat.id,
			title: chat.title ?? 'New Chat',
			icon: meta.icon ?? '💬',
			favorite: meta.favorite ?? false,
			created_at: chat.created ?? new Date().toISOString(),
			updated: chat.updated ?? new Date().toISOString(),
			agentId: chat.agent
		};
	});
});

export const getUserCreditBalance = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) return { balance: 0, lifetime_spent: 0, lifetime_purchased: 0 };

	try {
		const [record] = await locals.db
			.select()
			.from(userCreditBalance)
			.where(eq(userCreditBalance.user, locals.user.id))
			.limit(1);

		if (!record) return { balance: 0, lifetime_spent: 0, lifetime_purchased: 0 };

		return {
			balance: Number(record.balance ?? 0),
			lifetime_spent: Number(record.lifetimeSpent ?? 0),
			lifetime_purchased: Number(record.lifetimePurchased ?? 0)
		};
	} catch {
		return { balance: 0, lifetime_spent: 0, lifetime_purchased: 0 };
	}
});
