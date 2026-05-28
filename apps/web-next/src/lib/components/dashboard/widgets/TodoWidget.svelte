<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ListChecks, Plus, Trash2 } from '@lucide/svelte';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import WidgetError from '../WidgetError.svelte';
	import { loadTodos, createTodo, toggleTodoStatus, deleteTodo } from '$lib/remote/todo.remote';
	import type { TodoConfig } from '$lib/types/widgets';

	let { config }: { config: TodoConfig } = $props();

	let newTask = $state('');
	let adding = $state(false);

	const todos = loadTodos();

	let filtered = $derived.by(() => {
		const items = todos.current ?? [];
		let result = [...items];

		if (config.category) {
			result = result.filter((t) => t.category === config.category);
		}

		if (config.filter === 'active') {
			result = result.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
		} else if (config.filter === 'done') {
			result = result.filter((t) => t.status === 'completed');
		}

		if (config.sortBy === 'priority') {
			const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
			result.sort((a, b) => (order[a.priority ?? 'low'] ?? 3) - (order[b.priority ?? 'low'] ?? 3));
		} else {
			result.sort((a, b) => new Date(b.created ?? 0).getTime() - new Date(a.created ?? 0).getTime());
		}

		return result.slice(0, config.limit);
	});

	function formatDueDate(dateStr: string): string {
		const diffDays = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
		if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Tomorrow';
		return `in ${diffDays}d`;
	}

	async function handleCheck(todo: { id: string; status: string | null }) {
		const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
		try {
			await toggleTodoStatus({ todoId: todo.id, status: newStatus });
		} catch {
			/* error propagated via query.error */
		}
	}

	async function handleAdd() {
		if (!newTask.trim() || adding) return;
		adding = true;
		try {
			await createTodo({ task: newTask.trim(), category: config.category });
			newTask = '';
		} catch {
			/* error propagated via query.error */
		} finally {
			adding = false;
		}
	}

	async function handleDelete(id: string) {
		try {
			await deleteTodo({ todoId: id });
		} catch {
			/* error propagated via query.error */
		}
	}
</script>

{#if todos.loading && !todos.current}
	<WidgetSkeleton lines={4} />
{:else if todos.error}
	<WidgetError
		message={todos.error?.message ?? 'Failed to load todos'}
		onRetry={() => loadTodos().refresh()}
	/>
{:else}
	<!-- Inline Add -->
	<form
		class="mb-3 flex items-center gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			handleAdd();
		}}
	>
		<Input
			placeholder="Add a task..."
			class="h-8 flex-1 border-border/40 bg-muted/20 text-sm"
			bind:value={newTask}
			disabled={adding}
		/>
		<Button
			variant="ghost"
			size="icon"
			class="size-8 shrink-0"
			type="submit"
			disabled={!newTask.trim() || adding}
		>
			<Plus class="size-3.5" />
		</Button>
	</form>

	{#if filtered.length === 0}
		<div class="flex min-h-16 flex-col items-center justify-center gap-2 p-4">
			<ListChecks class="size-6 text-muted-foreground/50" />
			<p class="text-sm text-muted-foreground">No matching todos</p>
		</div>
	{:else}
		<div class="flex flex-col gap-1">
			{#each filtered as todo (todo.id)}
				<div
					class="group/todo flex items-start gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted/40"
				>
					<Checkbox
						checked={todo.status === 'completed'}
						onCheckedChange={() => handleCheck(todo)}
						aria-label="Toggle {todo.task}"
						class="mt-0.5"
					/>
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span
							class="text-sm leading-tight {todo.status === 'completed'
								? 'text-muted-foreground line-through'
								: 'text-foreground'}"
						>
							{todo.task}
						</span>
						{#if todo.dueDate}
							<span class="text-[0.65rem] text-muted-foreground">
								{formatDueDate(todo.dueDate)}
							</span>
						{/if}
					</div>
					<button
						class="mt-0.5 opacity-0 transition-opacity group-hover/todo:opacity-100"
						onclick={() => handleDelete(todo.id)}
						aria-label="Delete todo"
					>
						<Trash2 class="size-3.5 text-muted-foreground hover:text-destructive" />
					</button>
				</div>
			{/each}
		</div>
	{/if}
{/if}
