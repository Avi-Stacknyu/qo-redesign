<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Badge } from '$lib/components/shadcn/badge';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import DataTable from '$lib/components/table/data-table.svelte';
	import TableTitleCell from '$lib/components/table/widgets/table-title-cell.svelte';
	import TableHeaderCell from '$lib/components/table/widgets/table-header-cell.svelte';
	import type { ColumnDef } from '@tanstack/table-core';
	import ChatRowActions from '../chat-row-actions.svelte';
	import { getUserChatStats } from '../user-details.remote';

	let { data } = $props();

	const userId = $derived(page.params.id ?? '');

	const chatStatsQuery = getUserChatStats();
	const chatStats = $derived(chatStatsQuery.current);
	const chatStatsMap = $derived(new Map((chatStats ?? []).map((s) => [s.chatId, s])));

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

	const chatColumns = $derived<ColumnDef<any>[]>([
		{
			accessorKey: 'title',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Chat' }),
			enableSorting: true,
			cell: ({ row }) =>
				renderComponent(TableTitleCell, { value: row.original.title || 'Untitled' })
		},
		{
			id: 'cost',
			header: 'Cost',
			cell: ({ row }) => {
				const stats = chatStatsMap.get(row.original.id);
				return stats ? usd(stats.totalCostUsd) : '—';
			}
		},
		{
			id: 'tokens',
			header: 'Tokens',
			cell: ({ row }) => {
				const stats = chatStatsMap.get(row.original.id);
				if (!stats) return '—';
				return compact(stats.totalInputTokens + stats.totalOutputTokens);
			}
		},
		{
			id: 'messageCount',
			header: 'Msgs',
			cell: ({ row }) => {
				const stats = chatStatsMap.get(row.original.id);
				return stats ? stats.totalMessages : '—';
			}
		},
		{
			id: 'models',
			header: 'Models',
			cell: ({ row }) => {
				const stats = chatStatsMap.get(row.original.id);
				if (!stats || !stats.modelsUsed) return '—';
				const models = stats.modelsUsed
					.split(',')
					.map((m: string) => m.trim())
					.filter(Boolean);
				if (models.length === 0) return '—';
				const first = models[0].length > 18 ? models[0].slice(0, 17) + '…' : models[0];
				return models.length === 1 ? first : `${first} +${models.length - 1}`;
			}
		},
		{
			accessorKey: 'updated',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Updated' }),
			enableSorting: true,
			cell: ({ row }) => new Date(row.original.updated).toLocaleDateString()
		},
		{
			id: 'actions',
			cell: ({ row }) =>
				renderComponent(ChatRowActions, {
					onView: () => goto(`/users/${userId}/chats/${row.original.id}`)
				})
		}
	]);
</script>

<DataTable id="chats_table" columns={chatColumns} data={data.tableData} />
