<script lang="ts">
	import { getAiSpendAnalytics } from './costing.remote';
	import { BreakdownBarChart, SpendAreaChart } from '$lib/components/analytics';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/shadcn/table/index.js';
	import * as ToggleGroup from '$lib/components/shadcn/toggle-group/index.js';

	type Range = '7d' | '30d' | '90d';
	type AnalyticsQuery = ReturnType<typeof getAiSpendAnalytics>;
	type AnalyticsData = Awaited<AnalyticsQuery>;

	let { data } = $props();

	const initialRange: Range = '30d';
	let timeRange = $state<Range>(initialRange);
	let _clientAnalytics = $state<AnalyticsData | null>(null);
	const analytics = $derived(_clientAnalytics ?? data.analytics ?? null);
	let errorMessage = $state<string | null>(null);
	let pending = $state(false);
	let lastLoadedRange = $state<Range>(initialRange);

	async function load(range: Range) {
		if (!['7d', '30d', '90d'].includes(range)) return;
		pending = true;
		errorMessage = null;
		try {
			_clientAnalytics = await getAiSpendAnalytics({ range });
			lastLoadedRange = range;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			pending = false;
		}
	}

	$effect(() => {
		if (!timeRange || lastLoadedRange === timeRange) return;
		void load(timeRange);
	});

	const selectedLabel = $derived.by(() => {
		switch (timeRange) {
			case '90d':
				return 'Last 3 months';
			case '30d':
				return 'Last 30 days';
			case '7d':
				return 'Last 7 days';
		}
	});

	function formatUsd(value: number) {
		return value.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	function formatCompact(value: number) {
		return value.toLocaleString('en-US');
	}

	function truncate(value: string, max = 26) {
		return value.length > max ? `${value.slice(0, max - 1)}…` : value;
	}

	const spendTimeline = $derived(analytics?.charts.spendTimeline ?? []);
	const providerSpend = $derived(analytics?.charts.providerSpend ?? []);
	const modelSpend = $derived(analytics?.charts.modelSpend ?? []);
	const categoryTokens = $derived(analytics?.charts.categoryTokens ?? []);
	const topSpenders = $derived(analytics?.tables.topSpenders ?? []);
</script>

{#if errorMessage}
	<div class="p-6 text-destructive">Error loading analytics: {errorMessage}</div>
{:else if !analytics}
	<div class="flex h-full items-center justify-center p-6 text-muted-foreground">
		Loading analytics…
	</div>
{:else}
	<div class="flex flex-col gap-6 p-6">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div class="space-y-1">
				<h1 class="text-3xl font-bold tracking-tight">AI Spend Analytics</h1>
				<p class="text-sm text-muted-foreground">
					Cost, tokens, and usage across providers, models, and users.
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if pending}
					<Badge variant="secondary">Updating…</Badge>
				{/if}
				{#if analytics.records?.truncated}
					<Badge variant="secondary">Partial data (capped)</Badge>
				{/if}
				<ToggleGroup.Root
					type="single"
					bind:value={timeRange}
					variant="outline"
					class="hidden *:data-[slot=toggle-group-item]:px-4! md:flex"
				>
					<ToggleGroup.Item value="90d">90d</ToggleGroup.Item>
					<ToggleGroup.Item value="30d">30d</ToggleGroup.Item>
					<ToggleGroup.Item value="7d">7d</ToggleGroup.Item>
				</ToggleGroup.Root>
				<Select.Root type="single" bind:value={timeRange}>
					<Select.Trigger size="sm" class="flex w-44 md:hidden" aria-label="Range">
						<span data-slot="select-value">{selectedLabel}</span>
					</Select.Trigger>
					<Select.Content class="rounded-xl">
						<Select.Item value="90d" class="rounded-lg">Last 3 months</Select.Item>
						<Select.Item value="30d" class="rounded-lg">Last 30 days</Select.Item>
						<Select.Item value="7d" class="rounded-lg">Last 7 days</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Total Spend</Card.Title>
					{#if analytics.summary?.topProvider}
						<Badge variant="secondary">{analytics.summary.topProvider}</Badge>
					{/if}
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{formatUsd(analytics.summary.totalCostUsd)}</div>
					<p class="text-xs text-muted-foreground">{selectedLabel}</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Total Tokens</Card.Title>
					{#if analytics.summary?.topModel}
						<Badge variant="secondary">{truncate(analytics.summary.topModel, 18)}</Badge>
					{/if}
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{formatCompact(analytics.summary.totalTokens)}</div>
					<p class="text-xs text-muted-foreground">{selectedLabel}</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Active Users</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{formatCompact(analytics.summary.uniqueUsers)}</div>
					<p class="text-xs text-muted-foreground">With spend in window</p>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Models Used</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{formatCompact(analytics.summary.uniqueModels)}</div>
					<p class="text-xs text-muted-foreground">Unique model ids</p>
				</Card.Content>
			</Card.Root>
		</div>

		<div class="grid gap-4 lg:grid-cols-7">
			<Card.Root class="lg:col-span-4">
				<Card.Header>
					<Card.Title>Daily Spend</Card.Title>
					<Card.Description>USD per day, UTC buckets</Card.Description>
				</Card.Header>
				<Card.Content class="px-2 pt-4 sm:px-6 sm:pt-6">
					<SpendAreaChart data={spendTimeline} height="h-70" gradientId="fillSpend" />
				</Card.Content>
			</Card.Root>

			<Card.Root class="lg:col-span-3">
				<Card.Header>
					<Card.Title>Spend by Provider</Card.Title>
					<Card.Description>Top providers in window</Card.Description>
				</Card.Header>
				<Card.Content class="px-2 pt-4 sm:px-6 sm:pt-6">
					<BreakdownBarChart
						data={providerSpend}
						height="h-70"
						valueLabel="Spend (USD)"
						formatValue={formatUsd}
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<div class="grid gap-4 lg:grid-cols-7">
			<Card.Root class="lg:col-span-4">
				<Card.Header>
					<Card.Title>Top Models by Spend</Card.Title>
					<Card.Description>Top 10 models in window</Card.Description>
				</Card.Header>
				<Card.Content class="px-2 pt-4 sm:px-6 sm:pt-6">
					<BreakdownBarChart
						data={modelSpend}
						height="h-70"
						color="var(--chart-3)"
						valueLabel="Spend (USD)"
						formatValue={formatUsd}
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root class="lg:col-span-3">
				<Card.Header>
					<Card.Title>Tokens by Category</Card.Title>
					<Card.Description>Prompt vs completion vs tools</Card.Description>
				</Card.Header>
				<Card.Content class="px-2 pt-4 sm:px-6 sm:pt-6">
					<BreakdownBarChart
						data={categoryTokens}
						height="h-70"
						color="var(--chart-4)"
						valueLabel="Tokens"
						formatValue={formatCompact}
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Top Spenders</Card.Title>
				<Card.Description>Users with the highest spend in window</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Email</TableHead>
								<TableHead class="text-right">Requests</TableHead>
								<TableHead class="text-right">Tokens</TableHead>
								<TableHead class="text-right">Spend</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each topSpenders as row (row.userId)}
								<TableRow>
									<TableCell class="font-medium">
										{row.name ?? row.userId.slice(0, 8)}
									</TableCell>
									<TableCell class="text-muted-foreground">{row.email ?? '-'}</TableCell>
									<TableCell class="text-right">{formatCompact(row.requestCount)}</TableCell>
									<TableCell class="text-right">{formatCompact(row.tokens)}</TableCell>
									<TableCell class="text-right font-medium">{formatUsd(row.costUsd)}</TableCell>
								</TableRow>
							{/each}
							{#if topSpenders.length === 0}
								<TableRow>
									<TableCell colspan={5} class="py-10 text-center text-muted-foreground">
										No spend in this window.
									</TableCell>
								</TableRow>
							{/if}
						</TableBody>
					</Table>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
{/if}
