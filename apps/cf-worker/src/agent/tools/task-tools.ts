import { z } from 'zod';
import { tool } from 'ai';
import { userTodos } from '@repo/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { ValidationError } from '../../utils/errors';
import type { ToolContext } from './types';

export function createTaskTools(ctx: ToolContext) {
	return {
		create_task: tool({
			description: 'Create a new task/todo with title, optional description and due date.',
			inputSchema: z.object({
				title: z.string().describe('The task title'),
				description: z.string().optional().describe('Optional task description'),
				due: z.string().optional().describe('Optional due date (ISO format, e.g., 2024-12-31)')
			}),
			execute: async ({
				title,
				description,
				due
			}: {
				title: string;
				description?: string;
				due?: string;
			}) => {
				const now = new Date().toISOString();
				await ctx.db.insert(userTodos).values({
					id: generateId(),
					user: ctx.userId,
					task: title,
					description: description || undefined,
					dueDate: due || undefined,
					status: 'pending',
					includeInMemory: true,
					created: now,
					updated: now
				});
				return `Created task: "${title}"`;
			}
		}),

		get_tasks: tool({
			description:
				'Retrieve all user tasks with their IDs. Returns task ID, status, title, and optional description for each task.',
			inputSchema: z.object({
				status: z
					.enum(['all', 'pending', 'completed'])
					.optional()
					.default('all')
					.describe('Filter by status: all, pending, or completed')
			}),
			execute: async ({ status }: { status?: 'all' | 'pending' | 'completed' }) => {
				const conditions = [eq(userTodos.user, ctx.userId)];
				if (status === 'pending') conditions.push(eq(userTodos.status, 'pending'));
				if (status === 'completed') conditions.push(eq(userTodos.status, 'completed'));

				const tasks = await ctx.db
					.select()
					.from(userTodos)
					.where(and(...conditions))
					.orderBy(desc(userTodos.created))
					.limit(100);
				if (tasks.length === 0) return 'No tasks found';

				const tasksList = tasks.map((task) => {
					const statusIcon = task.status === 'completed' ? '✓ Completed' : '○ Pending';
					const title = task.task ?? 'Untitled task';
					const desc = task.description ? `\n  Description: "${task.description}"` : '';
					const dueDate = task.dueDate
						? `\n  Due: ${new Date(task.dueDate).toLocaleDateString()}`
						: '';
					return `• ID: ${task.id}\n  Status: ${statusIcon}\n  Title: "${title}"${desc}${dueDate}`;
				});
				return `Found ${tasks.length} task(s):\n\n${tasksList.join('\n\n')}`;
			}
		}),

		update_task: tool({
			description:
				"Update a task's title, description, or due date. Use get_tasks first to get the task ID.",
			inputSchema: z.object({
				task_id: z.string().describe('The ID of the task to update (get this from get_tasks tool)'),
				title: z.string().optional().describe('The new title for the task'),
				description: z.string().optional().describe('The new description for the task'),
				due: z.string().optional().describe('The new due date (ISO format)')
			}),
			execute: async ({
				task_id,
				title,
				description,
				due
			}: {
				task_id: string;
				title?: string;
				description?: string;
				due?: string;
			}) => {
				const task = await ctx.db.query.userTodos.findFirst({
					columns: { id: true },
					where: and(eq(userTodos.id, task_id), eq(userTodos.user, ctx.userId))
				});
				if (!task) throw new ValidationError('Task not found');

				const updateData: Record<string, unknown> = { updated: new Date().toISOString() };
				if (title !== undefined) updateData.task = title;
				if (description !== undefined) updateData.description = description;
				if (due !== undefined) updateData.dueDate = due;

				await ctx.db.update(userTodos).set(updateData).where(eq(userTodos.id, task_id));
				return `Updated task`;
			}
		}),

		toggle_task: tool({
			description: 'Toggle a task between pending and completed status.',
			inputSchema: z.object({
				task_id: z.string().describe('The ID of the task to toggle (get this from get_tasks tool)')
			}),
			execute: async ({ task_id }: { task_id: string }) => {
				const task = await ctx.db.query.userTodos.findFirst({
					columns: { id: true, status: true },
					where: and(eq(userTodos.id, task_id), eq(userTodos.user, ctx.userId))
				});
				if (!task) throw new ValidationError('Task not found');

				const newStatus = task.status === 'completed' ? 'pending' : 'completed';
				await ctx.db
					.update(userTodos)
					.set({ status: newStatus, updated: new Date().toISOString() })
					.where(eq(userTodos.id, task_id));
				return `Task marked as ${newStatus}`;
			}
		}),

		delete_task: tool({
			description: 'Delete a task. Use get_tasks first to get the task ID.',
			inputSchema: z.object({
				task_id: z.string().describe('The ID of the task to delete (get this from get_tasks tool)')
			}),
			execute: async ({ task_id }: { task_id: string }) => {
				const task = await ctx.db.query.userTodos.findFirst({
					columns: { id: true },
					where: and(eq(userTodos.id, task_id), eq(userTodos.user, ctx.userId))
				});
				if (!task) throw new ValidationError('Task not found');
				await ctx.db.delete(userTodos).where(eq(userTodos.id, task_id));
				return `Deleted task`;
			}
		})
	};
}
