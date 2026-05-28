<script lang="ts">
	import { Check, Loader2 } from '@lucide/svelte';

	let {
		plan,
		isCurrent = false,
		onSelect,
		loadingId = null
	}: {
		plan: {
			id: string;
			title: string;
			subtitle?: string;
			credits: number;
			highlight?: boolean;
			points?: string;
		};
		isCurrent?: boolean;
		onSelect: (id: string) => void;
		loadingId?: string | null;
	} = $props();

	let isLoading = $derived(loadingId === plan.id);
	let isDisabled = $derived(loadingId !== null);

	let features = $derived(
		plan.points
			? plan.points
					.replace(/<[^>]*>/g, '')
					.split('\n')
					.map((s) => s.trim())
					.filter(Boolean)
			: []
	);
</script>

<div
	class="relative flex flex-col rounded-xl border p-5 transition-colors {plan.highlight
		? 'border-primary/50 bg-primary/5'
		: 'border-border/30 bg-card/40'} {isCurrent ? 'ring-2 ring-primary/30' : ''}"
>
	{#if isCurrent}
		<span
			class="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground"
		>
			Current Plan
		</span>
	{/if}

	<h3 class="text-lg font-semibold text-foreground">{plan.title}</h3>
	{#if plan.subtitle}
		<p class="mt-0.5 text-xs text-muted-foreground">{plan.subtitle}</p>
	{/if}

	<p class="mt-3 text-2xl font-bold text-foreground tabular-nums">
		{plan.credits.toLocaleString()}
		<span class="text-sm font-normal text-muted-foreground">credits</span>
	</p>

	{#if features.length > 0}
		<ul class="mt-4 space-y-1.5">
			{#each features as feature, i (i)}
				<li class="flex items-start gap-2 text-xs text-muted-foreground">
					<Check class="mt-0.5 size-3 shrink-0 text-primary" />
					<span>{feature}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-auto pt-4">
		{#if isCurrent}
			<button
				disabled
				class="w-full rounded-lg bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground"
			>
				Current Plan
			</button>
		{:else}
			<button
				onclick={() => onSelect(plan.id)}
				disabled={isDisabled}
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
			>
				{#if isLoading}
					<Loader2 class="size-4 animate-spin" />
					Loading…
				{:else}
					Select Plan
				{/if}
			</button>
		{/if}
	</div>
</div>
