<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import {
		ListChecks,
		Plus,
		Trash2
	} from '@lucide/svelte';

	let { config = {} } = $props();

	let newTask = $state('');

	let todos = $state([
		{
			id: '1',
			task: 'Organize desk and do laundry',
			status: 'pending',
			priority: 'high',
			category: 'Work',
			dueDate: '4:00 PM'
		},
		{
			id: '2',
			task: '30 mins cardio + quick stretch',
			status: 'pending',
			priority: 'medium',
			category: 'Personal',
			dueDate: '4:00 PM'
		},
		{
			id: '3',
			task: 'Organize desk and do laundry',
			status: 'completed',
			priority: 'low',
			category: 'Work',
			dueDate: '4:00 PM'
		}
	]);

	const filtered = $derived.by(() => {
		let result = [...todos];

		if (config.filter === 'active') {
			result = result.filter((t) => t.status !== 'completed');
		}

		if (config.filter === 'done') {
			result = result.filter((t) => t.status === 'completed');
		}

		return result;
	});

	function handleCheck(id: string) {
		todos = todos.map((todo) =>
			todo.id === id
				? {
						...todo,
						status:
							todo.status === 'completed'
								? 'pending'
								: 'completed'
					}
				: todo
		);
	}

	function handleAdd() {
		if (!newTask.trim()) return;

		todos = [
			{
				id: crypto.randomUUID(),
				task: newTask,
				status: 'pending',
				priority: 'low',
				category: 'Personal',
				dueDate: '4:00 PM'
			},
			...todos
		];

		newTask = '';
	}

	function handleDelete(id: string) {
		todos = todos.filter((todo) => todo.id !== id);
	}

	function getPriorityStyles(priority: string) {
		switch (priority) {
			case 'high':
				return 'bg-red-600 text-white';

			case 'medium':
				return 'bg-yellow-500 text-white';

			case 'low':
				return 'bg-green-600 text-white';

			default:
				return 'bg-slate-500 text-white';
		}
	}
</script>

<!-- Add Todo -->
<!-- <form
	class="mb-4 flex items-center gap-2"
	onsubmit={(e) => {
		e.preventDefault();
		handleAdd();
	}}
>
	<Input
		bind:value={newTask}
		placeholder="Add a task..."
		class="h-11 rounded-2xl border-slate-200 bg-slate-50 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-violet-300"
	/>

	<Button
		type="submit"
		class="h-11 rounded-2xl bg-slate-100 px-4 text-slate-600 hover:bg-slate-200"
		disabled={!newTask.trim()}
	>
		<Plus class="size-4" />
	</Button>
</form> -->

<!-- Empty -->
{#if filtered.length === 0}
	<div
		class="flex min-h-45 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200"
	>
		<ListChecks class="size-7 text-slate-300" />

		<p class="text-sm font-medium text-slate-400">
			No todos available
		</p>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		{#each filtered as todo (todo.id)}
			<Card.Root
				class="rounded-3xl ring-0 border border-[#F6F6F6]  bg-white shadow-none transition-all hover:shadow-sm"
			>
				<Card.Content class="flex flex-col gap-4 p-4">
					<!-- Top -->
					<div class="flex items-start justify-between gap-4">
						<!-- Left -->
						<div class="flex items-start gap-3">
							<Checkbox
								checked={todo.status === 'completed'}
								onCheckedChange={() => handleCheck(todo.id)}
								class="mt-1 rounded-full"
							/>

							<div class="flex flex-col gap-1">
								<p
									class={`text-lg font-medium leading-5 text-slate-700 ${
										todo.status === 'completed'
											? 'text-slate-400 line-through'
											: ''
									}`}
								>
									{todo.task}
								</p>
							</div>
						</div>

						<!-- Priority -->
						<div
							class={`rounded-full px-4 py-1 text-xs font-semibold capitalize ${getPriorityStyles(
								todo.priority
							)}`}
						>
							{todo.priority}
						</div>
					</div>

					<!-- Bottom -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div
								class="rounded-lg bg-[#F6F6F6] border border-[#F6F6F6] px-3 py-1 text-sm font-medium text-[#83899F]"
							>
								Due - {todo.dueDate}
							</div>

							<div
								class="rounded-lg bg-[#F6F6F6] border border-[#F6F6F6] px-3 py-1 text-sm font-medium text-[#83899F]"
							>
								{todo.category}
							</div>
						</div>

						<button
							class="opacity-0 transition-opacity group-hover:opacity-100"
							onclick={() => handleDelete(todo.id)}
						>
							<Trash2
								class="size-4 text-slate-400 hover:text-red-500"
							/>
						</button>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
{/if}