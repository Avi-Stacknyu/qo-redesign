import { z } from 'zod';
import { tool } from 'ai';
import { userNotes } from '@repo/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { ValidationError } from '../../utils/errors';
import type { ToolContext } from './types';

export function createNotesTools(ctx: ToolContext) {
	return {
		create_note: tool({
			description:
				'Create a new note with content and optional title for the user. The agent should always use ask_confirmation first to confirm with the user before saving.',
			inputSchema: z.object({
				text: z.string().describe('The note content'),
				title: z.string().optional().default('Untitled').describe('Optional note title'),
				category: z
					.string()
					.optional()
					.describe(
						'A short category label (2-4 words) inferred from content, e.g. "Tax Strategy", "Portfolio Analysis"'
					),
				tags: z
					.array(z.string())
					.optional()
					.describe('Up to 5 keyword tags relevant to the note content')
			}),
			execute: async ({
				text,
				title,
				category,
				tags
			}: {
				text: string;
				title?: string;
				category?: string;
				tags?: string[];
			}) => {
				const now = new Date().toISOString();
				await ctx.db.insert(userNotes).values({
					id: generateId(),
					user: ctx.userId,
					title: title || 'Untitled',
					content: text,
					includeInMemory: true,
					source: 'agent_tool',
					category: category || undefined,
					tags: tags || undefined,
					chat: ctx.chatId || undefined,
					agent: ctx.agentId || undefined,
					created: now,
					updated: now
				});
				return `Created note: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`;
			}
		}),

		get_notes: tool({
			description:
				'Retrieve all user notes with their IDs. Returns note ID, title, content preview, category, tags, and source for each note.',
			inputSchema: z.object({}),
			execute: async () => {
				const notes = await ctx.db
					.select()
					.from(userNotes)
					.where(eq(userNotes.user, ctx.userId))
					.orderBy(desc(userNotes.created))
					.limit(100);
				if (notes.length === 0) return 'No notes found';

				const notesList = notes.map((note) => {
					const title = note.title || 'Untitled';
					const preview = note.content
						? note.content.substring(0, 100) + (note.content.length > 100 ? '...' : '')
						: 'No content';
					const cat = note.category ? `\n  Category: ${note.category}` : '';
					const src = note.source ? `\n  Source: ${note.source}` : '';
					const tagArr = note.tags as string[] | null;
					const tagStr = tagArr && tagArr.length > 0 ? `\n  Tags: ${tagArr.join(', ')}` : '';
					const pinned = note.pinned ? ' [PINNED]' : '';
					return `• ID: ${note.id}\n  Title: "${title}"${pinned}\n  Preview: ${preview}${cat}${src}${tagStr}`;
				});
				return `Found ${notes.length} note(s):\n\n${notesList.join('\n\n')}`;
			}
		}),

		update_note: tool({
			description:
				"Update a note's title, content, category, tags, or pinned status. Use get_notes first to get the note ID.",
			inputSchema: z.object({
				note_id: z.string().describe('The ID of the note to update (get this from get_notes tool)'),
				title: z.string().optional().describe('The new title for the note'),
				content: z.string().optional().describe('The new content for the note'),
				category: z.string().optional().describe('Updated category label'),
				tags: z.array(z.string()).optional().describe('Updated tags array'),
				pinned: z.boolean().optional().describe('Whether the note should be pinned')
			}),
			execute: async ({
				note_id,
				title,
				content,
				category,
				tags,
				pinned
			}: {
				note_id: string;
				title?: string;
				content?: string;
				category?: string;
				tags?: string[];
				pinned?: boolean;
			}) => {
				const note = await ctx.db.query.userNotes.findFirst({
					columns: { id: true },
					where: and(eq(userNotes.id, note_id), eq(userNotes.user, ctx.userId))
				});
				if (!note) throw new ValidationError('Note not found');

				const updateData: Record<string, unknown> = { updated: new Date().toISOString() };
				if (title !== undefined) updateData.title = title;
				if (content !== undefined) updateData.content = content;
				if (category !== undefined) updateData.category = category;
				if (tags !== undefined) updateData.tags = tags;
				if (pinned !== undefined) updateData.pinned = pinned;

				await ctx.db.update(userNotes).set(updateData).where(eq(userNotes.id, note_id));
				return `Updated note`;
			}
		}),

		delete_note: tool({
			description: 'Delete a note. Use get_notes first to get the note ID.',
			inputSchema: z.object({
				note_id: z.string().describe('The ID of the note to delete (get this from get_notes tool)')
			}),
			execute: async ({ note_id }: { note_id: string }) => {
				const note = await ctx.db.query.userNotes.findFirst({
					columns: { id: true },
					where: and(eq(userNotes.id, note_id), eq(userNotes.user, ctx.userId))
				});
				if (!note) throw new ValidationError('Note not found');
				await ctx.db.delete(userNotes).where(eq(userNotes.id, note_id));
				return `Deleted note`;
			}
		})
	};
}
