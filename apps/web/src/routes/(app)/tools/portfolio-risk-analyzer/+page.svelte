<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { ArrowLeft } from '@lucide/svelte';
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

<div class="relative mx-auto w-full max-w-7xl">
	<div class="mb-8 space-y-1">
		<div class="flex items-center gap-2">
			<Button variant="ghost" size="sm" href="/tools">
				<ArrowLeft class="size-4" />
			</Button>
			<h1 class="text-3xl font-light tracking-tight text-foreground lg:text-4xl">
				{tool.display_name}
			</h1>
		</div>
		<p class="pl-10 text-sm text-muted-foreground">{tool.description}</p>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-1">
			<HoldingsForm onrun={handleRun} {running} />
		</div>

		<div class="flex flex-col gap-4 lg:col-span-2">
			{#if result}
				<AnalysisResults {result} />
			{:else}
				<div
					class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/40 py-20"
				>
					<p class="text-sm text-muted-foreground">Run an analysis to see results here.</p>
				</div>
			{/if}
		</div>
	</div>

	{#if pastResults.length > 0}
		<div class="mt-8">
			<button
				type="button"
				class="mb-3 text-sm text-muted-foreground hover:text-foreground"
				onclick={() => (showHistory = !showHistory)}
			>
				{showHistory ? 'Hide' : 'Show'} past analyses ({pastResults.length})
			</button>

			{#if showHistory}
				<div class="space-y-1.5">
					{#each pastResults as past (past.id)}
						<button
							type="button"
							class="flex w-full items-center justify-between rounded-lg border border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/30"
							onclick={() => {
								result = toResult(past.data);
								showHistory = false;
							}}
						>
							<span class="text-sm">{past.display_name}</span>
							<span class="text-xs text-muted-foreground tabular-nums">
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
