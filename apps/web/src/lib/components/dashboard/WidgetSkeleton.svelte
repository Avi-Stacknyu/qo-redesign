<script lang="ts">
	let { lines = 3 }: { lines?: number } = $props();
</script>

<div class="flex flex-col gap-3 p-1">
	{#each Array(lines) as _, i (i)}
		<div class="flex items-center gap-3">
			<div class="size-4 animate-pulse rounded bg-muted/60"></div>
			<div
				class="h-3 animate-pulse rounded bg-muted/60"
				style:width="{60 + Math.random() * 30}%"
				style:animation-delay="{i * 100}ms"
			></div>
		</div>
	{/each}
</div>
