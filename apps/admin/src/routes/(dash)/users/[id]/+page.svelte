<script lang="ts">
	import { page } from '$app/state';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Skeleton } from '$lib/components/shadcn/skeleton';
	import { Activity, Calendar, CreditCard, Cpu, DollarSign, Shield } from '@lucide/svelte';
	import ProfileSummaryViewer from './profile-summary-viewer.svelte';
	import UserTags from './user-tags.svelte';
	import { getUserDetails, getUserCostStats } from './user-details.remote';

	const userId = $derived(page.params.id ?? '');
	const userDetailsQuery = getUserDetails();
	const costStatsQuery = getUserCostStats();
	const user = $derived(userDetailsQuery.current);
	const costStats = $derived(costStatsQuery.current);

	function fmt(value: number) {
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
		return value.toLocaleString();
	}
</script>

<div class="space-y-4 px-4 lg:px-6">
	<!-- Compact stat row -->
	{#if costStatsQuery.loading}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each [0, 1, 2, 3] as index (index)}
				<Skeleton class="h-16 rounded-lg" />
			{/each}
		</div>
	{:else if costStats}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div class="flex items-center gap-3 rounded-lg border p-3">
				<div class="rounded-md bg-chart-1/10 p-1.5">
					<Activity class="h-3.5 w-3.5 text-chart-1" />
				</div>
				<div class="min-w-0">
					<p class="text-lg leading-tight font-semibold">{costStats.lifetime_spent.toFixed(2)}</p>
					<p class="text-[11px] text-muted-foreground">Credits spent</p>
				</div>
			</div>
			<div class="flex items-center gap-3 rounded-lg border p-3">
				<div class="rounded-md bg-chart-2/10 p-1.5">
					<CreditCard class="h-3.5 w-3.5 text-chart-2" />
				</div>
				<div class="min-w-0">
					<p class="text-lg leading-tight font-semibold">{costStats.current_balance}</p>
					<p class="text-[11px] text-muted-foreground">Balance</p>
				</div>
			</div>
			<div class="flex items-center gap-3 rounded-lg border p-3">
				<div class="rounded-md bg-chart-3/10 p-1.5">
					<DollarSign class="h-3.5 w-3.5 text-chart-3" />
				</div>
				<div class="min-w-0">
					<p class="text-lg leading-tight font-semibold">{costStats.lifetime_purchased}</p>
					<p class="text-[11px] text-muted-foreground">Purchased</p>
				</div>
			</div>
			<div class="flex items-center gap-3 rounded-lg border p-3">
				<div class="rounded-md bg-chart-4/10 p-1.5">
					<Cpu class="h-3.5 w-3.5 text-chart-4" />
				</div>
				<div class="min-w-0">
					<p class="text-lg leading-tight font-semibold">
						${costStats.lifetime_cost_usd.toFixed(4)}
					</p>
					<p class="text-[11px] text-muted-foreground">{fmt(costStats.total_tokens)} tokens</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Account info — single compact row -->
	{#if user}
		<div class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border px-4 py-3 text-xs">
			<div class="flex items-center gap-1.5">
				<Shield class="h-3.5 w-3.5 text-muted-foreground" />
				<span class="text-muted-foreground">Status</span>
				<Badge
					variant={user.accountStatus === 'active' ? 'default' : 'destructive'}
					class="text-[10px]">{user.accountStatus}</Badge
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-muted-foreground">Verified</span>
				<Badge variant={user.verified ? 'default' : 'secondary'} class="text-[10px]"
					>{user.verified ? 'Yes' : 'No'}</Badge
				>
			</div>
			{#if user.role}
				<div class="flex items-center gap-1.5">
					<span class="text-muted-foreground">Role</span>
					<Badge variant="outline" class="text-[10px]">{user.role.name}</Badge>
				</div>
			{/if}
			{#if user.plan}
				<div class="flex items-center gap-1.5">
					<span class="text-muted-foreground">Plan</span>
					<Badge variant="secondary" class="text-[10px]">{user.plan.title}</Badge>
				</div>
			{/if}
			<div class="flex items-center gap-1.5">
				<Calendar class="h-3.5 w-3.5 text-muted-foreground" />
				<span class="text-muted-foreground"
					>Joined {new Date(user.created ?? '').toLocaleDateString()}</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-muted-foreground"
					>Last active {new Date(user.updated ?? '').toLocaleDateString()}</span
				>
			</div>
		</div>

		<!-- Profile Summary -->
		<ProfileSummaryViewer {userId} userName={user?.name ?? undefined} />

		<!-- User Tags -->
		<UserTags {userId} />
	{/if}
</div>
