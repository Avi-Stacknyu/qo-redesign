/**
 * Knowledge Remote — CRUD for user notes (knowledge base).
 */
import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { userNotes, chats, aiAgents } from '@repo/db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';
import z from 'zod/v4';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Note {
	id: string;
	title: string;
	content: string;
	category: string;
	source: string;
	tags: string[];
	pinned: boolean;
	created: string;
	updated: string;
	agentName: string | null;
	chatTitle: string | null;
}

export interface NoteCategory {
	category: string;
	count: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

function rowToNote(row: {
	id: string;
	title: string | null;
	content: string | null;
	category: string | null;
	source: string | null;
	tags: unknown;
	pinned: boolean | null;
	created: string | null;
	updated: string | null;
	agentName: string | null;
	chatTitle: string | null;
}): Note {
	return {
		id: row.id,
		title: row.title || 'Untitled',
		content: row.content || '',
		category: row.category || '',
		source: row.source || 'user_manual',
		tags: Array.isArray(row.tags) ? row.tags : [],
		pinned: row.pinned || false,
		created: row.created || '',
		updated: row.updated || '',
		agentName: row.agentName,
		chatTitle: row.chatTitle
	};
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Fetch all notes for the current user, pinned first. */
export const getNotes = query(async (): Promise<Note[]> => {
	const { db, userId } = getDbAndUser();

	const rows = await db
		.select({
			id: userNotes.id,
			title: userNotes.title,
			content: userNotes.content,
			category: userNotes.category,
			source: userNotes.source,
			tags: userNotes.tags,
			pinned: userNotes.pinned,
			created: userNotes.created,
			updated: userNotes.updated,
			agentName: aiAgents.name,
			chatTitle: chats.title
		})
		.from(userNotes)
		.leftJoin(aiAgents, eq(userNotes.agent, aiAgents.id))
		.leftJoin(chats, eq(userNotes.chat, chats.id))
		.where(eq(userNotes.user, userId))
		.orderBy(desc(userNotes.pinned), desc(userNotes.created));

	return rows.map(rowToNote);
});

/** Fetch distinct categories with note counts. */
export const getNoteCategories = query(async (): Promise<NoteCategory[]> => {
	const { db, userId } = getDbAndUser();

	const rows = await db
		.select({
			category: userNotes.category,
			count: sql<number>`count(*)::int`
		})
		.from(userNotes)
		.where(eq(userNotes.user, userId))
		.groupBy(userNotes.category);

	const merged = new Map<string, number>();
	for (const r of rows) {
		const key = r.category || 'Uncategorized';
		merged.set(key, (merged.get(key) ?? 0) + r.count);
	}
	return Array.from(merged.entries())
		.map(([category, count]) => ({ category, count }))
		.sort((a, b) => b.count - a.count);
});

/** Fetch a single note by ID. */
export const getNoteById = query(
	z.object({ noteId: z.string().min(1) }),
	async ({ noteId }): Promise<Note> => {
		const { db, userId } = getDbAndUser();

		const [row] = await db
			.select({
				id: userNotes.id,
				title: userNotes.title,
				content: userNotes.content,
				category: userNotes.category,
				source: userNotes.source,
				tags: userNotes.tags,
				pinned: userNotes.pinned,
				created: userNotes.created,
				updated: userNotes.updated,
				user: userNotes.user,
				agentName: aiAgents.name,
				chatTitle: chats.title
			})
			.from(userNotes)
			.leftJoin(aiAgents, eq(userNotes.agent, aiAgents.id))
			.leftJoin(chats, eq(userNotes.chat, chats.id))
			.where(eq(userNotes.id, noteId))
			.limit(1);

		if (!row || row.user !== userId) throw error(404, 'Note not found');

		return rowToNote(row);
	}
);

// ── Commands ─────────────────────────────────────────────────────────────────

/** Create a new blank note. */
export const createNote = command(
	z.object({
		title: z.string().default('Untitled'),
		content: z.string().default(''),
		category: z.string().default('')
	}),
	async ({ title, content, category }) => {
		const { db, userId } = getDbAndUser();
		const now = new Date().toISOString();

		const [note] = await db
			.insert(userNotes)
			.values({
				id: generateId(),
				user: userId,
				title,
				content,
				category,
				source: 'user_manual',
				tags: [],
				pinned: false,
				includeInMemory: true,
				created: now,
				updated: now
			})
			.returning({ id: userNotes.id });

		getNotes().refresh();
		getNoteCategories().refresh();
		return { id: note.id };
	}
);

/** Save a chat message as a note with auto-categorization. */
export const saveMessageAsNote = command(
	z.object({ messageId: z.string().min(1), chatId: z.string().min(1), content: z.string().min(1) }),
	async ({ messageId, chatId, content }) => {
		const { db, userId } = getDbAndUser();
		const { platform } = getRequestEvent();

		let agentId: string | undefined;
		let agentName: string | undefined;
		try {
			const [chatRow] = await db
				.select({ agent: chats.agent, agentName: aiAgents.name })
				.from(chats)
				.leftJoin(aiAgents, eq(chats.agent, aiAgents.id))
				.where(eq(chats.id, chatId))
				.limit(1);

			agentId = chatRow?.agent || undefined;
			agentName = chatRow?.agentName || undefined;
		} catch {
			// Chat lookup failed, continue without agent reference
		}

		let category = 'General';
		let tags: string[] = [];
		try {
			const worker = platform?.env?.CF_WORKER;
			if (worker) {
				const result = await worker.categorizeNote({
					content,
					agentName,
					userId,
					chatId
				} as never);
				category = (result as { category: string }).category;
				tags = (result as { tags: string[] }).tags;
			}
		} catch {
			// Categorization failed, use defaults
		}

		const now = new Date().toISOString();
		const [note] = await db
			.insert(userNotes)
			.values({
				id: generateId(),
				user: userId,
				title: content.substring(0, 100).split('\n')[0] || 'Saved from chat',
				content,
				source: 'user_chat_save',
				chat: chatId,
				sourceMessage: messageId,
				agent: agentId ?? null,
				category,
				tags,
				includeInMemory: true,
				pinned: false,
				created: now,
				updated: now
			})
			.returning({ id: userNotes.id });

		getNotes().refresh();
		getNoteCategories().refresh();
		return { id: note.id, category, tags };
	}
);

/** Update note fields. */
export const updateNote = command(
	z.object({
		noteId: z.string().min(1),
		title: z.string().optional(),
		content: z.string().optional(),
		category: z.string().optional(),
		tags: z.array(z.string()).optional(),
		pinned: z.boolean().optional()
	}),
	async ({ noteId, ...fields }) => {
		const { db, userId } = getDbAndUser();

		const updates: Partial<typeof userNotes.$inferInsert> = { updated: new Date().toISOString() };
		if (fields.title !== undefined) updates.title = fields.title;
		if (fields.content !== undefined) updates.content = fields.content;
		if (fields.category !== undefined) updates.category = fields.category;
		if (fields.tags !== undefined) updates.tags = fields.tags;
		if (fields.pinned !== undefined) updates.pinned = fields.pinned;

		const result = await db
			.update(userNotes)
			.set(updates)
			.where(and(eq(userNotes.id, noteId), eq(userNotes.user, userId)))
			.returning({ id: userNotes.id });

		if (!result.length) throw error(404, 'Note not found');

		getNotes().refresh();
		getNoteCategories().refresh();
		getNoteById({ noteId }).refresh();
	}
);

/** Delete a note. */
export const deleteNote = command(z.object({ noteId: z.string().min(1) }), async ({ noteId }) => {
	const { db, userId } = getDbAndUser();

	const result = await db
		.delete(userNotes)
		.where(and(eq(userNotes.id, noteId), eq(userNotes.user, userId)))
		.returning({ id: userNotes.id });

	if (!result.length) throw error(404, 'Note not found');

	getNotes().refresh();
	getNoteCategories().refresh();
});

/** Toggle pin status. */
export const toggleNotePin = command(
	z.object({ noteId: z.string().min(1), pinned: z.boolean() }),
	async ({ noteId, pinned }) => {
		const { db, userId } = getDbAndUser();

		const result = await db
			.update(userNotes)
			.set({ pinned, updated: new Date().toISOString() })
			.where(and(eq(userNotes.id, noteId), eq(userNotes.user, userId)))
			.returning({ id: userNotes.id });

		if (!result.length) throw error(404, 'Note not found');

		getNotes().refresh();
		getNoteById({ noteId }).refresh();
	}
);
