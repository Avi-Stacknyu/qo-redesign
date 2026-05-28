<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Plus, X } from '@lucide/svelte';

	let {
		values = [],
		onchange
	}: {
		values: string[];
		onchange: (values: string[]) => void;
	} = $props();

	let input = $state('');

	function add() {
		const text = input.trim();
		if (!text || values.includes(text)) return;
		onchange([...values, text]);
		input = '';
	}

	function remove(r: string) {
		onchange(values.filter((x) => x !== r));
	}
</script>

<div>
	<p class="mb-1.5 text-xs text-muted-foreground">Responsibilities</p>
	<div class="flex gap-2">
		<Input
			bind:value={input}
			placeholder="Add responsibility…"
			class="text-sm"
			onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
		/>
		<Button size="sm" variant="outline" onclick={add}>
			<Plus class="size-3.5" />
		</Button>
	</div>
	{#if values.length > 0}
		<div class="mt-2 flex flex-wrap gap-1.5">
			{#each values as r}
				<Badge variant="secondary" class="gap-1 text-[10px]">
					{r}
					<button onclick={() => remove(r)} class="hover:text-destructive">
						<X class="size-2.5" />
					</button>
				</Badge>
			{/each}
		</div>
	{/if}
</div>
