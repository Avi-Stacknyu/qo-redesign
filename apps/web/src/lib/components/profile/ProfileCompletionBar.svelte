<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		value,
		max = 100,
		label,
		size = 'sm'
	}: {
		value: number;
		max?: number;
		label?: string;
		size?: 'sm' | 'md';
	} = $props();

	let pct = $derived(max > 0 ? Math.round((value / max) * 100) : 0);
	let barColor = $derived(pct >= 70 ? 'bg-emerald-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-400');
	let textColor = $derived(
		pct >= 70
			? 'text-emerald-600 dark:text-emerald-400'
			: pct >= 30
				? 'text-amber-600 dark:text-amber-400'
				: 'text-red-600 dark:text-red-400'
	);
</script>

<div class="flex items-center gap-2">
	{#if label}
		<span class="text-xs text-muted-foreground">{label}</span>
	{/if}
	<div
		class={cn(
			'relative flex-1 overflow-hidden rounded-full bg-primary/10',
			size === 'sm' ? 'h-1.5' : 'h-2'
		)}
	>
		<div
			class={cn('h-full rounded-full transition-all duration-300', barColor)}
			style="width: {pct}%"
		></div>
	</div>
	<span class={cn('min-w-[2.5rem] text-right text-xs font-medium tabular-nums', textColor)}>
		{pct}%
	</span>
</div>
