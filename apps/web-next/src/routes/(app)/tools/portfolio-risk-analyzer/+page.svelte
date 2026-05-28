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

	/** Normalise old DB records (raw data) vs new ones (full ToolExecutionResult). */
	function toResult(raw: unknown): ToolExecutionResult {
		const obj = raw as Record<string, unknown>;
		if (obj.data && obj.data_source_ref) return obj as unknown as ToolExecutionResult;
		// Legacy: raw data stored directly — wrap into ToolExecutionResult shape
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

<div class="relative mx-auto w-full max-w-7xl space-y-6">
	<section class="rounded-[2rem] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-6">
		<div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex min-w-0 items-start gap-4">
				<Button variant="secondary" size="icon" href="/tools" class="size-12 shrink-0 rounded-full bg-[#F6F6F6] text-[#83899F] shadow-none hover:bg-[#EFEFEF]">
					<ArrowLeft class="size-5" />
				</Button>
				<div class="min-w-0 space-y-2">
					<p class="text-sm font-semibold tracking-wide text-violet-500 uppercase">Analytical Tool</p>
					<h1 class="text-3xl font-bold tracking-tight text-[#1F1F1F] lg:text-4xl">
						{tool.display_name}
					</h1>
					<p class="max-w-4xl text-base leading-7 text-[#83899F]">{tool.description}</p>
				</div>
			</div>

			{#if pastResults.length > 0}
				<Button variant="secondary" class="h-12 rounded-full bg-[#1F1F1F] px-6 text-base font-semibold text-white shadow-none hover:bg-[#2A2A2A]" onclick={() => (showHistory = !showHistory)}>
					<History class="mr-2 size-4" />
					History ({pastResults.length})
				</Button>
			{/if}
		</div>
	</section>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-1">
			<HoldingsForm onrun={handleRun} {running} />
		</div>

		<div class="flex flex-col gap-4 lg:col-span-2">
			{#if result}
				<AnalysisResults {result} />
			{:else}
				<div class="flex min-h-[520px] flex-1 flex-col items-center justify-center rounded-[2rem] bg-white px-8 py-20 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
					<div class="mb-5 flex size-20 items-center justify-center rounded-[1.75rem] bg-[#F6F6F6]">
						<FlaskConical class="size-9 text-violet-500" />
					</div>
					<h2 class="text-3xl font-bold text-[#1F1F1F]">Ready to analyze</h2>
					<p class="mt-3 max-w-md text-base leading-7 text-[#83899F]">
						Add at least one holding and run the portfolio analyzer to see allocation, risk, and rebalancing output here.
					</p>
				</div>
			{/if}
		</div>
	</div>

	{#if pastResults.length > 0}
		<div class="rounded-[2rem] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
			<button
				type="button"
				class="mb-3 inline-flex items-center gap-2 rounded-full bg-[#F6F6F6] px-4 py-2 text-sm font-medium text-[#83899F] transition-colors hover:text-[#1F1F1F]"
				onclick={() => (showHistory = !showHistory)}
			>
				<History class="size-4" />
				{showHistory ? 'Hide' : 'Show'} past analyses ({pastResults.length})
			</button>

			{#if showHistory}
				<div class="space-y-1.5">
					{#each pastResults as past (past.id)}
						<button
							type="button"
							class="flex w-full items-center justify-between rounded-2xl border border-[#F0F0F0] px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA]"
							onclick={() => {
								result = toResult(past.data);
								showHistory = false;
							}}
						>
							<span class="text-sm font-medium text-[#1F1F1F]">{past.display_name}</span>
							<span class="text-xs tabular-nums text-[#83899F]">
								{new Date(past.created).toLocaleDateString('en-IN', {
									day: 'numeric',
									month: 'short',
									year: 'numeric'
								})}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
