<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { ListChecks, Plus, Trash2 } from '@lucide/svelte';
	import { createTodo, deleteTodo, loadTodos, toggleTodoStatus } from '$lib/remote/todo.remote';
	import type { TodoConfig } from '$lib/types/widgets';
	import WidgetError from '../WidgetError.svelte';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';

	const DEFAULT_CONFIG: TodoConfig = {
		filter: 'active',
		sortBy: 'date',
		limit: 10
	};

	let {
		config,
		showInput = $bindable(false)
	}: {
		config?: TodoConfig;
		showInput?: boolean;
	} = $props();

	let resolvedConfig = $derived.by((): TodoConfig => ({ ...DEFAULT_CONFIG, ...(config ?? {}) }));

	let newTask = $state('');
	let adding = $state(false);

	const todos = loadTodos();

	const filtered = $derived.by(() => {
		const items = todos.current ?? [];
		let result = [...items];

		if (resolvedConfig.category) {
			result = result.filter((todo) => todo.category === resolvedConfig.category);
		}

		if (resolvedConfig.filter === 'active') {
			result = result.filter((todo) => todo.status !== 'completed' && todo.status !== 'cancelled');
		} else if (resolvedConfig.filter === 'done') {
			result = result.filter((todo) => todo.status === 'completed');
		}

		if (resolvedConfig.sortBy === 'priority') {
			const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
			result.sort(
				(a, b) => (order[a.priority ?? 'low'] ?? 3) - (order[b.priority ?? 'low'] ?? 3)
			);
		} else {
			result.sort(
				(a, b) => new Date(b.created ?? 0).getTime() - new Date(a.created ?? 0).getTime()
			);
		}

		return result.slice(0, resolvedConfig.limit);
	});

	function formatDueDate(dateStr: string): string {
		const diffDays = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
		if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Tomorrow';
		return `in ${diffDays}d`;
	}

	function getPriorityStyles(priority: string | null | undefined) {
		switch (priority) {
			case 'urgent':
				return 'bg-[#7A1C1C] text-[#FFE4E0]';
			case 'high':
				return 'bg-[#E04438] text-[#FFF3F2]';
			case 'medium':
				return 'bg-[#F79009] text-[#FFF7E6]';
			case 'low':
				return 'bg-[#12B76A] text-[#ECFDF3]';
			default:
				return 'bg-slate-500 text-white';
		}
	}

	async function handleCheck(todo: { id: string; status: string | null }) {
		const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
		try {
			await toggleTodoStatus({ todoId: todo.id, status: newStatus });
		} catch {
			/* error surfaced through query state */
		}
	}

	async function handleAdd() {
		if (!newTask.trim() || adding) return;
		adding = true;
		try {
			await createTodo({ task: newTask.trim(), category: resolvedConfig.category });
			newTask = '';
			showInput = false;
		} catch {
			/* error surfaced through query state */
		} finally {
			adding = false;
		}
	}

	async function handleDelete(id: string) {
		try {
			await deleteTodo({ todoId: id });
		} catch {
			/* error surfaced through query state */
		}
	}
</script>

{#if todos.loading && !todos.current}
	<WidgetSkeleton lines={4} />
{:else if todos.error}
	<WidgetError message={todos.error?.message ?? 'Failed to load todos'} onRetry={() => loadTodos().refresh()} />
{:else if filtered.length === 0 && !showInput}
	<div class="flex min-h-45 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200">
		<ListChecks class="size-7 text-slate-300" />
		<p class="text-sm font-medium text-slate-400">No todos available</p>
		<Button variant="ghost" class="rounded-xl text-sm text-[#83899F] hover:bg-[#F6F6F6]" onclick={() => (showInput = true)}>
			<Plus class="size-4" />
			Add task
		</Button>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		{#if showInput}
			<div class="flex items-center gap-2">
				<Input
					bind:value={newTask}
					placeholder="What needs to be done?"
					class="flex-1 rounded-2xl border-[#F6F6F6] bg-[#F6F6F6] px-4 py-2 text-sm focus-visible:ring-0"
					onkeydown={(event) => {
						if (event.key === 'Enter') handleAdd();
					}}
				/>
				<Button
					size="icon"
					variant="ghost"
					class="size-9 shrink-0 rounded-xl bg-[#F6F6F6] text-[#83899F] hover:bg-slate-200 hover:text-slate-700"
					onclick={handleAdd}
					disabled={!newTask.trim() || adding}
				>
					<Plus class="size-4" />
				</Button>
			</div>
		{/if}

		{#each filtered as todo (todo.id)}
			<Card.Root class="group rounded-3xl border border-[#F6F6F6] bg-white p-1 shadow-none ring-0 transition-all hover:shadow-sm">
				<Card.Content class="flex flex-col gap-3 p-3">
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-start gap-3">
							<Checkbox
								checked={todo.status === 'completed'}
								onCheckedChange={() => handleCheck(todo)}
								class="mt-1 rounded-full"
							/>

							<div class="flex flex-col gap-1">
								<p class={`text-lg leading-5 font-medium text-slate-700 ${todo.status === 'completed' ? 'text-slate-400 line-through' : ''}`}>
									{todo.task}
								</p>
							</div>
						</div>

						<div class={`rounded-full px-4 py-1 text-xs font-semibold capitalize ${getPriorityStyles(todo.priority)}`}>
							{todo.priority}
						</div>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							{#if todo.dueDate}
								<div class="rounded-lg border border-[#F6F6F6] bg-[#F6F6F6] px-3 py-1 text-sm font-medium text-[#83899F]">
									Due - {formatDueDate(todo.dueDate)}
								</div>
							{/if}

							{#if todo.category}
								<div class="rounded-2xl border border-[#F6F6F6] px-3 py-1 text-sm font-medium text-[#83899F]">
									{todo.category}
								</div>
							{/if}
						</div>

						<button class="size-8 rounded-lg text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500" onclick={() => handleDelete(todo.id)}>
							<Trash2 class="size-4" />
						</button>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
{/if}