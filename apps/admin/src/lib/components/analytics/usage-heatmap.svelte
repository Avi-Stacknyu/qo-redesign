<script lang="ts">
	interface HeatmapCell {
		dayOfWeek: number;
		hour: number;
		cost: number;
		tokens: number;
		requests: number;
	}

	interface Props {
		data: HeatmapCell[];
		metric?: 'cost' | 'tokens' | 'requests';
		class?: string;
	}

	let { data, metric = 'cost', class: className = '' }: Props = $props();

	const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const hourLabels = Array.from({ length: 24 }, (_, i) =>
		i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
	);

	// build a 7x24 grid
	const grid = $derived.by(() => {
		const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
		for (const cell of data) {
			if (cell.dayOfWeek >= 0 && cell.dayOfWeek < 7 && cell.hour >= 0 && cell.hour < 24) {
				matrix[cell.dayOfWeek][cell.hour] = cell[metric];
			}
		}
		return matrix;
	});

	const maxValue = $derived(Math.max(...data.map((c) => c[metric]), 0.001));

	function intensity(value: number): string {
		if (value === 0) return 'bg-muted/30';
		const ratio = value / maxValue;
		if (ratio < 0.15) return 'bg-chart-1/10';
		if (ratio < 0.3) return 'bg-chart-1/20';
		if (ratio < 0.5) return 'bg-chart-1/40';
		if (ratio < 0.7) return 'bg-chart-1/60';
		if (ratio < 0.85) return 'bg-chart-1/80';
		return 'bg-chart-1';
	}

	function formatValue(v: number): string {
		if (metric === 'cost') return `$${v.toFixed(2)}`;
		return v.toLocaleString();
	}

	let hoveredCell = $state<{ day: number; hour: number; value: number } | null>(null);
</script>

<div class="flex flex-col gap-2 {className}">
	{#if hoveredCell}
		<div class="h-4 text-right text-xs text-muted-foreground">
			{dayLabels[hoveredCell.day]}
			{hourLabels[hoveredCell.hour]} — {formatValue(hoveredCell.value)}
		</div>
	{:else}
		<div class="h-4"></div>
	{/if}
	<div class="overflow-x-auto">
		<div
			class="inline-grid gap-px"
			style="grid-template-columns: 40px repeat(24, minmax(16px, 1fr));"
		>
			<!-- header row: hours -->
			<div></div>
			{#each hourLabels as hl, i}
				{#if i % 3 === 0}
					<div class="text-center text-[10px] text-muted-foreground">{hl}</div>
				{:else}
					<div></div>
				{/if}
			{/each}
			<!-- data rows -->
			{#each dayLabels as dayLabel, dayIdx}
				<div class="flex items-center pr-1 text-[11px] text-muted-foreground">{dayLabel}</div>
				{#each grid[dayIdx] as value, hourIdx}
					<div
						class="h-4 min-w-4 cursor-pointer rounded-[3px] transition-colors {intensity(value)}"
						title="{dayLabel} {hourLabels[hourIdx]}: {formatValue(value)}"
						role="gridcell"
						tabindex="-1"
						onmouseenter={() => (hoveredCell = { day: dayIdx, hour: hourIdx, value })}
						onmouseleave={() => (hoveredCell = null)}
					></div>
				{/each}
			{/each}
		</div>
	</div>
</div>
