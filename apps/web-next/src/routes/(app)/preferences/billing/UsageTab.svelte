<script lang="ts">
	import * as Chart from '$lib/components/shadcn/chart/index.js';
	import { Receipt } from '@lucide/svelte';
	import { scaleUtc } from 'd3-scale';
	import { curveBumpX } from 'd3-shape';
	import { LineChart } from 'layerchart';

	let {
		hourlyUsage,
		formatCredits,
		formatDate
	}: {
		hourlyUsage: Array<{
			id: string;
			date: string;
			timeRange: string;
			creditsUsed: number;
			operationCount: number;
		}>;
		formatCredits: (n: number) => string;
		formatDate: (s: string) => string;
	} = $props();

	const chartConfig = {
		creditsUsed: { label: 'Credits Used', color: 'var(--chart-1)' }
	} satisfies Chart.ChartConfig;

	/** Parse "2:00 AM" style time into 24h for Date construction. */
	function parseHour(timeStr: string): string {
		const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
		if (!m) return '00:00';
		let hour = parseInt(m[1]);
		if (m[3].toUpperCase() === 'PM' && hour !== 12) hour += 12;
		if (m[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
		return `${String(hour).padStart(2, '0')}:${m[2]}`;
	}

	let chartData = $derived(
		hourlyUsage
			.slice(0, 30)
			.reverse()
			.map((u) => ({
				...u,
				parsedDate: new Date(`${u.date}T${parseHour(u.timeRange.split('-')[0] ?? '')}:00`)
			}))
	);

	let total = $derived(hourlyUsage.reduce((acc, u) => acc + u.creditsUsed, 0));
</script>

<div class="rounded-xl border border-border/30 bg-card/40 backdrop-blur">
	<div class="flex flex-col items-stretch space-y-0 border-b border-border/20 p-0 sm:flex-row">
		<div class="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
			<h2 class="text-sm font-semibold text-foreground">Credit Usage</h2>
			<p class="text-xs text-muted-foreground">Credits used per hour over the last 30 days</p>
		</div>
		<div class="flex border-t border-border/20 sm:border-t-0 sm:border-l">
			<div class="flex flex-1 flex-col justify-center gap-1 px-6 py-4 sm:px-8 sm:py-6">
				<span class="text-xs text-muted-foreground">Total Credits</span>
				<span class="text-lg leading-none font-bold tabular-nums sm:text-3xl">
					{formatCredits(total)}
				</span>
			</div>
		</div>
	</div>

	{#if hourlyUsage.length === 0}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<div class="flex size-10 items-center justify-center rounded-full bg-muted/50">
				<Receipt class="size-5 text-muted-foreground" />
			</div>
			<p class="mt-3 text-sm font-medium text-foreground">No usage yet</p>
			<p class="mt-1 text-xs text-muted-foreground">Start a conversation to see credit usage</p>
		</div>
	{:else}
		<!-- Chart -->
		<div class="px-2 sm:p-6">
			<Chart.Container config={chartConfig} class="aspect-auto h-[250px] w-full">
				<LineChart
					data={chartData}
					x="parsedDate"
					xScale={scaleUtc()}
					y="creditsUsed"
					axis="x"
					series={[
						{
							key: 'creditsUsed',
							label: 'Credits',
							color: chartConfig.creditsUsed.color
						}
					]}
					props={{
						spline: { curve: curveBumpX, motion: 'tween', strokeWidth: 2 },
						xAxis: {
							format: (v: Date) => v.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
						},
						// yAxis: {
						// 	format: (v: number) => formatCredits(v)
						// },

						highlight: { points: { r: 4 } }
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip hideLabel />
					{/snippet}
				</LineChart>
			</Chart.Container>
		</div>

		<!-- Detail List -->
		<!-- <div class="border-t border-border/20 p-2">
			<div class="divide-y divide-border/10">
				{#each hourlyUsage as usage (usage.id)}
					<div class="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30">
						<div
							class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary max-sm:hidden"
						>
							<Clock class="size-3.5" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-[13px] font-medium text-foreground sm:text-sm">
								{usage.timeRange}
							</p>
							<p class="text-[11px] text-muted-foreground sm:text-xs">
								{formatDate(usage.date)} &middot; {usage.operationCount} ops
							</p>
						</div>
						<div class="text-right">
							<p class="text-[13px] font-semibold text-foreground tabular-nums sm:text-sm">
								{formatCredits(usage.creditsUsed)}
							</p>
							<p class="text-[10px] text-muted-foreground">credits</p>
						</div>
					</div>
				{/each}
			</div>
		</div> -->
	{/if}
</div>
