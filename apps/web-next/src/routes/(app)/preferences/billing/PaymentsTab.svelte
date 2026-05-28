<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Check, Clock, CreditCard, RefreshCw, XCircle } from '@lucide/svelte';

	let {
		payments,
		formatCredits,
		formatDate,
		formatCurrency
	}: {
		payments: Array<{
			id: string;
			status: string;
			amount: number;
			currency: string;
			created: string | null;
			plan: { name: string; credits: number } | null;
		}>;
		formatCredits: (n: number) => string;
		formatDate: (s: string) => string;
		formatCurrency: (n: number, c?: string) => string;
	} = $props();

	function getStatusBadge(status: string) {
		switch (status) {
			case 'completed':
				return { icon: Check, variant: 'default' as const, label: 'Completed' };
			case 'pending':
				return { icon: Clock, variant: 'secondary' as const, label: 'Pending' };
			case 'failed':
				return { icon: XCircle, variant: 'destructive' as const, label: 'Failed' };
			case 'refunded':
				return { icon: RefreshCw, variant: 'outline' as const, label: 'Refunded' };
			default:
				return { icon: Clock, variant: 'secondary' as const, label: status };
		}
	}
</script>

<div class="rounded-xl border border-border/30 bg-card/40 backdrop-blur">
	<div class="border-b border-border/20 px-5 py-4">
		<h2 class="text-sm font-semibold text-foreground">Payment History</h2>
		<p class="mt-0.5 text-xs text-muted-foreground">Your credit purchase history and receipts</p>
	</div>
	<div class="p-2">
		{#if payments.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<div class="flex size-10 items-center justify-center rounded-full bg-muted/50">
					<CreditCard class="size-5 text-muted-foreground" />
				</div>
				<p class="mt-3 text-sm font-medium text-foreground">No payments yet</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Payment history will appear here when you purchase credits
				</p>
			</div>
		{:else}
			<div class="divide-y divide-border/10">
				{#each payments as payment (payment.id)}
					{@const statusBadge = getStatusBadge(payment.status)}
					<div class="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30">
						<div
							class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary max-sm:hidden"
						>
							<CreditCard class="size-3.5" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-[13px] font-medium text-foreground sm:text-sm">
								{payment.plan?.name ?? 'Credit Purchase'}
							</p>
							<p class="text-[11px] text-muted-foreground sm:text-xs">
								{formatDate(payment.created ?? '')}{#if payment.plan?.credits}
									&middot; {formatCredits(payment.plan.credits)} credits
								{/if}
							</p>
						</div>
						<div class="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2.5">
							<Badge variant={statusBadge.variant} class="gap-1 text-[10px]">
								{@const Icon = statusBadge.icon}
								<Icon class="size-2.5" />
								{statusBadge.label}
							</Badge>
							<p class="text-[13px] font-semibold text-foreground tabular-nums sm:text-sm">
								{formatCurrency(payment.amount, payment.currency)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
