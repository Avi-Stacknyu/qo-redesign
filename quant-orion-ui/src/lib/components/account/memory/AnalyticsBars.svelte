<script lang="ts">
	import { BarChart } from 'layerchart';

	import { ChartContainer, type ChartConfig } from '$lib/components/ui/chart/index.js';

	type Bar = {
		height: number;
		accent?: boolean;
	};

	type ChartBarDatum = {
		slot: string;
		accent: number;
		neutral: number;
	};

	let {
		bars = []
	}: {
		bars?: Bar[];
	} = $props();

	const chartConfig: ChartConfig = {
		accent: {
			label: 'Accent',
			color: '#7C4DFF'
		},
		neutral: {
			label: 'Neutral',
			color: '#D8E5FF'
		}
	};

	const chartData = $derived<ChartBarDatum[]>(
		bars.map((bar, index) => ({
			slot: `${index + 1}`,
			accent: bar.accent ? bar.height : 0,
			neutral: bar.accent ? 0 : bar.height
		}))
	);

	const maxValue = $derived(Math.max(...bars.map((bar) => bar.height), 0));
	const chartSeries = [
		{ key: 'neutral', value: 'neutral', color: 'var(--color-neutral)' },
		{ key: 'accent', value: 'accent', color: 'var(--color-accent)' }
	];
</script>

<ChartContainer
	config={chartConfig}
	class="h-40 w-full rounded-[24px] bg-[#FBFCFF] px-3 py-4 [&_.lc-bar]:stroke-transparent [&_.lc-bars]:transition-opacity [&_.lc-bars]:duration-300 [&_.lc-root-container]:overflow-visible"
>
	<BarChart
		data={chartData}
		x="slot"
		series={chartSeries}
		seriesLayout="stack"
		axis={false}
		grid={false}
		rule={false}
		legend={false}
		tooltipContext={false}
		padding={{ top: 4, right: 2, bottom: 0, left: 2 }}
		bandPadding={0.38}
		yDomain={[0, maxValue]}
		class="h-full w-full"
	/>
</ChartContainer>