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

<div
	class="flex items-center justify-between rounded-xl border border-border/30 bg-card/40 p-4 transition-colors hover:border-border/50"
>
	<div class="flex items-center gap-3">
		<div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
			<Coins class="size-4" />
		</div>
		<div>
			<p class="text-sm font-semibold text-foreground">{pack.title}</p>
			{#if pack.subtitle}
				<p class="text-xs text-muted-foreground">{pack.subtitle}</p>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-4">
		<p class="text-sm font-bold text-foreground tabular-nums">
			{pack.credits.toLocaleString()}
			<span class="text-xs font-normal text-muted-foreground">credits</span>
		</p>
		<button
			onclick={() => onBuy(pack.id)}
			disabled={isDisabled}
			class="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
		>
			{#if isLoading}
				<Loader2 class="size-3 animate-spin" />
			{/if}
			Buy
		</button>
	</div>
</div>
