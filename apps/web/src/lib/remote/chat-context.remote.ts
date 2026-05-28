/**
 * Chat Context Remote — context warming, suggestions, deletion with context.
 * Split from V1 chat.remote.ts to stay under 200 LOC.
 */
import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { chats, chatFileReferences, chatMessages } from '@repo/db/schema';
import { MemoryGraphService } from '@repo/db/graph';
import { eq } from 'drizzle-orm';
import z from 'zod/v4';

type ChatMeta = { agentId?: string; icon?: string; favorite?: boolean };
type MemoryGraphNode = { id: string; data?: Record<string, unknown>; createdAt?: string };

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

export const getAgentSuggestions = query(
	z.object({
		agentId: z.string(),
		agentName: z.string().optional(),
		agentDescription: z.string().optional()
	}),
	async ({ agentId, agentName, agentDescription }) => {
		const { platform, locals } = getRequestEvent();
		const defaults = [
			{
				title: 'Financial Analysis',
				description: 'Review performance metrics',
				prompt: "Analyze this quarter's financial performance and provide key insights",
				icon: 'analysis' as const
			},
			{
				title: 'Tax Planning',
				description: 'Optimize your tax strategy',
				prompt: 'Create a comprehensive tax optimization strategy',
				icon: 'planning' as const
			},
			{
				title: 'Market Research',
				description: 'ESG trends',
				prompt: 'Research the latest trends in sustainable investing',
				icon: 'research' as const
			},
			{
				title: 'Portfolio Review',
				description: 'Risk assessment',
				prompt: 'Review my investment portfolio and suggest rebalancing',
				icon: 'action' as const
			}
		];

		if (!locals.user?.id) {
			return { suggestions: defaults, fromCache: false, regenerating: false };
		}

		const worker = platform?.env?.CF_WORKER;
		if (!worker) {
			return { suggestions: defaults, fromCache: false, regenerating: false };
		}

		try {
			const result = await worker.getCachedSuggestions({
				userId: locals.user.id,
				agentId,
				agentName: agentName ?? undefined,
				agentDescription: agentDescription ?? undefined
			});
			return {
				suggestions: result.suggestions as typeof defaults,
				fromCache: result.fromCache,
				regenerating: result.regenerating
			};
		} catch {
			return { suggestions: defaults, fromCache: false, regenerating: false };
		}
	}
);

export const getChatContextInfo = query(
	z.string(),
	async (chatId): Promise<{ factCount: number; fileCount: number }> => {
		const { db, userId } = getDbAndUser();

		try {
			const [chat] = await db
				.select({ created: chats.created })
				.from(chats)
				.where(eq(chats.id, chatId))
				.limit(1);
			if (!chat) return { factCount: 0, fileCount: 0 };

			const chatCreated = new Date(chat.created!).toISOString();

			const graph = new MemoryGraphService(db, userId);
			const allFacts = (await graph.getNodesByType('FACT', 1000)) as MemoryGraphNode[];
			const factCount = allFacts.filter((f) => {
				const source = (f.data?.source as string) || '';
				return source.startsWith('session::') && (f.createdAt || '') >= chatCreated;
			}).length;

			const fileRefs = await db
				.select({ id: chatFileReferences.id })
				.from(chatFileReferences)
				.where(eq(chatFileReferences.chat, chatId));

			return { factCount, fileCount: fileRefs.length };
		} catch {
			return { factCount: 0, fileCount: 0 };
		}
	}
);

export const deleteThreadWithContext = command(
	z.object({ chatId: z.string(), deleteContext: z.boolean() }),
	async ({ chatId, deleteContext }) => {
		const { db, userId } = getDbAndUser();
		const { platform } = getRequestEvent();

		const [chat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
		if (!chat) throw error(404, 'Thread not found');
		if (chat.user !== userId) throw error(403, 'Forbidden');

		const chatCreated = new Date(chat.created!).toISOString();
		let deletedFacts = 0;
		let deletedFiles = 0;

		if (deleteContext) {
			const graph = new MemoryGraphService(db, userId);

			for (const type of ['FACT', 'ENTITY', 'INTENT'] as const) {
				const nodes = await graph.getNodesByType(type, 1000);
				for (const node of nodes) {
					const source = (node.data?.source as string) || '';
					if (source.startsWith('session::') && (node.createdAt || '') >= chatCreated) {
						await graph.deleteNode(node.id);
						if (type === 'FACT') deletedFacts++;
					}
				}
			}

			const fileRefs = await db
				.select()
				.from(chatFileReferences)
				.where(eq(chatFileReferences.chat, chatId));

			for (const ref of fileRefs) {
				if (ref.file && platform?.env?.FILE_SERVICE) {
					try {
						await platform.env.FILE_SERVICE.deleteFile({
							fileId: ref.file,
							userId
						});
						deletedFiles++;
					} catch (fileErr) {
						console.error('Failed to delete file:', ref.file, fileErr);
					}
				}
				await db.delete(chatFileReferences).where(eq(chatFileReferences.id, ref.id));
			}
		}

		// Chat messages cascade-delete via FK, but delete explicitly for safety
		await db.delete(chatMessages).where(eq(chatMessages.chat, chatId));

		await db.delete(chats).where(eq(chats.id, chatId));
		return { id: chatId, deleted: true, deletedFacts, deletedFiles };
	}
);
