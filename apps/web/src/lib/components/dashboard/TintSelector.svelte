<script lang="ts">
	import { Check, RotateCcw } from '@lucide/svelte';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { cn } from '$lib/utils';

	let {
		selectedTint = undefined,
		onSelect
	}: {
		selectedTint?: string;
		onSelect: (tint: string | undefined) => void;
	} = $props();

	const tintOptions = [
		{ value: '', label: 'None', class: 'bg-muted border-border' },
		{ value: '#ef4444', label: 'Red', class: 'bg-red-500 border-red-600' },
		{ value: '#f97316', label: 'Orange', class: 'bg-orange-500 border-orange-600' },
		{ value: '#f59e0b', label: 'Amber', class: 'bg-amber-500 border-amber-600' },
		{ value: '#22c55e', label: 'Green', class: 'bg-green-500 border-green-600' },
		{ value: '#10b981', label: 'Emerald', class: 'bg-emerald-500 border-emerald-600' },
		{ value: '#06b6d4', label: 'Cyan', class: 'bg-cyan-500 border-cyan-600' },
		{ value: '#3b82f6', label: 'Blue', class: 'bg-blue-500 border-blue-600' },
		{ value: '#8b5cf6', label: 'Violet', class: 'bg-violet-500 border-violet-600' },
		{ value: '#d946ef', label: 'Fuchsia', class: 'bg-fuchsia-500 border-fuchsia-600' },
		{ value: '#ec4899', label: 'Pink', class: 'bg-pink-500 border-pink-600' }
	];
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<Label class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
			Accent Color
		</Label>
		{#if selectedTint}
			<Button
				variant="ghost"
				size="sm"
				class="h-auto px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
				onclick={() => onSelect(undefined)}
			>
				<RotateCcw class="mr-1 size-3" /> Reset
			</Button>
		{/if}
	</div>

	<div class="flex flex-wrap gap-2">
		{#each tintOptions as option (option.value)}
			<button
				type="button"
				class={cn(
					'group relative size-7 rounded-full border-2 transition-all hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
					option.class,
					selectedTint === option.value
						? 'ring-2 ring-foreground ring-offset-2 ring-offset-popover'
						: 'opacity-80 hover:opacity-100'
				)}
				onclick={() => onSelect(option.value)}
				title={option.label}
				aria-label="Set tint to {option.label}"
			>
				{#if selectedTint === option.value}
					<span
						class="absolute inset-0 flex items-center justify-center text-white drop-shadow-md"
					>
						<Check class="size-4 stroke-[3px]" />
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>
