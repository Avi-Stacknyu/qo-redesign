<script lang="ts">
	import * as Chart from '$lib/components/shadcn/chart/index.js';
	import {
		buildModelTrendChartData,
		formatUtcDayLabel,
		type ModelTrendChart
	} from '$lib/types/analytics-charts';
	import { scaleUtc } from 'd3-scale';
	import { curveLinear } from 'd3-shape';
	import { Area, AreaChart } from 'layerchart';

	interface Props {
		data: ModelTrendChart;
		height?: string;
		gradientPrefix?: string;
		formatValue?: (value: number) => string;
		class?: string;
	}

	let {
		data,
		height = 'h-72',
		gradientPrefix = 'fillModelTrend',
		formatValue = (value: number) =>
			value.toLocaleString('en-US', {
				style: 'currency',
				currency: 'USD',
				minimumFractionDigits: 2,
				maximumFractionDigits: 4
			}),
		class: className = ''
	}: Props = $props();

	const chartData = $derived(buildModelTrendChartData(data));
	const chartSeries = $derived(data.series);

	const chartConfig = $derived.by(() => {
		const config: Chart.ChartConfig = {};
		for (const series of chartSeries) {
			config[series.key] = {
				label: series.label,
				color: series.color
			};
		}
		return config;
	});

	function gradientIdFor(key: string) {
		const normalizedKey = key
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');

		return `${gradientPrefix}-${normalizedKey || 'series'}`;
	}
</script>

{#if chartData.length > 0 && chartSeries.length > 0}
	<div class="space-y-3 {className}">
		<!-- Documented exception: keep a local legend because hover state and always-visible series keys need more control than the built-in legend provides. -->
		<div class="flex flex-wrap gap-3">
			{#each chartSeries as series (series.key)}
				<div class="flex items-center gap-1.5 text-xs">
					<span class="h-2.5 w-2.5 rounded-full" style="background: {series.color}"></span>
					<span class="text-muted-foreground">{series.label}</span>
				</div>
			{/each}
		</div>

		<Chart.Container config={chartConfig} class="aspect-auto {height} w-full">
			<AreaChart
				data={chartData}
				x="dayDate"
				xScale={scaleUtc()}
				series={chartSeries}
				props={{
					area: {
						curve: curveLinear,
						'fill-opacity': 0.45,
						line: { class: 'stroke-1' },
						motion: 'tween'
					},
					xAxis: {
						format: (value: Date) => formatUtcDayLabel(value, { month: 'short', day: 'numeric' })
					},
					yAxis: { format: () => '' }
				}}
			>
				<!-- Documented exception: each series keeps a local gradient fill because the simplified multi-series area API does not express per-series gradients. -->
				{#snippet marks({ context: chartContext })}
					<defs>
						{#each chartSeries as series (series.key)}
							<linearGradient id={gradientIdFor(series.key)} x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stop-color={series.color} stop-opacity={0.4} />
								<stop offset="95%" stop-color={series.color} stop-opacity={0.02} />
							</linearGradient>
						{/each}
					</defs>
					{#each chartContext.series.visibleSeries as series (series.key)}
						<Area
							{...series.props}
							seriesKey={series.key}
							curve={curveLinear}
							fillOpacity={0.45}
							line={{ class: 'stroke-1' }}
							motion="tween"
							fill={`url(#${gradientIdFor(series.key)})`}
						/>
					{/each}
				{/snippet}
				{#snippet tooltip()}
					<Chart.Tooltip
						labelFormatter={(value: Date) =>
							formatUtcDayLabel(value, {
								weekday: 'short',
								month: 'short',
								day: 'numeric'
							})}
						indicator="dot"
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
			</AreaChart>
		</Chart.Container>
	</div>
{:else}
	<div class="flex {height} items-center justify-center text-sm text-muted-foreground {className}">
		No model trend data available
	</div>
{/if}
