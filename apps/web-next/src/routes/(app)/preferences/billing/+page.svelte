<script lang="ts">
	import * as Tabs from '$lib/components/shadcn/tabs/index.js';
	import {
		getCreditBalance,
		getHourlyCreditUsage,
		getPaymentTransactions
	} from '$lib/remote/billing.remote';
	import { getAvailablePlans, initiateCheckout, initiatePortal } from '$lib/remote/plans.remote';
	import { Coins, CreditCard, Receipt, Settings, Loader2 } from '@lucide/svelte';
	import PlanCard from './PlanCard.svelte';
	import CreditPackCard from './CreditPackCard.svelte';
	import UsageTab from './UsageTab.svelte';
	import PaymentsTab from './PaymentsTab.svelte';
	import { page } from '$app/stores';

	const [balance, hourlyUsage, payments, plans] = await Promise.all([
		getCreditBalance(),
		getHourlyCreditUsage(),
		getPaymentTransactions(),
		getAvailablePlans()
	]);

	const currentPlanId = $derived.by(() => {
		const plan = $page.data.user?.plan;
		if (!plan) return undefined;
		if (typeof plan === 'string') return plan;
		return plan.id;
	});

	const currentPlanName = $derived(
		plans.subscriptions.find((p) => p.id === currentPlanId)?.title ?? 'Free'
	);

	let checkoutLoadingId = $state<string | null>(null);
	let portalLoading = $state(false);

	function formatCredits(amount: number): string {
		const n = Number(amount) || 0;
		if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
		if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
		return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
	}

	function formatCurrency(amount: number, currency: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function handleCheckout(packageId: string) {
		if (checkoutLoadingId) return;
		checkoutLoadingId = packageId;
		try {
			const { url } = await initiateCheckout({ packageId });
			window.location.href = url;
		} catch {
			checkoutLoadingId = null;
		}
	}

	async function handlePortal() {
		if (portalLoading) return;
		portalLoading = true;
		try {
			const { url } = await initiatePortal();
			window.location.href = url;
		} catch {
			portalLoading = false;
		}
	}
</script>

<div class="space-y-10">
	<!-- Section 1: Current Plan + Balance Stats -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="rounded-xl border border-primary/20 bg-primary/5 p-5">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-xs text-muted-foreground">Current Plan</p>
					<p class="text-lg font-semibold text-foreground">{currentPlanName}</p>
				</div>
				{#if currentPlanId}
					<button
						onclick={handlePortal}
						disabled={portalLoading}
						class="flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-50"
					>
						{#if portalLoading}
							<Loader2 class="size-3 animate-spin" />
						{:else}
							<Settings class="size-3" />
						{/if}
						Manage
					</button>
				{/if}
			</div>
		</div>

		<div class="rounded-xl border border-border/30 bg-card/40 p-5 backdrop-blur">
			<div class="flex items-center gap-3">
				<div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Coins class="size-4" />
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Credit Balance</p>
					<p class="text-xl font-semibold text-foreground tabular-nums">
						{formatCredits(balance.balance)}
					</p>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-border/30 bg-card/40 p-5 backdrop-blur">
			<div class="flex items-center gap-3">
				<div
					class="flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500"
				>
					<Receipt class="size-4" />
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Total Spent</p>
					<p class="text-xl font-semibold text-foreground tabular-nums">
						{formatCredits(balance.lifetime_spent)}
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Section 2: Subscription Plans -->
	{#if plans.subscriptions.length > 0}
		<section>
			<h2 class="mb-4 text-lg font-semibold text-foreground">Subscription Plans</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each plans.subscriptions as plan (plan.id)}
					<PlanCard
						{plan}
						isCurrent={plan.id === currentPlanId}
						onSelect={handleCheckout}
						loadingId={checkoutLoadingId}
					/>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Section 3: Credit Packs -->
	{#if plans.topups.length > 0}
		<section>
			<h2 class="mb-4 text-lg font-semibold text-foreground">Credit Packs</h2>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each plans.topups as pack (pack.id)}
					<CreditPackCard {pack} onBuy={handleCheckout} loadingId={checkoutLoadingId} />
				{/each}
			</div>
		</section>
	{/if}

	<!-- Section 4: Usage & History -->
	<Tabs.Root value="usage">
		<Tabs.List class="mb-6">
			<Tabs.Trigger value="usage" class="gap-1.5">
				<Coins class="size-3.5" />
				Chat Usage
			</Tabs.Trigger>
			<Tabs.Trigger value="payments" class="gap-1.5">
				<CreditCard class="size-3.5" />
				Payments
			</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="usage" class="outline-none">
			<UsageTab {hourlyUsage} {formatCredits} {formatDate} />
		</Tabs.Content>

		<Tabs.Content value="payments" class="outline-none">
			<PaymentsTab {payments} {formatCredits} {formatDate} {formatCurrency} />
		</Tabs.Content>
	</Tabs.Root>
</div>
