<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import DataTable from '$lib/components/table/data-table.svelte';
	import TableTitleCell from '$lib/components/table/widgets/table-title-cell.svelte';
	import TableHeaderCell from '$lib/components/table/widgets/table-header-cell.svelte';
	import type { ColumnDef } from '@tanstack/table-core';
	import { Activity, Cpu, CreditCard, DollarSign } from '@lucide/svelte';
	import { createRawSnippet } from 'svelte';
	import { getUserCostStats } from '../user-details.remote';

	let { data } = $props();

	const costStatsQuery = getUserCostStats();
	const costStats = $derived(costStatsQuery.current);

	function usd(value: number) {
		if (value === 0) return '$0';
		if (value < 0.0001) return `$${value.toExponential(1)}`;
		return `$${value.toFixed(4)}`;
	}

	function compact(value: number) {
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
		return value.toLocaleString();
	}

	/** Display-friendly labels for internal purpose keys */
	const PURPOSE_LABELS: Record<string, string> = {
		agent_chat: 'Agent Chat',
		classification: 'Classification',
		session_extraction: 'Memory Extraction',
		batch_extraction: 'Batch Extraction',
		chat_summarization: 'Chat Summary',
		query_rewriting: 'Query Rewrite',
		rag_reranking: 'RAG Rerank',
		rag_embedding: 'RAG Embedding',
		title_generation: 'Title Gen',
		voice_transcription: 'Voice Input',
		document_conversion: 'Doc Conversion',
		chunk_contextualization: 'Chunk Context',
		document_embedding: 'Doc Embedding',
		document_graph_embedding: 'Graph Embedding'
	};

	function formatPurpose(purpose?: string): string {
		if (!purpose) return '—';
		return PURPOSE_LABELS[purpose] ?? purpose.replaceAll('_', ' ');
	}

	const usageColumns: ColumnDef<any>[] = [
		{
			accessorKey: 'model',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Model' }),
			enableSorting: true,
			cell: ({ row }) => renderComponent(TableTitleCell, { value: row.original.model })
		},
		{
			accessorKey: 'provider',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Provider' }),
			enableSorting: true
		},
		{
			accessorKey: 'category',
			header: 'Category',
			cell: ({ row }) => {
				const cat = row.original.category || 'unknown';
				return renderComponent(Badge, {
					variant: 'outline',
					children: createRawSnippet(() => ({
						render: () => `<span class="capitalize text-[11px]">${cat}</span>`
					}))
				});
			}
		},
		{
			id: 'source',
			header: 'Source',
			cell: ({ row }) => {
				const purpose = row.original.meta?.purpose;
				const label = formatPurpose(purpose);
				if (label === '—') return '—';
				return renderComponent(Badge, {
					variant: 'secondary',
					children: createRawSnippet(() => ({
						render: () => `<span class="text-[10px] font-normal">${label}</span>`
					}))
				});
			}
		},
		{
			accessorKey: 'tokens',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Tokens' }),
			enableSorting: true,
			cell: ({ row }) => {
				const isEstimate = row.original.meta?.tokenEstimate === true;
				const tokens = row.original.tokens ?? 0;
				return isEstimate ? `~${compact(tokens)}` : compact(tokens);
			}
		},
		{
			id: 'inputTokens',
			header: 'In',
			cell: ({ row }) => {
				const meta = row.original.meta;
				const isEstimate = meta?.tokenEstimate === true;
				if (meta?.inputTokens != null) {
					return isEstimate ? `~${compact(meta.inputTokens)}` : compact(meta.inputTokens);
				}
				return '—';
			}
		},
		{
			id: 'outputTokens',
			header: 'Out',
			cell: ({ row }) => {
				const meta = row.original.meta;
				const isEstimate = meta?.tokenEstimate === true;
				if (meta?.outputTokens != null) {
					return isEstimate ? `~${compact(meta.outputTokens)}` : compact(meta.outputTokens);
				}
				return '—';
			}
		},
		// {
		// 	id: 'cachedTokens',
		// 	header: 'Cached',
		// 	cell: ({ row }) => {
		// 		const meta = row.original.meta;
		// 		return meta?.cachedTokens > 0 ? compact(meta.cachedTokens) : '—';
		// 	}
		// },
		{
			accessorKey: 'cost_usd',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Cost' }),
			enableSorting: true,
			cell: ({ row }) => usd(row.original.cost_usd ?? 0)
		},
		{
			id: 'duration',
			header: 'Duration',
			cell: ({ row }) => {
				const ms = row.original.meta?.duration_ms;
				if (!ms || ms <= 0) return '—';
				return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
			}
		},
		{
			accessorKey: 'created',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Time' }),
			enableSorting: true,
			cell: ({ row }) => new Date(row.original.created).toLocaleDateString()
		}
	];
</script>

<div class="space-y-4">
	<!-- Summary -->
	{#if costStats}
		<div class="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
			<div class="flex items-center gap-3 rounded-lg border p-3">
				<div class="rounded-md bg-chart-1/10 p-1.5">
					<DollarSign class="h-3.5 w-3.5 text-chart-1" />
				</div>
				<div class="min-w-0">
					<p class="text-lg leading-tight font-semibold">
						${costStats.lifetime_cost_usd.toFixed(4)}
					</p>
					<p class="text-[11px] text-muted-foreground">Total USD</p>
				</div>
			</div>
			<div class="flex items-center gap-3 rounded-lg border p-3">
				<div class="rounded-md bg-chart-2/10 p-1.5">
					<Cpu class="h-3.5 w-3.5 text-chart-2" />
				</div>
				<div class="min-w-0">
					<p class="text-lg leading-tight font-semibold">{compact(costStats.total_tokens)}</p>
					<p class="text-[11px] text-muted-foreground">Total tokens</p>
				</div>
			</div>
			<div class="flex items-center gap-3 rounded-lg border p-3">
				<div class="rounded-md bg-chart-3/10 p-1.5">
					<Activity class="h-3.5 w-3.5 text-chart-3" />
				</div>
				<div class="min-w-0">
					<p class="text-lg leading-tight font-semibold">{costStats.lifetime_spent.toFixed(2)}</p>
					<p class="text-[11px] text-muted-foreground">Credits consumed</p>
				</div>
			</div>
			<div class="flex items-center gap-3 rounded-lg border p-3">
				<div class="rounded-md bg-chart-4/10 p-1.5">
					<CreditCard class="h-3.5 w-3.5 text-chart-4" />
				</div>
				<div class="min-w-0">
					<p class="text-lg leading-tight font-semibold">{costStats.current_balance}</p>
					<p class="text-[11px] text-muted-foreground">Balance</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Ledger -->
	<DataTable id="usage_table" columns={usageColumns} data={data.tableData} />
</div>
