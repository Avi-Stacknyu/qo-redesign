<script lang="ts">
	import {
		BreakdownBarChart,
		CostHistogram,
		ModelTrendAreaChart,
		SpendAreaChart,
		StatCard,
		UsageHeatmap
	} from '$lib/components/analytics';
	import { getGlobalAnalytics, getModelDrilldown } from '$lib/remote/analytics.remote';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import * as ToggleGroup from '$lib/components/shadcn/toggle-group/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/shadcn/table/index.js';
	import {
		Activity,
		ArrowUpDown,
		BarChart3,
		Coins,
		DollarSign,
		MessageSquare,
		Users,
		Zap
	} from '@lucide/svelte';
	import ModelDrilldownDialog from './model-drilldown-dialog.svelte';
	import { createLatestRequestVersion } from './request-version';

	type Range = '7d' | '30d' | '90d' | 'all';
	type GlobalAnalytics = Awaited<ReturnType<typeof getGlobalAnalytics>>;
	type ModelDrilldownData = Awaited<ReturnType<typeof getModelDrilldown>>;
	type ModelLeaderboardRow = GlobalAnalytics['tables']['modelLeaderboard'][number];

	let { data } = $props();

	const initialRange: Range = '30d';
	let timeRange = $state<Range>(initialRange);
	let _clientAnalytics = $state<GlobalAnalytics | null>(null);
	const analytics = $derived(_clientAnalytics ?? data.analytics ?? null);
	let errorMessage = $state<string | null>(null);
	let pending = $state(false);
	let lastLoadedRange = $state<Range>(initialRange);
	const analyticsRequests = createLatestRequestVersion();

	let drilldownSelection = $state<ModelLeaderboardRow | null>(null);
	let drilldownData = $state<ModelDrilldownData | null>(null);
	let drilldownPending = $state(false);
	let drilldownErrorMessage = $state<string | null>(null);
	let lastRequestedDrilldownRange = $state<Range | null>(null);
	let lastRequestedDrilldownModelKey = $state<string | null>(null);
	const drilldownRequests = createLatestRequestVersion();

	let sortField = $state<'costUsd' | 'tokens' | 'requestCount' | 'avgCostPerRequest'>('costUsd');
	let sortDir = $state<'asc' | 'desc'>('desc');

	function isRange(value: string): value is Range {
		return value === '7d' || value === '30d' || value === '90d' || value === 'all';
	}

	function setTimeRange(nextRange: string) {
		if (!isRange(nextRange) || nextRange === timeRange) return;

		analyticsRequests.next();
		timeRange = nextRange;
		pending = true;
		errorMessage = null;

		if (drilldownSelection) {
			drilldownRequests.next();
			drilldownPending = true;
			drilldownData = null;
			drilldownErrorMessage = null;
		}
	}

	async function load(range: Range) {
		const requestToken = analyticsRequests.next();
		pending = true;
		errorMessage = null;
		try {
			const nextAnalytics = await getGlobalAnalytics({ range });
			if (!analyticsRequests.isCurrent(requestToken)) return;

			_clientAnalytics = nextAnalytics;
			lastLoadedRange = range;
		} catch (err) {
			if (!analyticsRequests.isCurrent(requestToken)) return;
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			if (analyticsRequests.isCurrent(requestToken)) {
				pending = false;
			}
		}
	}

	$effect(() => {
		if (lastLoadedRange === timeRange) return;
		void load(timeRange);
	});

	async function loadModelDrilldown(row: ModelLeaderboardRow, range: Range) {
		const requestToken = drilldownRequests.next();
		lastRequestedDrilldownModelKey = row.modelKey;
		lastRequestedDrilldownRange = range;
		drilldownPending = true;
		drilldownData = null;
		drilldownErrorMessage = null;

		try {
			const nextDrilldown = await getModelDrilldown({
				model: row.model,
				provider: row.provider,
				range
			});
			if (!drilldownRequests.isCurrent(requestToken)) return;

			drilldownData = nextDrilldown;
		} catch (err) {
			if (!drilldownRequests.isCurrent(requestToken)) return;
			drilldownErrorMessage = err instanceof Error ? err.message : 'Unable to load model drilldown';
		} finally {
			if (drilldownRequests.isCurrent(requestToken)) {
				drilldownPending = false;
			}
		}
	}

	$effect(() => {
		const selection = drilldownSelection;
		if (!selection) return;
		if (
			lastRequestedDrilldownModelKey === selection.modelKey &&
			lastRequestedDrilldownRange === timeRange
		)
			return;

		void loadModelDrilldown(selection, timeRange);
	});

	function openModelDrilldown(row: ModelLeaderboardRow) {
		drilldownSelection = row;
	}

	function closeModelDrilldown() {
		drilldownRequests.next();
		drilldownSelection = null;
		drilldownData = null;
		drilldownErrorMessage = null;
		drilldownPending = false;
		lastRequestedDrilldownModelKey = null;
		lastRequestedDrilldownRange = null;
	}

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

	const sortedModelLeaderboard = $derived.by(() => {
		const rows = [...(analytics?.tables.modelLeaderboard ?? [])];
		rows.sort((left, right) => {
			const leftValue = left[sortField];
			const rightValue = right[sortField];
			return sortDir === 'desc' ? rightValue - leftValue : leftValue - rightValue;
		});
		return rows;
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
		return value.toLocaleString('en-US');
	}

	function truncate(value: string, max = 26) {
		return value.length > max ? `${value.slice(0, max - 1)}…` : value;
	}

	function toggleSort(field: typeof sortField) {
		if (sortField === field) {
			sortDir = sortDir === 'desc' ? 'asc' : 'desc';
			return;
		}

		sortField = field;
		sortDir = 'desc';
	}
</script>

{#if errorMessage}
	<div class="p-6 text-destructive">Error loading analytics: {errorMessage}</div>
{:else if !analytics}
	<div class="flex h-full items-center justify-center p-6 text-muted-foreground">
		Loading analytics…
	</div>
{:else}
	<div class="flex flex-col gap-6 p-4 md:p-6">
		<!-- Header -->
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div class="space-y-1">
				<h1 class="text-3xl font-bold tracking-tight">Analytics</h1>
				<p class="text-sm text-muted-foreground">
					Deep-dive into cost, tokens, and usage patterns across the platform.
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if pending}
					<Badge variant="secondary">Updating…</Badge>
				{/if}
				<ToggleGroup.Root
					type="single"
					value={timeRange}
					onValueChange={(nextRange) => nextRange && setTimeRange(nextRange)}
					variant="outline"
					class="hidden *:data-[slot=toggle-group-item]:px-4! md:flex"
				>
					<ToggleGroup.Item value="all">All</ToggleGroup.Item>
					<ToggleGroup.Item value="90d">90d</ToggleGroup.Item>
					<ToggleGroup.Item value="30d">30d</ToggleGroup.Item>
					<ToggleGroup.Item value="7d">7d</ToggleGroup.Item>
				</ToggleGroup.Root>
				<Select.Root
					type="single"
					value={timeRange}
					onValueChange={(nextRange) => nextRange && setTimeRange(nextRange)}
				>
					<Select.Trigger size="sm" class="flex w-44 md:hidden" aria-label="Range">
						<span data-slot="select-value">{selectedLabel}</span>
					</Select.Trigger>
					<Select.Content class="rounded-xl">
						<Select.Item value="all" class="rounded-lg">All time</Select.Item>
						<Select.Item value="90d" class="rounded-lg">Last 3 months</Select.Item>
						<Select.Item value="30d" class="rounded-lg">Last 30 days</Select.Item>
						<Select.Item value="7d" class="rounded-lg">Last 7 days</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<!-- ============================================================= -->
		<!-- KPI HEADER ROW                                                -->
		<!-- ============================================================= -->

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
			<StatCard
				title="Total Spend"
				value={formatUsd(analytics.kpis.totalCostUsd)}
				changePercent={analytics.kpis.costChangePercent}
				icon={DollarSign}
			/>
			<StatCard
				title="Total Tokens"
				value={formatCompact(analytics.kpis.totalTokens)}
				subtitle={selectedLabel}
				icon={Coins}
			/>
			<StatCard
				title="Total Chats"
				value={formatCompact(analytics.kpis.totalChats)}
				subtitle={selectedLabel}
				icon={MessageSquare}
			/>
			<StatCard
				title="Active Users"
				value={formatCompact(analytics.kpis.activeUsers)}
				subtitle="With spend in window"
				icon={Users}
			/>
			<StatCard
				title="Avg Cost / Chat"
				value={formatUsd(analytics.kpis.avgCostPerChat)}
				subtitle={selectedLabel}
				icon={Activity}
			/>
			<StatCard
				title="Avg Cost / User"
				value={formatUsd(analytics.kpis.avgCostPerUser)}
				subtitle={selectedLabel}
				icon={BarChart3}
			/>
			<StatCard
				title="Total Requests"
				value={formatCompact(analytics.kpis.totalRequests)}
				subtitle={selectedLabel}
				icon={Zap}
			/>
		</div>

		<!-- ============================================================= -->
		<!-- DAILY SPEND TIME-SERIES                                       -->
		<!-- ============================================================= -->

		<Card.Root>
			<Card.Header>
				<Card.Title>Daily Spend</Card.Title>
				<Card.Description>Total USD spend per day (UTC)</Card.Description>
			</Card.Header>
			<Card.Content>
				<SpendAreaChart
					data={analytics.charts.spendTimeline}
					height="h-72"
					gradientId="fillSpendGlobal"
				/>
			</Card.Content>
		</Card.Root>

		<!-- ============================================================= -->
		<!-- PROVIDER BREAKDOWN + CATEGORY BREAKDOWN                       -->
		<!-- ============================================================= -->

		<div class="grid gap-4 lg:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>Spend by Provider</Card.Title>
					<Card.Description>Total spend per AI provider</Card.Description>
				</Card.Header>
				<Card.Content>
					<BreakdownBarChart
						data={analytics.charts.providerSpend}
						height="h-64"
						valueLabel="Spend (USD)"
						formatValue={formatUsd}
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Tokens by Category</Card.Title>
					<Card.Description>Prompt, completion, embedding, tool, vector</Card.Description>
				</Card.Header>
				<Card.Content>
					<BreakdownBarChart
						data={analytics.charts.categoryTokens}
						height="h-64"
						color="var(--chart-4)"
						valueLabel="Tokens"
						formatValue={formatCompact}
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- ============================================================= -->
		<!-- MODEL DAILY TREND (top 5 overlaid)                            -->
		<!-- ============================================================= -->

		<Card.Root>
			<Card.Header>
				<Card.Title>Model Daily Trend</Card.Title>
				<Card.Description>Top 5 models by spend — daily breakdown</Card.Description>
			</Card.Header>
			<Card.Content>
				<ModelTrendAreaChart
					data={analytics.charts.modelTrend}
					height="h-72"
					formatValue={formatUsd}
				/>
			</Card.Content>
		</Card.Root>

		<!-- ============================================================= -->
		<!-- MODEL LEADERBOARD TABLE                                       -->
		<!-- ============================================================= -->

		<Card.Root>
			<Card.Header>
				<Card.Title>Model Leaderboard</Card.Title>
				<Card.Description>All models, sortable — click a model for drilldown</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Model</TableHead>
								<TableHead>Provider</TableHead>
								<TableHead class="text-right">
									<button
										class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
										onclick={() => toggleSort('costUsd')}
									>
										Spend
										<ArrowUpDown class="h-3 w-3" />
									</button>
								</TableHead>
								<TableHead class="text-right">
									<button
										class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
										onclick={() => toggleSort('tokens')}
									>
										Tokens
										<ArrowUpDown class="h-3 w-3" />
									</button>
								</TableHead>
								<TableHead class="text-right">
									<button
										class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
										onclick={() => toggleSort('requestCount')}
									>
										Requests
										<ArrowUpDown class="h-3 w-3" />
									</button>
								</TableHead>
								<TableHead class="text-right">
									<button
										class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
										onclick={() => toggleSort('avgCostPerRequest')}
									>
										Avg $/Req
										<ArrowUpDown class="h-3 w-3" />
									</button>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each sortedModelLeaderboard as row (row.modelKey)}
								<TableRow
									class="cursor-pointer transition-colors hover:bg-muted/50"
									onclick={() => openModelDrilldown(row)}
								>
									<TableCell class="font-mono text-sm font-medium"
										>{truncate(row.model, 40)}</TableCell
									>
									<TableCell>
										<Badge variant="secondary">{row.provider}</Badge>
									</TableCell>
									<TableCell class="text-right font-medium">{formatUsd(row.costUsd)}</TableCell>
									<TableCell class="text-right">{formatCompact(row.tokens)}</TableCell>
									<TableCell class="text-right">{formatCompact(row.requestCount)}</TableCell>
									<TableCell class="text-right font-mono text-sm"
										>{formatUsd(row.avgCostPerRequest)}</TableCell
									>
								</TableRow>
							{/each}
							{#if sortedModelLeaderboard.length === 0}
								<TableRow>
									<TableCell colspan={6} class="py-10 text-center text-muted-foreground">
										No model data in this window.
									</TableCell>
								</TableRow>
							{/if}
						</TableBody>
					</Table>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- ============================================================= -->
		<!-- HEATMAP + COST HISTOGRAM                                      -->
		<!-- ============================================================= -->

		<div class="grid gap-4 lg:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>Usage Heatmap</Card.Title>
					<Card.Description>Cost by hour-of-day and day-of-week</Card.Description>
				</Card.Header>
				<Card.Content>
					<UsageHeatmap data={analytics.charts.heatmap} metric="cost" />
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Cost Per Chat Distribution</Card.Title>
					<Card.Description>Histogram of chat costs — spot expensive outliers</Card.Description>
				</Card.Header>
				<Card.Content>
					<CostHistogram data={analytics.charts.costHistogram} />
				</Card.Content>
			</Card.Root>
		</div>

		<!-- ============================================================= -->
		<!-- TOP SPENDERS                                                  -->
		<!-- ============================================================= -->

		<Card.Root>
			<Card.Header>
				<Card.Title>Top Spenders</Card.Title>
				<Card.Description>Users ranked by total spend in this window</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead class="w-8">#</TableHead>
								<TableHead>User</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Plan</TableHead>
								<TableHead class="text-right">Requests</TableHead>
								<TableHead class="text-right">Tokens</TableHead>
								<TableHead class="text-right">Spend</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each analytics.tables.topSpenders as row, idx (row.userId)}
								<TableRow>
									<TableCell class="text-muted-foreground">{idx + 1}</TableCell>
									<TableCell class="font-medium">
										<a
											href="/users/{row.userId}"
											class="underline-offset-4 transition-colors hover:text-primary hover:underline"
										>
											{row.name ?? row.userId.slice(0, 8)}
										</a>
									</TableCell>
									<TableCell class="text-muted-foreground">{row.email ?? '-'}</TableCell>
									<TableCell>
										{#if row.plan}
											<Badge variant="outline">{row.plan}</Badge>
										{:else}
											<span class="text-muted-foreground">—</span>
										{/if}
									</TableCell>
									<TableCell class="text-right">{formatCompact(row.requestCount)}</TableCell>
									<TableCell class="text-right">{formatCompact(row.tokens)}</TableCell>
									<TableCell class="text-right font-medium">{formatUsd(row.costUsd)}</TableCell>
								</TableRow>
							{/each}
							{#if (analytics.tables.topSpenders?.length ?? 0) === 0}
								<TableRow>
									<TableCell colspan={7} class="py-10 text-center text-muted-foreground">
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

<ModelDrilldownDialog
	open={drilldownSelection !== null}
	model={drilldownSelection?.model ?? null}
	data={drilldownData}
	pending={drilldownPending}
	errorMessage={drilldownErrorMessage}
	{selectedLabel}
	onclose={closeModelDrilldown}
/>
