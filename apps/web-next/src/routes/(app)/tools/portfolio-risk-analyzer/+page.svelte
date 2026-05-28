<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { ArrowLeft, History, FlaskConical } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { runTool } from '$lib/remote/tools.remote';
	import { invalidateAll } from '$app/navigation';
	import type { ToolExecutionResult } from '@repo/shared/types';
	import HoldingsForm from './HoldingsForm.svelte';
	import AnalysisResults from './AnalysisResults.svelte';

	let { data } = $props();

	let tool = $derived(data.tool);
	let pastResults = $derived(data.pastResults);

	let running = $state(false);
	let result = $state<ToolExecutionResult | null>(null);
	let showHistory = $state(false);

	function toResult(raw: unknown): ToolExecutionResult {
		const obj = raw as Record<string, unknown>;
		if (obj.data && obj.data_source_ref) return obj as unknown as ToolExecutionResult;
		return {
			data: obj as Record<string, import('@repo/shared/types').ResolvedData>,
			data_source_ref: { type: 'analytical-tool', source_id: 'portfolio-risk-analyzer' },
			visualizations: [],
			metrics: (obj as Record<string, unknown>).metrics as Record<string, unknown> | undefined
		};
	}

	async function handleRun(params: {
		holdings: Array<{
			symbol: string;
			name: string;
			quantity: number;
			avg_cost: number;
			current_price: number;
			asset_class: string;
		}>;
		target_allocation?: Record<string, number>;
		risk_free_rate?: number;
	}) {
		running = true;
		result = null;
		try {
			const response = await runTool({
				toolKey: 'portfolio-risk-analyzer',
				inputParams: params
			});
			if (response.success && response.result) {
				result = response.result as ToolExecutionResult;
				toast.success('Portfolio analysis complete');
				await invalidateAll();
			} else {
				toast.error(response.error || 'Analysis failed');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Analysis failed');
		} finally {
			running = false;
		}
	}
</script>

<svelte:head>
	<title>{tool.display_name}</title>
</svelte:head>

<div class="relative w-full">
	<!-- Header -->
	<div class="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
		<div class="flex items-start gap-4">
			<Button
				variant="outline"
				size="icon"
				href="/tools"
				class="mt-1 size-10 shrink-0 rounded-full border-border/60"
			>
				<ArrowLeft class="size-4" />
			</Button>

			<div>
				<p class="font-Inter text-xs font-medium tracking-wide text-[#A259FF] uppercase">
					Analytical Tool
				</p>
				<h1 class="font-Inter text-3xl font-normal tracking-tight text-foreground">
					{tool.display_name}
				</h1>
				<p class="mt-2 text-base leading-relaxed text-muted-foreground">
					{tool.description}
				</p>
			</div>
		</div>

		{#if pastResults.length > 0}
			<Button
				variant="outline"
				class="h-11 shrink-0 rounded-full border-border/60 bg-white px-5 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted/40 sm:h-12"
				onclick={() => (showHistory = !showHistory)}
			>
				<History class="mr-2 size-4" />
				History ({pastResults.length})
			</Button>
		{/if}
	</div>

	<!-- Main content -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-1">
			<HoldingsForm onrun={handleRun} {running} />
		</div>

		<div class="flex flex-col gap-5 lg:col-span-2">
			{#if result}
				<AnalysisResults {result} />
			{:else}
				<div
					class="flex min-h-120 flex-1 flex-col items-center justify-center rounded-2xl ring-0 shadow-sm bg-white px-8 py-16 text-center"
				>
					<div
						class="mb-4 flex size-16 items-center justify-center rounded-2xl border border-[#F5D9C5] bg-[#F6F6F6]"
					>
						<FlaskConical class="size-7 text-[#A259FF]" />
					</div>
					<h2 class="font-Inter text-xl font-normal text-foreground">Ready to analyze</h2>
					<p class="mt-2 max-w-sm text-sm text-muted-foreground">
						Add at least one holding and run the analyzer to see allocation, risk, and rebalancing
						suggestions.
					</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Past results -->
	{#if showHistory && pastResults.length > 0}
		<div class="mt-8 rounded-2xl border border-border/60 bg-white p-5">
			<h3 class="mb-3 text-sm font-medium text-muted-foreground">Past Analyses</h3>
			<div class="space-y-1">
				{#each pastResults as past (past.id)}
					<button
						type="button"
						class="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/40"
						onclick={() => {
							result = toResult(past.data);
							showHistory = false;
						}}
					>
						<span class="text-sm font-medium text-foreground">{past.display_name}</span>
						<span class="text-xs tabular-nums text-muted-foreground">
							{new Date(past.created).toLocaleDateString('en-IN', {
								day: 'numeric',
								month: 'short',
								year: 'numeric'
							})}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
