<script lang="ts">
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as ToggleGroup from '$lib/components/shadcn/toggle-group/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Skeleton } from '$lib/components/shadcn/skeleton/index.js';
	import {
		SpendAreaChart,
		BreakdownBarChart,
		BreakdownDonutChart
	} from '$lib/components/analytics';
	import { DollarSign, Coins, Zap, Brain, Server } from '@lucide/svelte';
	import { getUserAnalytics } from '../user-details.remote';

	type Range = '7d' | '30d' | '90d' | 'all';
	type UserAnalyticsData = Awaited<ReturnType<typeof getUserAnalytics>>;

	let timeRange = $state<Range>('30d');
	let analytics = $state<UserAnalyticsData | null>(null);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let lastLoadedRange = $state<Range | null>(null);

	async function load(range: Range) {
		loading = true;
		errorMsg = null;
		try {
			analytics = await getUserAnalytics({ range });
			lastLoadedRange = range;
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to load analytics';
		} finally {
			loading = false;
		}
	}

	lastLoadedRange = '30d';
	await load('30d');

	$effect(() => {
		if (lastLoadedRange === timeRange) return;
		void load(timeRange);
	});

	function formatUsd(value: number) {
		return value.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 4
		});
	}

	function formatCompact(value: number) {
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
		return value.toLocaleString();
	}

	const modelDonutData = $derived(
		(analytics?.modelBreakdown ?? []).slice(0, 6).map((m) => ({
			label: (m.model ?? '').length > 24 ? (m.model ?? '').slice(0, 23) + '…' : (m.model ?? ''),
			value: m.costUsd
		}))
	);

	const providerBarData = $derived(
		(analytics?.providerBreakdown ?? []).map((p) => ({
			label: p.provider,
			value: p.costUsd
		}))
	);

	const categoryBarData = $derived(
		(analytics?.categoryBreakdown ?? []).map((c) => ({
			label: c.category,
			value: c.tokens
		}))
	);

	const selectedLabel = $derived.by(() => {
		switch (timeRange) {
			case 'all':
				return 'All time';
			case '90d':
				return 'Last 3 months';
			case '30d':
				return 'Last 30 days';
			case '7d':
				return 'Last 7 days';
		}
	});
</script>

<div class="space-y-4 px-4 lg:px-6">
	<!-- Header with range selector -->
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-sm font-semibold">User Analytics</h3>
			<p class="text-xs text-muted-foreground">Cost, token, and usage breakdowns</p>
		</div>
		<div class="flex items-center gap-2">
			{#if loading}
				<Badge variant="secondary" class="text-[10px]">Loading…</Badge>
			{/if}
			<ToggleGroup.Root
				type="single"
				bind:value={timeRange}
				variant="outline"
				class="*:data-[slot=toggle-group-item]:h-7 *:data-[slot=toggle-group-item]:px-2.5 *:data-[slot=toggle-group-item]:text-xs!"
			>
				<ToggleGroup.Item value="all">All</ToggleGroup.Item>
				<ToggleGroup.Item value="90d">90d</ToggleGroup.Item>
				<ToggleGroup.Item value="30d">30d</ToggleGroup.Item>
				<ToggleGroup.Item value="7d">7d</ToggleGroup.Item>
			</ToggleGroup.Root>
		</div>
	</div>

	{#if errorMsg}
		<div
			class="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
		>
			{errorMsg}
		</div>
	{:else if analytics}
		<!-- KPI row — compact -->
		<div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
			<div class="flex items-center gap-2.5 rounded-lg border p-3">
				<div class="rounded-md bg-chart-1/10 p-1.5">
					<DollarSign class="h-3.5 w-3.5 text-chart-1" />
				</div>
				<div>
					<p class="text-sm font-semibold">{formatUsd(analytics.summary.totalCostUsd)}</p>
					<p class="text-[10px] text-muted-foreground">{selectedLabel}</p>
				</div>
			</div>
			<div class="flex items-center gap-2.5 rounded-lg border p-3">
				<div class="rounded-md bg-chart-2/10 p-1.5"><Coins class="h-3.5 w-3.5 text-chart-2" /></div>
				<div>
					<p class="text-sm font-semibold">{formatCompact(analytics.summary.totalTokens)}</p>
					<p class="text-[10px] text-muted-foreground">Tokens</p>
				</div>
			</div>
			<div class="flex items-center gap-2.5 rounded-lg border p-3">
				<div class="rounded-md bg-chart-3/10 p-1.5"><Zap class="h-3.5 w-3.5 text-chart-3" /></div>
				<div>
					<p class="text-sm font-semibold">{formatCompact(analytics.summary.totalRequests)}</p>
					<p class="text-[10px] text-muted-foreground">Requests</p>
				</div>
			</div>
			<div class="flex items-center gap-2.5 rounded-lg border p-3">
				<div class="rounded-md bg-chart-4/10 p-1.5"><Brain class="h-3.5 w-3.5 text-chart-4" /></div>
				<div>
					<p class="truncate text-sm font-semibold">
						{analytics.summary.topModel
							? analytics.summary.topModel.length > 16
								? analytics.summary.topModel.slice(0, 15) + '…'
								: analytics.summary.topModel
							: '—'}
					</p>
					<p class="text-[10px] text-muted-foreground">Top model</p>
				</div>
			</div>
			<div class="flex items-center gap-2.5 rounded-lg border p-3">
				<div class="rounded-md bg-chart-5/10 p-1.5">
					<Server class="h-3.5 w-3.5 text-chart-5" />
				</div>
				<div>
					<p class="text-sm font-semibold">{analytics.summary.topProvider ?? '—'}</p>
					<p class="text-[10px] text-muted-foreground">Top provider</p>
				</div>
			</div>
		</div>

		<!-- Daily Spend Chart -->
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm font-medium">Daily Spend</Card.Title>
				<Card.Description class="text-xs">USD spend per day</Card.Description>
			</Card.Header>
			<Card.Content class="px-2 pt-2 sm:px-4">
				<SpendAreaChart data={analytics.timeSeries} height="h-48" gradientId="fillUserSpend" />
			</Card.Content>
		</Card.Root>

		<!-- Model + Provider breakdown -->
		<div class="grid grid-rows-[1fr] gap-3 lg:grid-cols-2">
			<Card.Root class="flex flex-col">
				<Card.Header class="pb-2">
					<Card.Title class="text-sm font-medium">Model Breakdown</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-1 items-center">
					{#if modelDonutData.length > 0}
						<BreakdownDonutChart data={modelDonutData} formatValue={formatUsd} class="w-full" />
					{:else}
						<p class="py-8 text-center text-sm text-muted-foreground">No model data</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="flex flex-col">
				<Card.Header class="pb-2">
					<Card.Title class="text-sm font-medium">Provider Breakdown</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-1 flex-col px-2 pt-2 sm:px-4">
					<BreakdownBarChart
						data={providerBarData}
						valueLabel="Spend (USD)"
						formatValue={formatUsd}
						height="h-full min-h-44"
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Category Breakdown -->
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm font-medium">Category Breakdown</Card.Title>
				<Card.Description class="text-xs">Token usage by category</Card.Description>
			</Card.Header>
			<Card.Content class="px-2 pt-2 sm:px-4">
				<BreakdownBarChart
					data={categoryBarData}
					valueLabel="Tokens"
					color="var(--chart-4)"
					formatValue={formatCompact}
					height="h-44"
				/>
			</Card.Content>
		</Card.Root>

		<!-- Model Usage Table -->
		{#if analytics.modelBreakdown.length > 0}
			<div class="overflow-x-auto rounded-lg border">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b bg-muted/50">
							<th class="px-3 py-2 text-left text-xs font-medium">Model</th>
							<th class="px-3 py-2 text-left text-xs font-medium">Provider</th>
							<th class="px-3 py-2 text-right text-xs font-medium">Cost</th>
							<th class="px-3 py-2 text-right text-xs font-medium">Tokens</th>
							<th class="px-3 py-2 text-right text-xs font-medium">Reqs</th>
							<th class="px-3 py-2 text-right text-xs font-medium">Avg $/Req</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each analytics.modelBreakdown as row}
							<tr class="transition-colors hover:bg-muted/30">
								<td class="px-3 py-2 font-mono text-xs"
									>{(row.model ?? '').length > 36
										? (row.model ?? '').slice(0, 35) + '…'
										: (row.model ?? '')}</td
								>
								<td class="px-3 py-2"
									><Badge variant="secondary" class="text-[10px]">{row.provider}</Badge></td
								>
								<td class="px-3 py-2 text-right font-mono text-xs">{formatUsd(row.costUsd)}</td>
								<td class="px-3 py-2 text-right text-xs">{formatCompact(row.tokens)}</td>
								<td class="px-3 py-2 text-right text-xs">{formatCompact(row.requestCount)}</td>
								<td class="px-3 py-2 text-right font-mono text-xs"
									>{row.requestCount > 0 ? formatUsd(row.costUsd / row.requestCount) : '—'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
