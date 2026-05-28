<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import { ListChecks, Plus, Trash2 } from '@lucide/svelte';

	let { config = {}, showInput = $bindable(false) } = $props();

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
						status: todo.status === 'completed' ? 'pending' : 'completed'
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
		showInput = false;
	}

	function handleDelete(id: string) {
		todos = todos.filter((todo) => todo.id !== id);
	}

	function getPriorityStyles(priority: string) {
		switch (priority) {
			case 'high':
				return 'bg-red-600 text-[#FFDAD8]';

			case 'medium':
				return 'bg-yellow-500 text-[#FFF1D2]';

			case 'low':
				return 'bg-green-600 text-[#EDFFEF]';

			default:
				return 'bg-slate-500 text-white';
		}
	}
</script>

<!-- Empty -->
{#if filtered.length === 0 && !showInput}
	<div
		class="flex min-h-45 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200"
	>
		<ListChecks class="size-7 text-slate-300" />

		<p class="text-sm font-medium text-slate-400">No todos available</p>

		<Button
			variant="ghost"
			class="rounded-xl text-sm text-[#83899F] hover:bg-[#F6F6F6]"
			onclick={() => (showInput = true)}
		>
			<Plus class="size-4" />
			Add task
		</Button>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		<!-- Add toggle / input row -->
		{#if showInput}
			<div class="flex items-center gap-2">
				<Input
					bind:value={newTask}
					placeholder="What needs to be done?"
					class="flex-1 rounded-2xl border-[#F6F6F6] bg-[#F6F6F6] px-4 py-2 text-sm focus-visible:ring-0"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleAdd();
					}}
				/>
				<Button
					size="icon"
					variant="ghost"
					class="size-9 shrink-0 rounded-xl bg-[#F6F6F6] text-[#83899F] hover:bg-slate-200 hover:text-slate-700"
					onclick={handleAdd}
				>
					<Plus class="size-4" />
				</Button>
			</div>
		{/if}

		{#each filtered as todo (todo.id)}
			<Card.Root class="group rounded-3xl border border-[#F6F6F6] bg-white p-1 shadow-none ring-0">
				<Card.Content class="flex flex-col gap-3 p-3">
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
									class={`text-lg leading-5 font-medium text-slate-700 ${
										todo.status === 'completed' ? 'text-slate-400 line-through' : ''
									}`}
								>
									{todo.task}
								</p>
							</div>
						</div>

						<!-- Priority -->
						<div
							class={`rounded-full px-4 py-1.5 text-xs font-medium capitalize ${getPriorityStyles(
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
								class="rounded-lg border border-[#F6F6F6] bg-[#F6F6F6] px-3 py-1 text-sm font-medium text-[#83899F]"
							>
								Due - {todo.dueDate}
							</div>

							<div
								class="rounded-2xl border border-[#F6F6F6] px-3 py-1 text-sm font-medium text-[#83899F]"
							>
								{todo.category}
							</div>
						</div>

						<Button
							size="icon"
							variant="ghost"
							class="size-8 rounded-lg text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
							onclick={() => handleDelete(todo.id)}
						>
							<Trash2 class="size-4" />
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
{/if}
