<script lang="ts">
	import * as Chart from '$lib/components/shadcn/chart/index.js';
	import type { TokenBreakdownRow } from '$lib/types/analytics-charts';
	import { scaleBand } from 'd3-scale';
	import { BarChart } from 'layerchart';
	import { cubicInOut } from 'svelte/easing';

	interface Props {
		data: TokenBreakdownRow[];
		height?: string;
		class?: string;
	}

	let { data, height = 'h-48', class: className = '' }: Props = $props();

	const segments = [
		{ key: 'inputTokens' as const, label: 'Input', color: 'var(--chart-1)' },
		{ key: 'outputTokens' as const, label: 'Output', color: 'var(--chart-2)' },
		{ key: 'cachedTokens' as const, label: 'Cached', color: 'var(--chart-3)' },
		{ key: 'reasoningTokens' as const, label: 'Reasoning', color: 'var(--chart-4)' }
	];

	// Filter to only segments that exist in data
	const activeSegments = $derived(
		segments.filter((seg) => data.some((d) => (d[seg.key] ?? 0) > 0))
	);

	const chartConfig = $derived.by(() => {
		const config: Chart.ChartConfig = {};
		for (const seg of activeSegments) {
			config[seg.key] = { label: seg.label, color: seg.color };
		}
		return config;
	});

	const series = $derived(
		activeSegments.map((seg) => ({
			key: seg.key,
			label: seg.label,
			color: seg.color
		}))
	);

	function formatCompact(value: number) {
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
		return value.toLocaleString();
	}
</script>

{#if data.length > 0}
	<Chart.Container config={chartConfig} class="aspect-auto {height} w-full {className}">
		<BarChart
			{data}
			x="label"
			xScale={scaleBand().padding(0.2)}
			axis="x"
			{series}
			seriesLayout="stack"
			props={{
				bars: {
					stroke: 'none',
					motion: {
						y: { type: 'tween', duration: 500, easing: cubicInOut },
						height: { type: 'tween', duration: 500, easing: cubicInOut }
					}
				},
				xAxis: { format: (v: string) => v },
				yAxis: { format: () => '' }
			}}
		>
			{#snippet tooltip()}
				<Chart.Tooltip>
					{#snippet formatter({ value, name })}
						<div class="flex flex-1 shrink-0 justify-between gap-2 leading-none">
							<span class="text-muted-foreground">{name}</span>
							<span class="font-mono font-medium text-foreground tabular-nums"
								>{formatCompact(Number(value))}</span
							>
						</div>
					{/snippet}
				</Chart.Tooltip>
			{/snippet}
		</BarChart>
	</Chart.Container>
{:else}
	<div class="flex {height} items-center justify-center text-sm text-muted-foreground {className}">
		No data available
	</div>
{/if}
