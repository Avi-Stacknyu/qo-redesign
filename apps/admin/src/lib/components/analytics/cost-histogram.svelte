<script module lang="ts">
	export {
		formatHistogramAxisLabel as formatCostHistogramAxisLabel,
		formatHistogramTooltipBucketLabel as formatCostHistogramTooltipBucketLabel
	} from '$lib/types/analytics-charts';
</script>

<script lang="ts">
	import * as Chart from '$lib/components/shadcn/chart/index.js';
	import {
		buildHistogramChartData,
		formatHistogramAxisLabel as formatCostHistogramAxisLabel,
		formatHistogramTooltipBucketLabel as formatCostHistogramTooltipBucketLabel,
		type HistogramBucket
	} from '$lib/types/analytics-charts';
	import { scaleBand } from 'd3-scale';
	import { BarChart, Highlight } from 'layerchart';
	import { cubicInOut } from 'svelte/easing';

	interface Props {
		data: HistogramBucket[];
		class?: string;
	}

	let { data, class: className = '' }: Props = $props();

	const totalChats = $derived(data.reduce((sum, bucket) => sum + bucket.count, 0));
	const chartData = $derived(buildHistogramChartData(data));

	const chartConfig = {
		count: { label: 'Chats', color: 'var(--chart-1)' }
	} satisfies Chart.ChartConfig;
</script>

{#if chartData.length > 0}
	<Chart.Container config={chartConfig} class="aspect-auto h-56 w-full {className}">
		<BarChart
			data={chartData}
			x="rangeLabel"
			xScale={scaleBand().padding(0.15)}
			axis="x"
			series={[{ key: 'count', label: 'Chats', color: chartConfig.count.color }]}
			props={{
				bars: {
					stroke: 'none',
					rounded: 'top',
					motion: {
						y: { type: 'tween', duration: 400, easing: cubicInOut },
						height: { type: 'tween', duration: 400, easing: cubicInOut }
					}
				},
				highlight: { area: { fill: 'none' } },
				xAxis: {
					format: (value: string) => formatCostHistogramAxisLabel(chartData, value)
				},
				yAxis: { format: () => '' }
			}}
		>
			<!-- Documented exception: keep the hover highlight local so bucket emphasis stays aligned with the normalized histogram bins. -->
			{#snippet belowMarks()}
				<Highlight area={{ class: 'fill-muted' }} />
			{/snippet}
			<!-- Documented exception: the tooltip stays local because each bucket label is derived from the normalized server bucket range, not a flat series label. -->
			{#snippet tooltip()}
				<Chart.Tooltip
					labelFormatter={(value: string) =>
						formatCostHistogramTooltipBucketLabel(chartData, value)}
				>
					{#snippet formatter({ value })}
						{@const count = Number(value)}
						{@const sharePct = totalChats > 0 ? (count / totalChats) * 100 : 0}
						<div class="flex flex-col gap-1.5 leading-none">
							<div class="flex items-center justify-between gap-4">
								<span class="text-xs text-muted-foreground">Chats</span>
								<span class="font-mono text-sm font-semibold text-foreground tabular-nums">
									{count}
								</span>
							</div>
							{#if totalChats > 0}
								<div class="flex items-center gap-2">
									<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
										<div
											class="h-full rounded-full"
											style="width: {sharePct}%; background: var(--chart-1)"
										></div>
									</div>
									<span class="text-[10px] text-muted-foreground tabular-nums"
										>{sharePct.toFixed(1)}%</span
									>
								</div>
							{/if}
						</div>
					{/snippet}
				</Chart.Tooltip>
			{/snippet}
		</BarChart>
	</Chart.Container>
{:else}
	<div class="flex h-56 items-center justify-center text-sm text-muted-foreground {className}">
		No data available
	</div>
{/if}
