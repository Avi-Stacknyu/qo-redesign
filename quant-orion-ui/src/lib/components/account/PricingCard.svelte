<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import Button from '../ui/button/button.svelte';
	import { BadgeCheck, Check } from '@lucide/svelte';

	type Props = {
		name: string;
		price: number | string;
		period?: string;
		description: string;
		features?: string[];
		badge?: string;
		highlighted?: boolean;
		ctaLabel?: string;
	};

	let {
		name,
		price,
		period = '/month',
		description,
		features = [],
		badge = '',
		highlighted = false,
		ctaLabel = 'Get started'
	}: Props = $props();
</script>

<Card.Root
	class="relative flex flex-col gap-4 rounded-2xl border-0 p-6 ring-0 transition-all duration-200
    {highlighted
		? 'bg-primary text-primary-foreground'
		: ' bg-card hover:shadow-md'}"
>
	<Card.Header class="p-0">
    <div class="flex flex-row items-center justify-between">
		<Card.Title class="font-figtree text-2xl font-semibold">{name}</Card.Title>

        {#if badge}
            <Badge class="bg-white font-figtree text-[#A259FF] font-semibold text-xs px-4 py-3">
                {badge}
            </Badge>
        {/if}
    </div>
		<p
			class="font-figtree text-sm font-normal {highlighted
				? 'text-primary-foreground/70'
				: 'text-muted-foreground'}"
		>
			{description}
		</p>
	</Card.Header>

	<Card.Content class="flex flex-col gap-6 p-0">
		<div class="flex items-end gap-1">
			<span class="font-figtree text-5xl font-semibold">
				{typeof price === 'number' ? `$${price}` : price}
			</span>
			{#if typeof price === 'number'}
				<span
					class="mb-1 font-figtree text-base font-normal {highlighted
						? 'text-primary-foreground/70'
						: 'text-muted-foreground'}"
				>
					{period}
				</span>
			{/if}
		</div>

		<Button
			class="mt-auto rounded-4xl py-6 font-figtree text-lg font-semibold hover:cursor-pointer  {highlighted
				? 'bg-white text-primary hover:bg-white/90'
				: 'bg-primary text-primary-foreground hover:bg-primary/90'}"
		>
			{ctaLabel}
		</Button>

		<ul class="flex flex-col gap-2">
			{#each features as feature}
				<li class="flex items-center gap-2 font-figtree text-base font-normal">
					{#if highlighted}
						<BadgeCheck class="size-5 shrink-0" fill="#27C840" />
					{:else}
						<Check class="size-5 shrink-0" />
					{/if}
					{feature}
				</li>
			{/each}
		</ul>
	</Card.Content>
</Card.Root>
