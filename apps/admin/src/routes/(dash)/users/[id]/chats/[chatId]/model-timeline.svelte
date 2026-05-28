<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';

	interface Turn {
		sequenceNumber: number;
		modelId: string;
		provider: string;
		costUsd: number;
		latencyMs: number;
		inputTokens: number;
		outputTokens: number;
	}

	interface Props {
		turns: Turn[];
		class?: string;
	}

	let { turns, class: className = '' }: Props = $props();

	// Assign a consistent color to each unique model
	const modelColors = [
		'var(--chart-1)',
		'var(--chart-2)',
		'var(--chart-3)',
		'var(--chart-4)',
		'var(--chart-5)'
	];

	const uniqueModels = $derived([...new Set(turns.map((t) => t.modelId))]);

	const modelColorMap = $derived(
		new Map(uniqueModels.map((m, i) => [m, modelColors[i % modelColors.length]]))
	);

	// Detect model switches
	const switches = $derived.by(() => {
		const result: { fromTurn: number; toTurn: number; fromModel: string; toModel: string }[] = [];
		for (let i = 1; i < turns.length; i++) {
			if (turns[i].modelId !== turns[i - 1].modelId) {
				result.push({
					fromTurn: turns[i - 1].sequenceNumber,
					toTurn: turns[i].sequenceNumber,
					fromModel: turns[i - 1].modelId,
					toModel: turns[i].modelId
				});
			}
		}
		return result;
	});

	let hoveredIdx = $state<number | null>(null);

	function formatCompact(value: number) {
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
		return value.toLocaleString();
	}
</script>

<div class="flex flex-col gap-3 {className}">
	<!-- Timeline bar -->
	<div class="flex items-end gap-px">
		{#each turns as turn, i}
			{@const color = modelColorMap.get(turn.modelId) ?? 'var(--chart-1)'}
			{@const isSwitch = i > 0 && turns[i].modelId !== turns[i - 1].modelId}
			<div class="flex flex-1 flex-col items-center gap-1">
				{#if isSwitch}
					<div class="h-3 w-px bg-destructive/60"></div>
				{:else}
					<div class="h-3"></div>
				{/if}
				<div
					class="flex h-8 w-full cursor-pointer items-center justify-center rounded-md transition-opacity {hoveredIdx !==
						null && hoveredIdx !== i
						? 'opacity-30'
						: ''}"
					style="background: {color}"
					role="img"
					aria-label="Turn #{turn.sequenceNumber}: {turn.modelId}"
					onmouseenter={() => (hoveredIdx = i)}
					onmouseleave={() => (hoveredIdx = null)}
				>
					<span class="text-[9px] font-medium text-white">
						{turn.sequenceNumber}
					</span>
				</div>
			</div>
		{/each}
	</div>

	<!-- Tooltip / details on hover -->
	{#if hoveredIdx !== null}
		{@const t = turns[hoveredIdx]}
		<div class="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
			<Badge variant="outline" class="text-[10px]">Turn #{t.sequenceNumber}</Badge>
			<Badge variant="secondary" class="text-[10px]">{t.modelId}</Badge>
			<span class="text-muted-foreground">{t.provider}</span>
			<span class="font-mono text-muted-foreground">${t.costUsd.toFixed(6)}</span>
			<span class="font-mono text-muted-foreground"
				>{formatCompact(t.inputTokens + t.outputTokens)} tokens</span
			>
			<span class="font-mono text-muted-foreground"
				>{t.latencyMs < 1000 ? `${t.latencyMs}ms` : `${(t.latencyMs / 1000).toFixed(2)}s`}</span
			>
		</div>
	{:else}
		<div class="h-8"></div>
	{/if}

	<!-- Legend -->
	<div class="flex flex-wrap gap-3 text-xs">
		{#each uniqueModels as model}
			<div class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-sm" style="background: {modelColorMap.get(model)}"></span>
				<span class="text-muted-foreground">{model}</span>
			</div>
		{/each}
	</div>

	<!-- Model switches summary -->
	{#if switches.length > 0}
		<div class="flex flex-wrap gap-2 pt-1">
			<span class="text-[10px] font-medium text-muted-foreground">
				{switches.length} model switch{switches.length !== 1 ? 'es' : ''}:
			</span>
			{#each switches as sw}
				<Badge variant="outline" class="gap-1 text-[10px]">
					#{sw.fromTurn} → #{sw.toTurn}
				</Badge>
			{/each}
		</div>
	{/if}
</div>
