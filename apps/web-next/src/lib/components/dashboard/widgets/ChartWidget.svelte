<script lang="ts">
	import { AreaChart, BarChart, LineChart, PieChart } from 'layerchart';
	import { scaleUtc, scaleBand } from 'd3-scale';
	import { curveNatural, curveLinearClosed } from 'd3-shape';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { loadWidgetData } from '$lib/remote/widget-data.remote';
	import type { ChartConfig } from '$lib/types/widgets';
	import type { ResolvedData } from '@repo/shared/types';

	let { config }: { config: ChartConfig } = $props();

	// ── Resolved data (from data layer) ──────────────────────────────────────────
	let resolvedQuery = $derived(
		config.dataSource
			? loadWidgetData({
					type: (config.dataSourceType ?? 'static') as import('@repo/shared/types').DataSourceType,
					source_id: config.dataSource
				})
			: undefined
	);

	let resolvedData: ResolvedData | null | undefined = $derived(
		resolvedQuery?.current &&
			typeof resolvedQuery.current === 'object' &&
			'rows' in resolvedQuery.current
			? (resolvedQuery.current as ResolvedData)
			: null
	);

	// Build chart-ready data from resolved data
	let chartData = $derived.by(() => {
		if (!resolvedData?.rows?.length) return null;
		return resolvedData.rows.map((row) => {
			const entry: Record<string, unknown> = { ...row };
			for (const col of resolvedData!.columns) {
				if (col.type === 'date' && typeof entry[col.key] === 'string') {
					entry[col.key] = new Date(entry[col.key] as string);
				}
				if (col.type === 'number' && typeof entry[col.key] === 'string') {
					entry[col.key] = Number(entry[col.key]);
				}
			}
			return entry;
		});
	});

	let hasDateColumn = $derived(
		chartData ? (resolvedData?.columns?.some((c) => c.type === 'date') ?? false) : true
	);

	let resolvedValueKey = $derived(
		resolvedData?.columns?.find((c) => c.type === 'number')?.key ?? 'value'
	);
	let resolvedXKey = $derived(
		resolvedData?.columns?.find((c) => c.type === 'date')?.key ??
			resolvedData?.columns?.find((c) => c.type === 'string')?.key ??
			'date'
	);

	// ── Fallback demo data ───────────────────────────────────────────────────────

	const chartConfig = {
		value: { label: 'Value', color: 'var(--chart-1)' },
		secondary: { label: 'Secondary', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;

	const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

	const timeData = [
		{ date: new Date('2024-01-01'), month: 'January', value: 186 },
		{ date: new Date('2024-02-01'), month: 'February', value: 305 },
		{ date: new Date('2024-03-01'), month: 'March', value: 237 },
		{ date: new Date('2024-04-01'), month: 'April', value: 173 },
		{ date: new Date('2024-05-01'), month: 'May', value: 209 },
		{ date: new Date('2024-06-01'), month: 'June', value: 264 }
	];

	const pieData = [
		{ month: 'jan', value: 186, color: 'var(--chart-1)' },
		{ month: 'feb', value: 305, color: 'var(--chart-2)' },
		{ month: 'mar', value: 237, color: 'var(--chart-3)' },
		{ month: 'apr', value: 173, color: 'var(--chart-4)' },
		{ month: 'may', value: 209, color: 'var(--chart-5)' }
	];

	const pieConfig = {
		value: { label: 'Value' },
		jan: { label: 'Jan', color: 'var(--chart-1)' },
		feb: { label: 'Feb', color: 'var(--chart-2)' },
		mar: { label: 'Mar', color: 'var(--chart-3)' },
		apr: { label: 'Apr', color: 'var(--chart-4)' },
		may: { label: 'May', color: 'var(--chart-5)' }
	} satisfies Chart.ChartConfig;

	const series = [{ key: 'value', label: 'Value', color: chartConfig.value.color }];

	// Use resolved data if available, otherwise fall back to demo
	let activeData = $derived(chartData ?? timeData);
	let activePieData = $derived.by(() => {
		if (!chartData) return pieData;
		const CHART_COLORS = [
			'var(--chart-1)',
			'var(--chart-2)',
			'var(--chart-3)',
			'var(--chart-4)',
			'var(--chart-5)'
		];
		return chartData.map((row, i) => ({
			...row,
			color: CHART_COLORS[i % CHART_COLORS.length]
		}));
	});
	let xKey = $derived(chartData ? resolvedXKey : 'date');
	let xKeyBand = $derived(chartData ? resolvedXKey : 'month');
	let activeSeries = $derived(
		chartData
			? [{ key: resolvedValueKey, label: resolvedValueKey, color: chartConfig.value.color }]
			: series
	);

	// Stable identity key — changes only when data source or resolution state changes.
	// Forces a clean remount of the chart, preventing layerchart animation loops.
	let chartKey = $derived(`${config.chartType}-${config.dataSource ?? 'demo'}-${!!chartData}`);
</script>

<div class="flex flex-col gap-2">
	<p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
		{config.dateRange} overview
	</p>

	{#key chartKey}
		<Chart.Container
			config={config.chartType === 'pie' ? pieConfig : chartConfig}
			class="aspect-[16/9] w-full"
		>
			{#if config.chartType === 'area'}
				<AreaChart
					data={activeData}
					x={hasDateColumn ? xKey : xKeyBand}
					xScale={hasDateColumn ? scaleUtc() : scaleBand()}
					series={activeSeries}
					axis="x"
					props={{
						area: {
							curve: curveNatural,
							'fill-opacity': 0.4,
							line: { class: 'stroke-1' }
						},
						xAxis: {
							format: hasDateColumn
								? (v: unknown) => MONTH_LABELS[new Date(v as string | number).getMonth()] ?? ''
								: (d: unknown) => (typeof d === 'string' ? d.slice(0, 12) : String(d))
						}
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip hideLabel />
					{/snippet}
				</AreaChart>
			{:else if config.chartType === 'bar'}
				<BarChart
					data={activeData}
					x={xKeyBand}
					xScale={scaleBand().padding(0.25)}
					series={activeSeries}
					axis="x"
					props={{
						bars: { stroke: 'none', rounded: 'all', radius: 6 },
						highlight: { area: { fill: 'none' } },
						xAxis: {
							format: (d: unknown) => (typeof d === 'string' ? d.slice(0, 3) : String(d))
						}
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip hideLabel />
					{/snippet}
				</BarChart>
			{:else if config.chartType === 'line'}
				<LineChart
					data={activeData}
					x={hasDateColumn ? xKey : xKeyBand}
					xScale={hasDateColumn ? scaleUtc() : scaleBand()}
					series={activeSeries}
					axis="x"
					props={{
						spline: { curve: curveNatural, strokeWidth: 2 },
						xAxis: {
							format: hasDateColumn
								? (v: unknown) => MONTH_LABELS[new Date(v as string | number).getMonth()] ?? ''
								: (d: unknown) => (typeof d === 'string' ? d.slice(0, 12) : String(d))
						},
						highlight: { points: { r: 4 } }
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip hideLabel />
					{/snippet}
				</LineChart>
			{:else if config.chartType === 'pie'}
				<PieChart
					data={activePieData}
					label={xKeyBand}
					key={xKeyBand}
					value={resolvedValueKey}
					c="color"
					innerRadius={40}
					padding={16}
				>
					{#snippet tooltip()}
						<Chart.Tooltip nameKey={xKeyBand} />
					{/snippet}
				</PieChart>
			{:else if config.chartType === 'radar'}
				<LineChart
					data={activeData}
					x={xKeyBand}
					xScale={scaleBand()}
					series={activeSeries}
					radial
					padding={12}
					props={{
						spline: {
							curve: curveLinearClosed,
							fill: `var(--color-${resolvedValueKey})`,
							fillOpacity: 0.6,
							stroke: '0'
						},
						xAxis: { tickLength: 0 },
						yAxis: { format: () => '' },
						grid: { radialY: 'linear' },
						highlight: { lines: false }
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip />
					{/snippet}
				</LineChart>
			{/if}
		</Chart.Container>
	{/key}
</div>
