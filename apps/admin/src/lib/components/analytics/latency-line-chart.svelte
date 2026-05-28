<script lang="ts">
	import * as Chart from '$lib/components/shadcn/chart/index.js';
	import type { LatencyPoint } from '$lib/types/analytics-charts';
	import { scaleBand } from 'd3-scale';
	import { LineChart } from 'layerchart';
	import { curveLinear } from 'd3-shape';

	interface Props {
		data: LatencyPoint[];
		height?: string;
		color?: string;
		formatValue?: (v: number) => string;
		class?: string;
	}

	let {
		data,
		height = 'h-48',
		color = 'var(--chart-5)',
		formatValue = (v: number) => `${v}ms`,
		class: className = ''
	}: Props = $props();

	const chartConfig = $derived({
		valueMs: { label: 'Latency', color }
	} satisfies Chart.ChartConfig);
</script>

{#if data.length > 1}
	<Chart.Container config={chartConfig} class="aspect-auto {height} w-full {className}">
		<LineChart
			{data}
			x="label"
			xScale={scaleBand()}
			axis="x"
			series={[{ key: 'valueMs', label: 'Latency', color }]}
			props={{
				spline: { curve: curveLinear, motion: 'tween', strokeWidth: 2 },
				xAxis: { format: (v: string) => v },
				highlight: { points: { r: 4 } }
			}}
		>
			{#snippet tooltip()}
				<Chart.Tooltip hideLabel>
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
		</LineChart>
	</Chart.Container>
{:else}
	<div class="flex {height} items-center justify-center text-sm text-muted-foreground {className}">
		Not enough data points
	</div>
{/if}
