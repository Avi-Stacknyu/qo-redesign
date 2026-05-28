<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';

	interface Turn {
		sequenceNumber: number;
		contextData: {
			factsCount: number;
			attachedFilesCount: number;
			docsCount: number;
			knowledgeCount: number;
		};
	}

	interface Props {
		turns: Turn[];
		class?: string;
	}

	let { turns, class: className = '' }: Props = $props();

	const contextTypes = [
		{ key: 'factsCount' as const, label: 'Facts', color: 'var(--chart-1)' },
		{ key: 'attachedFilesCount' as const, label: 'Files', color: 'var(--chart-2)' },
		{ key: 'docsCount' as const, label: 'Docs', color: 'var(--chart-3)' },
		{ key: 'knowledgeCount' as const, label: 'Knowledge', color: 'var(--chart-4)' }
	];

	// Filter to only types that have data
	const activeTypes = $derived(
		contextTypes.filter((ct) => turns.some((t) => t.contextData[ct.key] > 0))
	);

	const maxTotal = $derived(
		Math.max(...turns.map((t) => activeTypes.reduce((s, ct) => s + t.contextData[ct.key], 0)), 1)
	);

	let hoveredIdx = $state<number | null>(null);
</script>

<div class="flex flex-col gap-2 {className}">
	<!-- Legend -->
	<div class="flex flex-wrap gap-3 text-xs">
		{#each activeTypes as ct}
			<div class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-sm" style="background: {ct.color}"></span>
				<span class="text-muted-foreground">{ct.label}</span>
			</div>
		{/each}
	</div>

	<!-- Tooltip -->
	{#if hoveredIdx !== null}
		{@const t = turns[hoveredIdx]}
		<div class="h-5 text-right text-xs text-muted-foreground">
			Turn #{t.sequenceNumber}:
			{#each activeTypes as ct, i}
				{#if i > 0},
				{/if}
				{t.contextData[ct.key]}
				{ct.label.toLowerCase()}
			{/each}
		</div>
	{:else}
		<div class="h-5"></div>
	{/if}

	<!-- Stacked bars -->
	<div class="flex h-36 items-end gap-px">
		{#each turns as turn, i}
			{@const total = activeTypes.reduce((s, ct) => s + turn.contextData[ct.key], 0)}
			{@const barHeight = maxTotal > 0 ? (total / maxTotal) * 100 : 0}
			<div
				class="flex min-w-1.5 flex-1 cursor-pointer flex-col justify-end rounded-t transition-opacity {hoveredIdx !==
					null && hoveredIdx !== i
					? 'opacity-40'
					: ''}"
				style="height: {Math.max(barHeight, total > 0 ? 2 : 0)}%"
				role="img"
				aria-label="Turn #{turn.sequenceNumber}: {total} context items"
				onmouseenter={() => (hoveredIdx = i)}
				onmouseleave={() => (hoveredIdx = null)}
			>
				{#each activeTypes as ct}
					{@const segVal = turn.contextData[ct.key]}
					{@const segPct = total > 0 ? (segVal / total) * 100 : 0}
					{#if segPct > 0}
						<div
							class="w-full first:rounded-t"
							style="height: {segPct}%; background: {ct.color}"
						></div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
</div>
