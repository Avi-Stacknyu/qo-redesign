<script lang="ts">
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog';
	import { Button } from '$lib/components/shadcn/button';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import * as Sheet from '$lib/components/shadcn/sheet';
	import DataTable from '$lib/components/table/data-table.svelte';
	import BadgeCell from '$lib/components/table/widgets/badge-cell.svelte';
	import ProviderCell from '$lib/components/table/widgets/provider-cell.svelte';
	import TableHeaderCell from '$lib/components/table/widgets/table-header-cell.svelte';
	import TitleSubtitleCell from '$lib/components/table/widgets/title-subtitle-cell.svelte';
	import type { ColumnDef } from '@tanstack/table-core';
	import ModelForm from './model-form.svelte';
	import ModelRowActions from './model-row-actions.svelte';
	import {
		bulkDeleteAiAgentModels,
		bulkUpdateAiAgentModels,
		getModelEditorData,
		getProviderOptions,
		getToolOptions,
		getTagCatalogForModels,
		triggerModelSync,
		type BulkBlockedModel,
		type BulkModelMutationResult
	} from './model.remote';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import type { ModelEditorData, ModelTableItem } from './model-page-data';

	let { data } = $props();

	const providerOptionsQuery = getProviderOptions();
	const toolOptionsQuery = getToolOptions();
	const catalogQuery = getTagCatalogForModels();

	const providerOptions = $derived(providerOptionsQuery.current ?? []);
	const toolOptions = $derived(toolOptionsQuery.current ?? []);
	const catalogOptions = $derived(catalogQuery.current ?? []);
	const optionsLoading = $derived(
		providerOptionsQuery.loading || toolOptionsQuery.loading || catalogQuery.loading
	);
	const optionsError = $derived(
		providerOptionsQuery.error ?? toolOptionsQuery.error ?? catalogQuery.error
	);

	let isSheetOpen = $state(false);
	let selectedModelId = $state<string | null>(null);
	let selectedModel = $state<ModelEditorData | null>(null);
	let selectedModelLoading = $state(false);
	let selectedModelError = $state<Error | null>(null);
	let syncing = $state(false);
	let selectedModels = $state<ModelTableItem[]>([]);
	let bulkDeleteOpen = $state(false);
	let bulkActionLoading = $state<
		'activate' | 'deactivate' | 'lockSync' | 'unlockSync' | 'delete' | null
	>(null);

	const selectedIds = $derived(selectedModels.map((model) => model.id));
	const selectedCount = $derived(selectedModels.length);

	async function loadModelEditor(id: string) {
		selectedModelLoading = true;
		selectedModelError = null;
		selectedModel = null;
		try {
			selectedModel = await getModelEditorData(id).run();
		} catch (e) {
			selectedModelError = e as Error;
		} finally {
			selectedModelLoading = false;
		}
	}

	async function handleSync() {
		syncing = true;
		try {
			const result = await triggerModelSync();
			if (result?.success && 'created' in result) {
				toast.success(
					`Sync complete: ${result.created} created, ${result.updated} updated, ${result.deprecated} deprecated, ${result.pricingUpdated} pricing updated, ${result.toolsAssigned} tools assigned`
				);
				await invalidateAll();
			} else {
				toast.error(result?.error || 'Sync failed');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Sync failed');
		} finally {
			syncing = false;
		}
	}

	function summarizeBlockedModels(blocked: BulkBlockedModel[]) {
		const labels = blocked.slice(0, 3).map((model) => model.name);
		if (blocked.length <= 3) return labels.join(', ');
		return `${labels.join(', ')} and ${blocked.length - 3} more`;
	}

	function reportBulkResult(result: BulkModelMutationResult, successMessage: string) {
		if (!result.success) {
			toast.error(result.error || 'Bulk action failed');
			return false;
		}

		if (result.changed > 0) {
			toast.success(`${successMessage} ${result.changed} model${result.changed === 1 ? '' : 's'}.`);
		} else {
			toast.error('No selected models could be updated.');
		}

		if (result.blocked.length > 0) {
			toast.error(
				`Skipped ${result.blocked.length} model${result.blocked.length === 1 ? '' : 's'} with dependencies: ${summarizeBlockedModels(result.blocked)}`
			);
		}

		if (result.skipped > 0) {
			toast.error(
				`Skipped ${result.skipped} model${result.skipped === 1 ? '' : 's'} that were not eligible for this action.`
			);
		}

		return true;
	}

	async function runBulkUpdate(
		action: 'activate' | 'deactivate' | 'lockSync' | 'unlockSync',
		successMessage: string
	) {
		bulkActionLoading = action;
		try {
			const result = await bulkUpdateAiAgentModels({ ids: selectedIds, action });
			const shouldRefresh = reportBulkResult(result, successMessage);
			if (shouldRefresh) {
				selectedModels = [];
				await invalidateAll();
			}
		} catch (e) {
			toast.error((e as Error).message || 'Bulk action failed');
		} finally {
			bulkActionLoading = null;
		}
	}

	async function handleBulkDelete() {
		bulkActionLoading = 'delete';
		try {
			const result = await bulkDeleteAiAgentModels({ ids: selectedIds });
			const shouldRefresh = reportBulkResult(result, 'Deleted');
			if (shouldRefresh) {
				selectedModels = [];
				bulkDeleteOpen = false;
				await invalidateAll();
			}
		} catch (e) {
			toast.error((e as Error).message || 'Bulk delete failed');
		} finally {
			bulkActionLoading = null;
		}
	}

	const columns: ColumnDef<ModelTableItem>[] = [
		{
			id: 'select',
			header: ({ table }) =>
				renderComponent(Checkbox, {
					checked: table.getIsAllPageRowsSelected(),
					indeterminate: table.getIsSomePageRowsSelected(),
					onCheckedChange: (value: boolean) => table.toggleAllPageRowsSelected(!!value)
				}),
			cell: ({ row }) =>
				renderComponent(Checkbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (value: boolean) => row.toggleSelected(!!value)
				}),
			enableSorting: false,
			enableHiding: false
		},
		{
			accessorKey: 'displayName',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Name' }),
			cell: ({ row }) =>
				renderComponent(TitleSubtitleCell, {
					title: row.original.displayName ?? '',
					subtitle: row.original.description ?? undefined
				})
		},
		{
			accessorKey: 'provider',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Provider' }),
			cell: ({ row }) =>
				renderComponent(ProviderCell, {
					value: row.original.expand?.provider?.providerKey ?? ''
				})
		},
		{
			accessorKey: 'modelId',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Base Model' }),
			cell: ({ row }) => {
				return row.original.modelId;
			}
		},
		{
			accessorKey: 'supported_tools',
			header: 'Tools',
			enableSorting: false,
			cell: ({ row }) => {
				const count = row.original.expand.supportedToolCount;
				return count === 0 ? 'None' : count + ' tools';
			}
		},
		{
			accessorKey: 'isActive',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Status' }),
			cell: ({ row }) => {
				if (row.original.isSystemDefault) {
					return renderComponent(BadgeCell, {
						variant: 'default',
						value: '⭐ Default'
					});
				}
				return renderComponent(BadgeCell, {
					variant: row.original.isActive ? 'default' : 'secondary',
					value: row.original.isActive ? 'Active' : 'Inactive'
				});
			}
		},
		{
			accessorKey: 'syncStatus',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Sync' }),
			cell: ({ row }) => {
				const status = row.original.syncStatus;
				if (!status || status === 'local_only') {
					return renderComponent(BadgeCell, { variant: 'outline', value: 'Local' });
				}
				if (status === 'synced') {
					return renderComponent(BadgeCell, { variant: 'default', value: 'Synced' });
				}
				if (status === 'override') {
					return renderComponent(BadgeCell, { variant: 'secondary', value: 'Locked' });
				}
				if (status === 'deprecated') {
					return renderComponent(BadgeCell, { variant: 'destructive', value: 'Deprecated' });
				}
				return renderComponent(BadgeCell, { variant: 'outline', value: status });
			}
		},
		{
			id: 'actions',
			accessorKey: 'actions',
			enableSorting: false,
			cell: ({ row }) =>
				renderComponent(ModelRowActions, {
					row,
					onEdit: () => {
						selectedModelId = row.original.id;
						isSheetOpen = true;
						loadModelEditor(row.original.id);
					}
				})
		}
	];

	function handleAdd() {
		selectedModelId = null;
		selectedModel = null;
		selectedModelError = null;
		selectedModelLoading = false;
		isSheetOpen = true;
	}

	function handleSuccess() {
		isSheetOpen = false;
	}

	$effect(() => {
		if (!isSheetOpen) {
			selectedModelId = null;
			selectedModel = null;
			selectedModelError = null;
		}
	});
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<div class="flex flex-col gap-3 px-4 lg:px-6 xl:flex-row xl:items-center xl:justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">AI Models</h2>
			<p class="text-muted-foreground">Manage AI agent models and their tool configurations.</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if selectedCount > 0}
				<Button
					variant="outline"
					size="sm"
					onclick={() => runBulkUpdate('activate', 'Activated everywhere for')}
					disabled={!!bulkActionLoading}
				>
					Activate Everywhere ({selectedCount})
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => runBulkUpdate('deactivate', 'Deactivated everywhere for')}
					disabled={!!bulkActionLoading}
				>
					Deactivate Everywhere
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => runBulkUpdate('unlockSync', 'Allowed sync for')}
					disabled={!!bulkActionLoading}
				>
					Allow Sync
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => runBulkUpdate('lockSync', 'Stopped sync for')}
					disabled={!!bulkActionLoading}
				>
					Stop Sync
				</Button>
				<Button
					variant="destructive"
					size="sm"
					onclick={() => (bulkDeleteOpen = true)}
					disabled={!!bulkActionLoading}
				>
					Delete Selected
				</Button>
			{/if}
			<Button variant="outline" onclick={handleSync} disabled={syncing}>
				{#if syncing}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Syncing…
				{:else}
					<RefreshCw class="mr-2 h-4 w-4" />
					Sync from OpenRouter
				{/if}
			</Button>
			<Button onclick={handleAdd}>Add Model</Button>
		</div>
	</div>

	<DataTable
		id="models_table"
		{columns}
		data={data.tableData}
		enableRowSelection
		onSelectionChange={(rows) => {
			selectedModels = rows;
		}}
	/>
</div>

<Sheet.Root bind:open={isSheetOpen}>
	<Sheet.Content class="overflow-y-auto sm:max-w-125">
		<Sheet.Header>
			<Sheet.Title>{selectedModel ? 'Edit Model' : 'Add Model'}</Sheet.Title>
			<Sheet.Description>Configure the AI model and its available tools.</Sheet.Description>
		</Sheet.Header>

		{#if optionsLoading || selectedModelLoading}
			<div class="w-full p-4 text-center">Loading options...</div>
		{:else if optionsError}
			<div class="py-4 text-destructive">Error loading options: {optionsError}</div>
		{:else if selectedModelError}
			<div class="py-4 text-destructive">Error loading model: {selectedModelError.message}</div>
		{:else}
			{#key `${isSheetOpen}:${selectedModelId ?? 'new'}`}
				<ModelForm
					model={selectedModel}
					providerOptions={providerOptions as any}
					toolOptions={toolOptions as any}
					{catalogOptions}
					onsuccess={handleSuccess}
				/>
			{/key}
		{/if}
	</Sheet.Content>
</Sheet.Root>

<AlertDialog.Root bind:open={bulkDeleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Selected Models</AlertDialog.Title>
			<AlertDialog.Description>
				Delete the currently selected {selectedCount} model{selectedCount === 1 ? '' : 's'}. Models
				with dependencies or a system-default assignment will be skipped automatically.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={bulkActionLoading === 'delete'}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				onclick={handleBulkDelete}
				disabled={bulkActionLoading === 'delete'}
			>
				{#if bulkActionLoading === 'delete'}
					Deleting…
				{:else}
					Delete Selected
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
