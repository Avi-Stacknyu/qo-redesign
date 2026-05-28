<script module lang="ts">
	import {
		formatSpendAreaAxisDayLabel as formatSpendAreaAxisDayLabelImpl,
		formatSpendAreaTooltipDayLabel as formatSpendAreaTooltipDayLabelImpl
	} from '$lib/types/analytics-charts';

	export function formatSpendAreaAxisDayLabel(day: Date): string {
		return formatSpendAreaAxisDayLabelImpl(day);
	}

	export function formatSpendAreaTooltipDayLabel(day: Date): string {
		return formatSpendAreaTooltipDayLabelImpl(day);
	}
</script>

<script lang="ts">
	import * as Chart from '$lib/components/shadcn/chart/index.js';
	import {
		formatSpendAreaAxisDayLabel as formatSpendAreaAxisDayLabelInternal,
		formatSpendAreaTooltipDayLabel as formatSpendAreaTooltipDayLabelInternal,
		type TimeSeriesSpendPoint
	} from '$lib/types/analytics-charts';
	import { scaleUtc } from 'd3-scale';
	import { curveLinear } from 'd3-shape';
	import { Area, AreaChart } from 'layerchart';

	interface Props {
		data: TimeSeriesSpendPoint[];
		height?: string;
		gradientId?: string;
		color?: string;
		label?: string;
		class?: string;
	}

	let {
		data,
		height = 'h-64',
		gradientId = 'fillSpendArea',
		color = 'var(--chart-1)',
		label = 'Spend (USD)',
		class: className = ''
	}: Props = $props();

	const chartConfig = $derived({
		costUsd: { label, color }
	} satisfies Chart.ChartConfig);

	const chartData = $derived(
		data.map((p) => ({
			date: new Date(`${p.day}T00:00:00Z`),
			costUsd: p.costUsd
		}))
	);

	function formatUsd(value: number) {
		return value.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 4
		});
	}
</script>

{#if chartData.length > 0}
	<Chart.Container config={chartConfig} class="aspect-auto {height} w-full {className}">
		<AreaChart
			data={chartData}
			x="date"
			xScale={scaleUtc()}
			series={[{ key: 'costUsd', label, color }]}
			props={{
				area: {
					curve: curveLinear,
					'fill-opacity': 0.35,
					line: { class: 'stroke-1' }
				},
				xAxis: {
					format: formatSpendAreaAxisDayLabelInternal
				},
				yAxis: { format: () => '' }
			}}
		>
			<!-- Documented exception: keep the gradient area fill local because the simplified API only supports flat fills. -->
			{#snippet marks({ context: chartContext })}
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stop-color="var(--color-costUsd)" stop-opacity={1.0} />
						<stop offset="95%" stop-color="var(--color-costUsd)" stop-opacity={0.1} />
					</linearGradient>
				</defs>
				{#each chartContext.series.visibleSeries as s (s.key)}
					<Area
						{...s.props}
						seriesKey={s.key}
						curve={curveLinear}
						fillOpacity={0.35}
						line={{ class: 'stroke-1' }}
						fill={`url(#${gradientId})`}
					/>
				{/each}
			{/snippet}
			{#snippet tooltip()}
				<Chart.Tooltip labelFormatter={formatSpendAreaTooltipDayLabelInternal} indicator="line">
					{#snippet formatter({ value, name })}
						<div class="flex flex-1 shrink-0 justify-between gap-2 leading-none">
							<span class="text-muted-foreground">{name}</span>
							<span class="font-mono font-medium text-foreground tabular-nums"
								>{formatUsd(Number(value))}</span
							>
						</div>
					{/snippet}
				</Chart.Tooltip>
			{/snippet}
		</AreaChart>
	</Chart.Container>
{:else}
	<div class="flex {height} items-center justify-center text-sm text-muted-foreground">
		Not enough data points for chart
	</div>
{/if}
