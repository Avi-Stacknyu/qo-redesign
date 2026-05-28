<script lang="ts">
	import * as Alert from '$lib/components/shadcn/alert';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import * as Sheet from '$lib/components/shadcn/sheet';
	import DataTable from '$lib/components/table/data-table.svelte';
	import ProviderCell from '$lib/components/table/widgets/provider-cell.svelte';
	import TableTitleCell from '$lib/components/table/widgets/table-title-cell.svelte';
	import type { ColumnDef } from '@tanstack/table-core';
	import { TriangleAlert } from '@lucide/svelte';
	import ProviderForm from './provider-form.svelte';
	import ProviderRowActions from './provider-row-actions.svelte';
	import { createRawSnippet } from 'svelte';

	let { data } = $props();

	let isSheetOpen = $state(false);
	let selectedProvider = $state<any | null>(null);

	function openCreate() {
		selectedProvider = null;
		isSheetOpen = true;
	}

	function openEdit(provider: any) {
		selectedProvider = provider;
		isSheetOpen = true;
	}

	function onFormSuccess() {
		isSheetOpen = false;
	}

	const columns: ColumnDef<any>[] = [
		{
			accessorKey: 'displayName',
			header: 'Name',
			cell: ({ row }) => renderComponent(TableTitleCell, { value: row.original.displayName })
		},
		{
			accessorKey: 'providerKey',
			header: 'Provider',
			cell: ({ row }) => renderComponent(ProviderCell, { value: row.original.providerKey })
		},
		{
			accessorKey: 'envKeyName',
			header: 'Env Key',
			cell: ({ row }) => row.original.envKeyName
		},
		{
			accessorKey: 'baseUrl',
			header: 'Base URL',
			cell: ({ row }) => row.original.baseUrl ?? '-'
		},
		{
			accessorKey: 'isActive',
			header: 'Status',
			cell: ({ row }) =>
				renderComponent(Badge, {
					variant: row.original.isActive ? 'default' : 'secondary',
					children: createRawSnippet(() => ({
						render: () => `<span>${row.original.isActive ? 'Active' : 'Inactive'}</span>`
					}))
				})
		},
		{
			id: 'actions',
			cell: ({ row }) => {
				return renderComponent(ProviderRowActions, {
					row,
					onEdit: () => openEdit(row.original)
				});
			}
		}
	];
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<div class="space-y-6 px-4 lg:px-6">
		<Alert.Root variant="destructive">
			<TriangleAlert class="h-4 w-4" />
			<Alert.Title>Warning</Alert.Title>
			<Alert.Description>Do not edit this unless you know what you are doing.</Alert.Description>
		</Alert.Root>

		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-bold">Providers</h1>
			<Button onclick={openCreate}>Add Provider</Button>
		</div>
	</div>
	<DataTable id="providers_table" {columns} data={data.tableData} />

	<Sheet.Root bind:open={isSheetOpen}>
		<Sheet.Content class="flex flex-col gap-0 p-0 sm:max-w-150">
			<Sheet.Header class="p-6">
				<Sheet.Title>{selectedProvider ? 'Edit Provider' : 'Add Provider'}</Sheet.Title>
				<Sheet.Description>
					{selectedProvider
						? 'Edit the configuration for this provider.'
						: 'Add a new provider to the system.'}
				</Sheet.Description>
			</Sheet.Header>
			<div class="flex-1 overflow-y-auto p-6 pt-0">
				{#key isSheetOpen}
					<ProviderForm parameter={selectedProvider} onsuccess={onFormSuccess} />
				{/key}
			</div>
		</Sheet.Content>
	</Sheet.Root>
</div>
