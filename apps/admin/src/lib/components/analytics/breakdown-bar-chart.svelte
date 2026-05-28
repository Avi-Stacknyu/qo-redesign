<script lang="ts">
	import * as Chart from '$lib/components/shadcn/chart/index.js';
	import {
		normalizeBreakdownMetricRows,
		type BreakdownMetricInput
	} from '$lib/types/analytics-charts';
	import { scaleBand } from 'd3-scale';
	import { BarChart } from 'layerchart';
	import { cubicInOut } from 'svelte/easing';

	interface Props {
		data: BreakdownMetricInput[];
		height?: string;
		color?: string;
		valueLabel?: string;
		formatValue?: (v: number) => string;
		class?: string;
	}

	let {
		data,
		height = 'h-64',
		color = 'var(--chart-2)',
		valueLabel = 'Value',
		formatValue = (v: number) => v.toLocaleString(),
		class: className = ''
	}: Props = $props();

	const chartData = $derived(normalizeBreakdownMetricRows(data));

	const chartConfig = $derived({
		value: { label: valueLabel, color }
	} satisfies Chart.ChartConfig);
</script>

{#if chartData.length > 0}
	<Chart.Container config={chartConfig} class="aspect-auto {height} w-full {className}">
		<BarChart
			data={chartData}
			x="key"
			xScale={scaleBand().padding(0.3)}
			axis="x"
			series={[{ key: 'value', label: valueLabel, color }]}
			props={{
				bars: {
					stroke: 'none',
					motion: {
						y: { type: 'tween', duration: 500, easing: cubicInOut },
						height: { type: 'tween', duration: 500, easing: cubicInOut }
					}
				},
				xAxis: {
					format: (value: string) => chartData.find((entry) => entry.key === value)?.label ?? value
				},
				yAxis: { format: () => '' }
			}}
		>
			{#snippet tooltip()}
				<Chart.Tooltip
					labelFormatter={(value: string | number) =>
						chartData.find((entry) => entry.key === value)?.label ?? `${value}`}
				>
					{#snippet formatter({ value, name })}
						<div class="flex flex-1 shrink-0 justify-between gap-2 leading-none">
							<span class="text-muted-foreground">{name}</span>
							<span class="font-mono font-medium text-foreground tabular-nums"
								>{formatValue(Number(value))}</span
							>
						</div>
					{/snippet}
				</Chart.Tooltip>
			{/snippet}
		</BarChart>
	</Chart.Container>
{:else}
	<div class="flex {height} items-center justify-center text-sm text-muted-foreground">
		No data available
	</div>
{/if}
