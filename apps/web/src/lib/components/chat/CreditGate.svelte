<script lang="ts">
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { cn } from '$lib/utils';
	import { AlertTriangle, ArrowUpRight, CreditCard } from '@lucide/svelte';

	let {
		creditBalance,
		hasSubscription,
		class: className = ''
	}: {
		creditBalance: number;
		hasSubscription: boolean;
		class?: string;
	} = $props();

	const isBlocked = $derived(creditBalance <= 0);
</script>

{#if isBlocked}
	<div
		class={cn(
			'flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3',
			className
		)}
	>
		<AlertTriangle class="size-5 shrink-0 text-amber-500" />
		<div class="min-w-0 flex-1 text-sm">
			{#if hasSubscription}
				<p class="font-medium text-foreground">You're out of credits</p>
				<p class="mt-0.5 text-muted-foreground">Purchase a credit pack to continue chatting.</p>
			{:else}
				<p class="font-medium text-foreground">No credits remaining</p>
				<p class="mt-0.5 text-muted-foreground">
					Subscribe to a plan or buy credits to start chatting.
				</p>
			{/if}
		</div>
		<Button
			variant="outline"
			size="sm"
			class="w-full shrink-0 gap-1.5 sm:w-auto"
			href="/preferences/billing"
		>
			{#if hasSubscription}
				<CreditCard class="size-3.5" />
				Buy Credits
			{:else}
				<ArrowUpRight class="size-3.5" />
				View Plans
			{/if}
		</Button>
	</div>
{/if}
