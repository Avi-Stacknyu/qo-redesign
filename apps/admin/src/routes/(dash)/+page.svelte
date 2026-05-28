<script lang="ts">
	import * as Avatar from '$lib/components/shadcn/avatar';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import * as Card from '$lib/components/shadcn/card';
	import * as Table from '$lib/components/shadcn/table';
	import { BreakdownDonutChart, MiniSparkline } from '$lib/components/analytics';
	import { getDashboardStats } from '$lib/remote/dashboard.remote';
	import {
		Activity,
		CreditCard,
		DollarSign,
		PieChart,
		RefreshCw,
		TrendingUp,
		TrendingDown,
		Minus
	} from '@lucide/svelte';

	const stats = await getDashboardStats();
	let refreshing = $state(false);
	async function refresh() {
		refreshing = true;
		try {
			await getDashboardStats().refresh();
		} finally {
			refreshing = false;
		}
	}

	const topSpenders = $derived(stats?.topSpenders ?? []);
	const modelUsage = $derived(stats?.modelUsage ?? []);
	const recentActivity = $derived(stats?.recentActivity ?? []);

	// Enhanced data
	const providerBreakdown = $derived(stats?.providerBreakdown ?? []);
	const last7Days = $derived(stats?.last7Days ?? []);
	const todayCost = $derived(stats?.todayCost ?? 0);
	const yesterdayCost = $derived(stats?.yesterdayCost ?? 0);
	const todayVsYesterdayPercent = $derived(stats?.todayVsYesterdayPercent ?? null);
	const weekOverWeekPercent = $derived(stats?.weekOverWeekPercent ?? null);
	const avgDailyCost7d = $derived(stats?.avgDailyCost7d ?? 0);
	const curr7DayCost = $derived(stats?.curr7DayCost ?? 0);

	type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
	type LedgerEntry = DashboardStats['recentActivity'][number];
	type TopSpenderEntry = DashboardStats['topSpenders'][number];

	function getExpandedLedgerUser(entry: LedgerEntry) {
		return { name: entry.userName, email: entry.userEmail };
	}

	function getSpenderUser(entry: TopSpenderEntry) {
		return {
			name: entry.userName,
			email: entry.userEmail,
			avatarUrl: undefined as string | undefined,
			expand: { plan: { type: entry.planTitle } }
		};
	}

	const totalUsageUSD = $derived(stats?.totalUsageUSD ?? 0);
	const totalDistributedCredits = $derived(stats?.totalDistributedCredits ?? 0);

	// Donut chart segments from providerBreakdown
	const donutSegments = $derived(
		providerBreakdown.map((p) => ({
			label: p.label.charAt(0).toUpperCase() + p.label.slice(1),
			value: p.costUsd
		}))
	);

	// Sparkline data points
	const sparklineData = $derived(last7Days.map((d) => ({ value: d.costUsd })));

	function formatCurrency(value: number | null | undefined) {
		const amount = Number(value ?? 0);
		return amount.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 2
		});
	}

	function formatDate(input: string | Date) {
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
			new Date(input)
		);
	}

	function formatDateTime(input: string | Date) {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric'
		}).format(new Date(input));
	}
</script>

<div class="space-y-6 p-6">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Operator Dashboard</h1>
			<p class="text-sm text-muted-foreground">Realtime credit flow, usage and risk posture.</p>
		</div>
		<Button variant="outline" onclick={refresh} disabled={refreshing}>
			{#if refreshing}
				<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
			{:else}
				<RefreshCw class="mr-2 h-4 w-4" />
			{/if}
			Refresh data
		</Button>
	</div>

	{#if stats}
		<!-- KPI Cards Row -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<!-- Total Usage with today vs yesterday -->
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Total Usage</Card.Title>
					<DollarSign class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-3xl font-bold">{formatCurrency(totalUsageUSD)}</div>
					<div class="flex items-center gap-1.5 pt-1">
						{#if todayVsYesterdayPercent !== null}
							<span
								class="flex items-center gap-0.5 text-xs font-medium {todayVsYesterdayPercent > 0
									? 'text-red-500'
									: todayVsYesterdayPercent < 0
										? 'text-green-500'
										: 'text-muted-foreground'}"
							>
								{#if todayVsYesterdayPercent > 0}
									<TrendingUp class="h-3 w-3" />
								{:else if todayVsYesterdayPercent < 0}
									<TrendingDown class="h-3 w-3" />
								{:else}
									<Minus class="h-3 w-3" />
								{/if}
								{todayVsYesterdayPercent > 0 ? '+' : ''}{todayVsYesterdayPercent.toFixed(1)}%
							</span>
							<span class="text-xs text-muted-foreground">today vs yesterday</span>
						{:else}
							<p class="text-xs text-muted-foreground">Cost across all providers</p>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Distributed Credits -->
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Distributed Credits</Card.Title>
					<CreditCard class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-3xl font-bold">
						{totalDistributedCredits.toLocaleString()}
					</div>
					<p class="text-xs text-muted-foreground">Outstanding balances</p>
				</Card.Content>
			</Card.Root>

			<!-- Avg Daily Spend (7d) with week-over-week -->
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Avg Daily Spend</Card.Title>
					<Activity class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-3xl font-bold">{formatCurrency(avgDailyCost7d)}</div>
					<div class="flex items-center gap-1.5 pt-1">
						{#if weekOverWeekPercent !== null}
							<span
								class="flex items-center gap-0.5 text-xs font-medium {weekOverWeekPercent > 0
									? 'text-red-500'
									: weekOverWeekPercent < 0
										? 'text-green-500'
										: 'text-muted-foreground'}"
							>
								{#if weekOverWeekPercent > 0}
									<TrendingUp class="h-3 w-3" />
								{:else if weekOverWeekPercent < 0}
									<TrendingDown class="h-3 w-3" />
								{:else}
									<Minus class="h-3 w-3" />
								{/if}
								{weekOverWeekPercent > 0 ? '+' : ''}{weekOverWeekPercent.toFixed(1)}%
							</span>
							<span class="text-xs text-muted-foreground">vs prev 7 days</span>
						{:else}
							<p class="text-xs text-muted-foreground">Based on last 7 days</p>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Today's Spend with sparkline -->
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Today's Spend</Card.Title>
					<DollarSign class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="flex items-end justify-between gap-3">
						<div>
							<div class="text-3xl font-bold">{formatCurrency(todayCost)}</div>
							<p class="pt-1 text-xs text-muted-foreground">
								Yesterday: {formatCurrency(yesterdayCost)}
							</p>
						</div>
						{#if sparklineData.length >= 2}
							<MiniSparkline data={sparklineData} width={100} height={36} />
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- 7-Day Spend Overview + Provider Donut -->
		<div class="grid gap-4 lg:grid-cols-7">
			<!-- 7-Day Spend mini chart -->
			<Card.Root class="lg:col-span-4">
				<Card.Header>
					<Card.Title>7-Day Spend</Card.Title>
					<Card.Description>
						{formatCurrency(curr7DayCost)} total over the last 7 days
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if last7Days.length >= 2}
						<div class="space-y-2">
							{#each last7Days as day (day.day)}
								{@const maxCostInRange = Math.max(...last7Days.map((d) => d.costUsd), 0.01)}
								{@const barPercent = (day.costUsd / maxCostInRange) * 100}
								<div class="flex items-center gap-3">
									<span class="w-16 text-xs text-muted-foreground tabular-nums">
										{formatDate(day.day)}
									</span>
									<div class="h-5 flex-1 rounded-sm bg-secondary">
										<div
											class="h-5 rounded-sm bg-primary/80 transition-all duration-300"
											style="width: {barPercent}%"
										></div>
									</div>
									<span class="w-16 text-right text-xs font-medium tabular-nums">
										{formatCurrency(day.costUsd)}
									</span>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">Not enough data for 7-day chart.</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Provider Distribution Donut Chart -->
			<Card.Root class="lg:col-span-3">
				<Card.Header>
					<Card.Title>Provider Distribution</Card.Title>
					<Card.Description>Relative share of spend</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if donutSegments.length === 0}
						<p class="text-sm text-muted-foreground">No provider data available.</p>
					{:else}
						<BreakdownDonutChart data={donutSegments} formatValue={formatCurrency} size={170} />
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Top Spenders + Top Models -->
		<div class="grid gap-4 lg:grid-cols-7">
			<Card.Root class="lg:col-span-4">
				<Card.Header>
					<Card.Title>Top Spenders</Card.Title>
					<Card.Description>Five most expensive accounts</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>User</Table.Head>
								<Table.Head>Plan</Table.Head>
								<Table.Head class="text-right">Spend</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if topSpenders.length === 0}
								<Table.Row>
									<Table.Cell colspan={3} class="text-center text-sm text-muted-foreground">
										No spend data yet.
									</Table.Cell>
								</Table.Row>
							{:else}
								{#each topSpenders as record (record.user)}
									{@const user = getSpenderUser(record)}
									<Table.Row>
										<Table.Cell>
											<div class="flex items-center gap-3">
												<Avatar.Root>
													<Avatar.Image src={user?.avatarUrl} alt={user?.name} />
													<Avatar.Fallback>
														{user?.name?.slice(0, 2) ?? 'NA'}
													</Avatar.Fallback>
												</Avatar.Root>
												<div>
													<p class="text-sm font-medium">
														{user?.name ?? record.user}
													</p>
													<p class="text-xs text-muted-foreground">
														{user?.email ?? '—'}
													</p>
												</div>
											</div>
										</Table.Cell>
										<Table.Cell>
											<Badge variant="secondary" class="capitalize">
												{user?.expand?.plan?.type ?? 'custom'}
											</Badge>
										</Table.Cell>
										<Table.Cell class="text-right font-semibold">
											{formatCurrency(Number(record.totalCost))}
										</Table.Cell>
									</Table.Row>
								{/each}
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
			<Card.Root class="lg:col-span-3">
				<Card.Header>
					<Card.Title>Top Models</Card.Title>
					<Card.Description>Cost and provider mix</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if modelUsage.length === 0}
						<p class="text-sm text-muted-foreground">No model usage recorded.</p>
					{:else}
						{#each modelUsage as model (model.model)}
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-semibold">{model.model}</p>
									<p class="text-xs text-muted-foreground capitalize">{model.provider}</p>
								</div>
								<div class="text-sm font-semibold">{formatCurrency(Number(model.totalCost))}</div>
							</div>
						{/each}
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Recent Activity</Card.Title>
				<Card.Description>Latest ledger entries across the platform</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if recentActivity.length === 0}
					<p class="text-sm text-muted-foreground">No ledger entries found.</p>
				{:else}
					{#each recentActivity as entry (entry.id)}
						{@const ledgerUser = getExpandedLedgerUser(entry)}
						<div class="flex items-center justify-between rounded-lg border p-3">
							<div class="flex items-center gap-3">
								<PieChart class="h-4 w-4 text-muted-foreground" />
								<div>
									<p class="text-sm font-medium capitalize">
										{entry.category} · {entry.model ?? ''}
									</p>
									<p class="text-xs text-muted-foreground">
										{ledgerUser?.name ?? 'Unknown user'} · {formatDateTime(entry.created ?? '')}
									</p>
								</div>
							</div>
							<div class="text-right">
								<p class="text-sm font-semibold">
									{formatCurrency(Number(entry.costUsd))}
								</p>
								<p class="text-xs text-muted-foreground">
									{Number(entry.tokens ?? 0).toLocaleString()} tokens · {(
										entry.provider ?? ''
									).toUpperCase() || '—'}
								</p>
							</div>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
