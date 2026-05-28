<script lang="ts">
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import DataTable from '$lib/components/table/data-table.svelte';
	import TableTitleCell from '$lib/components/table/widgets/table-title-cell.svelte';
	import TableHeaderCell from '$lib/components/table/widgets/table-header-cell.svelte';
	import { Button } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import type { ColumnDef } from '@tanstack/table-core';
	import { Download, ExternalLink, Check, X } from '@lucide/svelte';
	import { createRawSnippet } from 'svelte';

	let { data } = $props();

	function downloadFile(fileId: string) {
		// Open direct download URL in new tab
		window.open(`/api/files/download/${fileId}`, '_blank');
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	const uploadColumns: ColumnDef<any>[] = [
		{
			accessorKey: 'name',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Name' }),
			enableSorting: true,
			cell: ({ row }) => renderComponent(TableTitleCell, { value: row.original.name })
		},
		{
			accessorKey: 'type',
			header: 'Type',
			cell: ({ row }) => {
				const type = row.original.type || 'unknown';
				const shortType = type.split('/').pop() || type;
				return renderComponent(Badge, {
					variant: 'outline',
					children: createRawSnippet(() => ({
						render: () => `<span class="text-[10px]">${shortType}</span>`
					}))
				});
			}
		},
		{
			accessorKey: 'size',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Size' }),
			enableSorting: true,
			cell: ({ row }) => formatSize(row.original.size ?? 0)
		},
		{
			id: 'sharing',
			header: 'Shared With',
			cell: ({ row }) => {
				const agent = row.original.share_with_agent;
				const manager = row.original.share_with_manager;
				const parts: string[] = [];
				if (agent) parts.push('Agent');
				if (manager) parts.push('Manager');
				return parts.length > 0 ? parts.join(', ') : '—';
			}
		},
		{
			accessorKey: 'created',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Uploaded' }),
			enableSorting: true,
			cell: ({ row }) => new Date(row.original.created).toLocaleDateString()
		},
		{
			id: 'actions',
			header: '',
			cell: ({ row }) =>
				renderComponent(Button, {
					variant: 'ghost',
					size: 'sm',
					class: 'h-7 gap-1.5 text-xs',
					onclick: () => downloadFile(row.original.id),
					children: createRawSnippet(() => ({
						render: () =>
							`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg><span>Download</span>`
					}))
				})
		}
	];
</script>

<DataTable id="uploads_table" columns={uploadColumns} data={data.tableData} />
