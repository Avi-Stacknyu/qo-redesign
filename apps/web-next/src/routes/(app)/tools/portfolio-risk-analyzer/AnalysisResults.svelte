<!-- AnalysisResults — Portfolio risk analysis output. -->
<script lang="ts">
	import { ChartRenderer } from '@repo/shared/components';
	import type { ToolExecutionResult, ShadcnChartOutput, ResolvedData } from '@repo/shared/types';

	let { result }: { result: ToolExecutionResult } = $props();

	let metrics = $derived(result.metrics as Record<string, unknown> | undefined);
	let allocationData = $derived(result.data?.allocation_chart as ResolvedData | undefined);
	let holdingsData = $derived(result.data?.holdings_table as ResolvedData | undefined);
	let rebalancingData = $derived(result.data?.rebalancing_table as ResolvedData | undefined);

	let pieChartOutput = $derived.by((): ShadcnChartOutput | null => {
		if (!allocationData?.rows.length) return null;
		return {
			_toolType: 'chart',
			chartType: 'pie',
			title: 'Asset Allocation',
			data: allocationData.rows.map((r) => ({
				name: String(r.asset_class),
				value: Number(r.percentage)
			})),
			config: { showLegend: true, showTooltip: true, donut: true, innerRadius: 60 }
		};
	});

	function fmtCur(val: unknown): string {
		if (typeof val !== 'number') return String(val);
		return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
	}

	function fmtPct(val: unknown): string {
		if (typeof val !== 'number') return String(val);
		return val.toFixed(2) + '%';
	}
</script>

{#if metrics}
	{@const pnl = metrics.total_pnl as number}
	{@const positive = pnl >= 0}

	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		<div class="rounded-2xl border border-border/60 bg-white p-4">
			<p class="text-xs font-medium text-muted-foreground">Portfolio Value</p>
			<p class="mt-1 text-xl font-semibold tracking-tight text-foreground tabular-nums">
				{fmtCur(metrics.total_value)}
			</p>
		</div>
		<div class="rounded-2xl border border-border/60 bg-white p-4">
			<p class="text-xs font-medium text-muted-foreground">P&L</p>
			<p
				class="mt-1 text-xl font-semibold tracking-tight tabular-nums {positive
					? 'text-emerald-600'
					: 'text-red-500'}"
			>
				{fmtCur(pnl)}
				<span class="text-sm font-normal">({fmtPct(metrics.total_pnl_pct)})</span>
			</p>
		</div>
		<div class="rounded-2xl border border-border/60 bg-white p-4">
			<p class="text-xs font-medium text-muted-foreground">Diversification</p>
			<p class="mt-1 text-xl font-semibold tracking-tight text-foreground tabular-nums">
				{metrics.diversification_score}<span class="text-sm font-normal text-muted-foreground">/100</span>
			</p>
		</div>
		<div class="rounded-2xl border border-border/60 bg-white p-4">
			<p class="text-xs font-medium text-muted-foreground">Risk Profile</p>
			<p class="mt-1 text-xl font-semibold tracking-tight text-foreground">{metrics.risk_category}</p>
		</div>
	</div>
{/if}

{#if pieChartOutput}
	<div class="rounded-2xl border border-border/60 bg-white p-5">
		<h3 class="mb-3 text-sm font-medium text-foreground">Asset Allocation</h3>
		<ChartRenderer output={pieChartOutput} />
	</div>
{/if}

{#if holdingsData?.rows.length}
	<div class="rounded-2xl border border-border/60 bg-white">
		<div class="px-5 pt-5 pb-3">
			<h3 class="text-sm font-medium text-foreground">Holdings ({holdingsData.rows.length})</h3>
		</div>
		<div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border/60 bg-muted/30">
							{#each holdingsData.columns as col (col.key)}
								<th
									class="px-4 py-2 text-left text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase"
								>
									{col.label}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each holdingsData.rows as row, i (i)}
							<tr class="border-b border-border/30 last:border-0 hover:bg-muted/20">
								{#each holdingsData.columns as col (col.key)}
									{@const val = (row as Record<string, unknown>)[col.key]}
									<td class="px-4 py-2 whitespace-nowrap tabular-nums">
										{#if col.key === 'unrealized_pnl' || col.key === 'pnl_pct'}
											<span
												class={typeof val === 'number' && val >= 0
													? 'text-emerald-600'
													: 'text-red-500'}
											>
												{col.key === 'pnl_pct' ? fmtPct(val) : fmtCur(val)}
											</span>
										{:else if col.type === 'number' && typeof val === 'number'}
											{col.key === 'weight'
												? fmtPct(val)
												: col.key === 'current_value'
													? fmtCur(val)
													: val.toLocaleString()}
										{:else}
											<span class={col.key === 'symbol' ? 'font-mono font-medium uppercase' : ''}
												>{val ?? '-'}</span
											>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
{/if}

{#if rebalancingData?.rows.length}
	<div class="rounded-2xl border border-border/60 bg-white">
		<div class="px-5 pt-5 pb-3">
			<h3 class="text-sm font-medium text-foreground">Rebalancing Suggestions</h3>
			<p class="text-xs text-muted-foreground">Adjustments to align with target allocation</p>
		</div>
		<div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border/60 bg-muted/30">
							{#each rebalancingData.columns as col (col.key)}
								<th
									class="px-4 py-2 text-left text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase"
								>
									{col.label}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each rebalancingData.rows as row, i (i)}
							<tr class="border-b border-border/30 last:border-0 hover:bg-muted/20">
								{#each rebalancingData.columns as col (col.key)}
									{@const val = (row as Record<string, unknown>)[col.key]}
									<td class="px-4 py-2 whitespace-nowrap tabular-nums">
										{#if col.key === 'drift'}
											<span
												class={typeof val === 'number' && val > 0
													? 'text-red-500'
													: 'text-emerald-600'}
											>
												{typeof val === 'number'
													? (val > 0 ? '+' : '') + val.toFixed(2) + '%'
													: val}
											</span>
										{:else if col.key === 'suggested_change'}
											<span
												class={typeof val === 'number' && val > 0
													? 'text-emerald-600'
													: 'text-red-500'}
											>
												{fmtCur(val)}
											</span>
										{:else if col.type === 'number'}
											{typeof val === 'number' ? val.toFixed(2) + '%' : val}
										{:else}
											<span class="capitalize">{val ?? '-'}</span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
{/if}
