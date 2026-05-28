<script lang="ts">
	import { Coins, Loader2 } from '@lucide/svelte';

	let {
		pack,
		onBuy,
		loadingId = null
	}: {
		pack: {
			id: string;
			title: string;
			subtitle?: string;
			credits: number;
		};
		onBuy: (id: string) => void;
		loadingId?: string | null;
	} = $props();

	let isLoading = $derived(loadingId === pack.id);
	let isDisabled = $derived(loadingId !== null);
</script>

<div class="rounded-[1.75rem] border border-border/30 bg-card/70 p-5 transition-colors hover:border-border/50 hover:shadow-sm">
	<div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
	<div class="flex items-center gap-3">
		<div class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
			<Coins class="size-4" />
		</div>
		<div>
			<p class="font-Inter text-xl font-semibold text-foreground">{pack.title}</p>
			{#if pack.subtitle}
				<p class="text-sm text-muted-foreground">{pack.subtitle}</p>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-4">
		<p class="font-Inter text-3xl font-semibold text-foreground tabular-nums">
			{pack.credits.toLocaleString()}
			<span class="ml-1 text-sm font-normal text-muted-foreground">credits</span>
		</p>
		<button
			onclick={() => onBuy(pack.id)}
			disabled={isDisabled}
			class="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
		>
			{#if isLoading}
				<Loader2 class="size-3 animate-spin" />
			{/if}
			Buy
		</button>
	</div>
</div>
</div>
