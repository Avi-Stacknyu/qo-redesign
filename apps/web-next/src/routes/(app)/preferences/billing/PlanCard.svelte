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
			description?: string;
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
	class="relative flex flex-col gap-4 rounded-[1.75rem] border-0 p-6 ring-0 transition-all duration-200 {plan.highlight
		? 'bg-primary text-primary-foreground shadow-lg'
		: 'bg-card shadow-sm hover:shadow-md'} {isCurrent ? 'ring-2 ring-primary/30' : ''}"
>
	{#if isCurrent}
		<span
			class="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground"
		>
			Current Plan
		</span>
	{/if}

	<div class="flex items-start justify-between gap-3">
		<div>
			<h3 class="font-Inter text-2xl font-semibold {plan.highlight ? 'text-primary-foreground' : 'text-foreground'}">{plan.title}</h3>
			<p class="mt-1 text-sm {plan.highlight ? 'text-primary-foreground/80' : 'text-muted-foreground'}">
				{plan.description ?? plan.subtitle ?? 'Flexible access to Quant Orion tools and credits.'}
			</p>
		</div>
		{#if plan.highlight}
			<span class="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-primary">Popular</span>
		{/if}
	</div>

	<div class="flex items-end gap-1">
		<span class="font-Inter text-5xl font-semibold {plan.highlight ? 'text-primary-foreground' : 'text-foreground'}">
			{plan.credits.toLocaleString()}
		</span>
		<span class="mb-1 text-base {plan.highlight ? 'text-primary-foreground/75' : 'text-muted-foreground'}">credits</span>
	</div>

	{#if features.length > 0}
		<ul class="flex flex-col gap-2">
			{#each features as feature, i (i)}
				<li class="flex items-start gap-2 text-sm {plan.highlight ? 'text-primary-foreground' : 'text-foreground'}">
					<Check class="mt-0.5 size-4 shrink-0 {plan.highlight ? 'text-primary-foreground' : 'text-primary'}" />
					<span>{feature}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-auto pt-2">
		{#if isCurrent}
			<button
				disabled
				class="w-full rounded-full bg-white/15 px-4 py-3 text-sm font-medium {plan.highlight ? 'text-primary-foreground' : 'text-muted-foreground'}"
			>
				Current Plan
			</button>
		{:else}
			<button
				onclick={() => onSelect(plan.id)}
				disabled={isDisabled}
				class="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-base font-semibold transition-colors disabled:opacity-50 {plan.highlight ? 'bg-white text-primary hover:bg-white/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}"
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
