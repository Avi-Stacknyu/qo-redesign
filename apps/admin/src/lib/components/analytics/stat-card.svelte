<script lang="ts">
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { TrendingUp, TrendingDown, Minus } from '@lucide/svelte';
	interface Props {
		title: string;
		value: string;
		subtitle?: string;
		changePercent?: number | null;
		icon?: any;
		class?: string;
	}

	let {
		title,
		value,
		subtitle,
		changePercent = null,
		icon: Icon,
		class: className = ''
	}: Props = $props();

	const trendColor = $derived(
		changePercent === null || changePercent === undefined
			? ''
			: changePercent > 0
				? 'text-red-500'
				: changePercent < 0
					? 'text-green-500'
					: 'text-muted-foreground'
	);

	const changeLabel = $derived(
		changePercent === null || changePercent === undefined
			? null
			: `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`
	);
</script>

<Card.Root class={className}>
	<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
		<Card.Title class="text-sm font-medium">{title}</Card.Title>
		{#if Icon}
			<Icon class="h-4 w-4 text-muted-foreground" />
		{/if}
	</Card.Header>
	<Card.Content>
		<div class="text-2xl font-bold">{value}</div>
		<div class="flex items-center gap-1.5 pt-1">
			{#if changeLabel !== null}
				<span class="flex items-center gap-0.5 text-xs font-medium {trendColor}">
					{#if changePercent! > 0}
						<TrendingUp class="h-3 w-3" />
					{:else if changePercent! < 0}
						<TrendingDown class="h-3 w-3" />
					{:else}
						<Minus class="h-3 w-3" />
					{/if}
					{changeLabel}
				</span>
				<span class="text-xs text-muted-foreground">vs prev period</span>
			{:else if subtitle}
				<p class="text-xs text-muted-foreground">{subtitle}</p>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
