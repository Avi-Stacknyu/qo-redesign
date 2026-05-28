<script lang="ts">
	import * as Alert from '$lib/components/shadcn/alert';
	import { Button } from '$lib/components/shadcn/button';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import * as Sheet from '$lib/components/shadcn/sheet';
	import DataTable from '$lib/components/table/data-table.svelte';
	import BadgeCell from '$lib/components/table/widgets/badge-cell.svelte';
	import ProviderCell from '$lib/components/table/widgets/provider-cell.svelte';
	import TitleSubtitleCell from '$lib/components/table/widgets/title-subtitle-cell.svelte';
	import type { AiProviderRow, AiToolRow } from '@repo/db/types';
	import type { ColumnDef } from '@tanstack/table-core';
	import { TriangleAlert } from '@lucide/svelte';
	import ToolForm from './tool-form.svelte';
	import ToolRowActions from './tool-row-actions.svelte';
	import { getAllProviders } from './tool.remote';

	let { data } = $props();

	type ToolRow = AiToolRow & { expand: { provider?: AiProviderRow } };

	const providersQuery = getAllProviders();
	let providers = $derived(providersQuery.current ?? []);

	let isSheetOpen = $state(false);
	let selectedTool = $state<ToolRow | null>(null);

	const columns: ColumnDef<ToolRow>[] = [
		{
			accessorKey: 'displayName',
			header: 'Name',
			cell: ({ row }) =>
				renderComponent(TitleSubtitleCell, {
					title: row.original.displayName ?? '',
					subtitle: row.original.description ?? ''
				})
		},
		{
			accessorKey: 'toolKey',
			header: 'ID',
			cell: ({ row }) =>
				renderComponent(BadgeCell, {
					variant: 'outline',
					value: row.original.toolKey ?? ''
				})
		},
		{
			accessorKey: 'category',
			header: 'Category',
			cell: ({ row }) => {
				if (!row.original.category) return '-';
				return renderComponent(BadgeCell, {
					variant: 'secondary',
					value: row.original.category
				});
			}
		},
		{
			accessorKey: 'toolType',
			header: 'Type',
			cell: ({ row }) =>
				renderComponent(BadgeCell, {
					variant: 'secondary',
					value: row.original.toolType ?? ''
				})
		},
		{
			accessorKey: 'provider',
			header: 'Provider',
			cell: ({ row }) => {
				const providerKey = row.original.expand?.provider?.providerKey;
				if (!providerKey) return '-';
				return renderComponent(ProviderCell, {
					value: providerKey
				});
			}
		},
		{
			accessorKey: 'isActive',
			header: 'Status',
			cell: ({ row }) => {
				return renderComponent(BadgeCell, {
					variant: row.original.isActive ? 'default' : 'secondary',
					value: row.original.isActive ? 'Active' : 'Inactive'
				});
			}
		},
		{
			id: 'actions',
			cell: ({ row }) =>
				renderComponent(ToolRowActions, {
					row,
					onEdit: () => {
						selectedTool = row.original;
						isSheetOpen = true;
					}
				})
		}
	];

	function handleAdd() {
		selectedTool = null;
		isSheetOpen = true;
	}

	function handleSuccess() {
		isSheetOpen = false;
	}
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<div class="space-y-6 px-4 lg:px-6">
		<Alert.Root variant="destructive">
			<TriangleAlert class="h-4 w-4" />
			<Alert.Title>Warning</Alert.Title>
			<Alert.Description>Do not edit this. This is internal system configuration.</Alert.Description
			>
		</Alert.Root>
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold tracking-tight">Tools</h2>
				<p class="text-muted-foreground">Manage available tools for AI agents.</p>
			</div>
			<div class="flex items-center space-x-2">
				<Button onclick={handleAdd}>Add Tool</Button>
			</div>
		</div>
	</div>

	<DataTable id="tools_table" {columns} data={data.tableData} />
</div>

<Sheet.Root bind:open={isSheetOpen}>
	<Sheet.Content class="overflow-y-auto  sm:max-w-150">
		<Sheet.Header>
			<Sheet.Title>{selectedTool ? 'Edit Tool' : 'Add Tool'}</Sheet.Title>
			<Sheet.Description>Configure the tool metadata and schema.</Sheet.Description>
		</Sheet.Header>
		<div class="-mt-3 px-4">
			{#key isSheetOpen}
				<ToolForm tool={selectedTool} {providers} onsuccess={handleSuccess} />
			{/key}
		</div>
	</Sheet.Content>
</Sheet.Root>
