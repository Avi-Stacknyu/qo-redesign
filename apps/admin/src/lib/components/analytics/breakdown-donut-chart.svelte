<script lang="ts">
	import * as Chart from '$lib/components/shadcn/chart/index.js';
	import {
		normalizeBreakdownMetricRows,
		type BreakdownMetricInput
	} from '$lib/types/analytics-charts';
	import { Arc, PieChart, Text } from 'layerchart';

	interface Props {
		data: BreakdownMetricInput[];
		formatValue?: (v: number) => string;
		size?: number;
		class?: string;
	}

	const defaultColors = [
		'var(--chart-1)',
		'var(--chart-2)',
		'var(--chart-3)',
		'var(--chart-4)',
		'var(--chart-5)'
	];

	let {
		data,
		formatValue = (v: number) => v.toLocaleString(),
		size,
		class: className = ''
	}: Props = $props();

	const segments = $derived(normalizeBreakdownMetricRows(data));
	const total = $derived(segments.reduce((sum, segment) => sum + segment.value, 0));

	// Scale radii based on size prop — keeps arcs proportional to container
	const isCompact = $derived(!!size && size <= 160);
	const outerR = $derived(isCompact ? Math.floor((size! / 2) * 0.82) : 90);
	const activeOuterR = $derived(isCompact ? Math.floor((size! / 2) * 0.95) : 105);
	const innerR = $derived(isCompact ? Math.floor((size! / 2) * 0.52) : 60);
	const piePadding = $derived(isCompact ? 8 : 20);

	const chartData = $derived(
		segments.map((seg, i) => ({
			key: seg.key,
			label: seg.label,
			value: seg.value,
			color: seg.color ?? defaultColors[i % defaultColors.length]
		}))
	);

	const chartConfig = $derived.by(() => {
		const config: Chart.ChartConfig = {};
		for (const item of chartData) {
			config[item.key] = { label: item.label, color: item.color };
		}
		return config;
	});

	let activeIndex = $state(0);
	const activeSliceIndex = $derived(
		chartData.length === 0 ? 0 : Math.min(activeIndex, chartData.length - 1)
	);
	const activeItem = $derived(chartData[activeSliceIndex]);

	/** Truncate label for center text display */
	function truncateLabel(label: string, max: number): string {
		return label.length > max ? label.slice(0, max - 1) + '…' : label;
	}
</script>

<div class="flex flex-col {isCompact ? 'gap-2' : 'gap-4'} {className}">
	{#if chartData.length === 0}
		<div
			class="flex items-center justify-center text-sm text-muted-foreground"
			style="height: {size ?? 200}px;"
		>
			No data
		</div>
	{:else}
		<Chart.Container
			config={chartConfig}
			class="mx-auto aspect-square w-full"
			style="max-height: {size ?? 220}px;"
		>
			<PieChart
				data={chartData}
				label="label"
				key="key"
				value="value"
				c="color"
				innerRadius={innerR}
				padding={piePadding}
			>
				{#snippet aboveMarks()}
					<Text
						value={activeItem ? formatValue(activeItem.value) : formatValue(total)}
						textAnchor="middle"
						verticalAnchor="middle"
						class="fill-foreground font-bold {isCompact ? 'text-base!' : 'text-2xl!'}"
						dy={isCompact ? -2 : -4}
					/>
					<Text
						value={activeItem ? truncateLabel(activeItem.label, isCompact ? 14 : 20) : 'Total'}
						textAnchor="middle"
						verticalAnchor="middle"
						class="fill-muted-foreground! text-muted-foreground {isCompact
							? 'text-[9px]!'
							: 'text-[11px]!'}"
						dy={isCompact ? 12 : 16}
					/>
				{/snippet}
				{#snippet arc({ props, index })}
					{@const isActive = index === activeSliceIndex}
					<Arc
						{...props}
						outerRadius={isActive ? activeOuterR : outerR}
						innerRadius={innerR}
						onmouseenter={() => (activeIndex = index)}
					/>
				{/snippet}
				{#snippet tooltip()}
					<Chart.Tooltip nameKey="key" />
				{/snippet}
			</PieChart>
		</Chart.Container>

		<!-- Documented exception: keep a local legend because hovering legend items drives the active slice and center-label state. -->
		<div
			class="flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 {isCompact ? 'text-xs' : 'text-sm'}"
		>
			{#each chartData as item, i (item.key)}
				<button
					type="button"
					class="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/50 {activeIndex ===
					i
						? 'bg-muted/60'
						: ''}"
					onmouseenter={() => (activeIndex = i)}
				>
					<span class="size-2 shrink-0 rounded-sm" style="background: {item.color}"></span>
					<span class="max-w-24 truncate text-muted-foreground">{item.label}</span>
					<span class="font-mono text-[11px] font-medium tabular-nums"
						>{formatValue(item.value)}</span
					>
				</button>
			{/each}
		</div>
	{/if}
</div>
