<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import * as Sheet from '$lib/components/shadcn/sheet';
	import DataTable from '$lib/components/table/data-table.svelte';
	import BadgeCell from '$lib/components/table/widgets/badge-cell.svelte';
	import TitleSubtitleCell from '$lib/components/table/widgets/title-subtitle-cell.svelte';
	import BulkTagSheet from '$lib/components/bulk-tag-sheet.svelte';
	import { Tag } from '@lucide/svelte';
	import type { ColumnDef } from '@tanstack/table-core';
	import type { AnalyticalToolRow } from '@repo/db/types';
	import type { TagRule } from '@repo/shared/types';
	import ToolForm from './tool-form.svelte';
	import ToolRowActions from './tool-row-actions.svelte';
	import { getTagCatalogForTools, getToolsForBulkPreview, bulkSetToolTagRule } from './tool.remote';
	import { getTagRulePresets, createPresetAction } from '../tags/tags.remote';

	let { data } = $props();
	type ToolRow = AnalyticalToolRow;

	let isSheetOpen = $state(false);
	let isBulkTagOpen = $state(false);
	let selectedTool = $state<ToolRow | null>(null);
	let selectedTools = $state<ToolRow[]>([]);

	let selectedIds = $derived(selectedTools.map((t) => t.id));

	const catalogQuery = getTagCatalogForTools();
	let catalog = $derived(catalogQuery.current ?? []);
	const presetsQuery = getTagRulePresets();
	let presets = $derived(presetsQuery.current ?? []);

	async function loadToolPreviews(ids: string[]) {
		const items = await getToolsForBulkPreview({ ids });
		return items.map((t) => {
			const rule = t.tag_rule as { groups: { tags: string[] }[] } | null;
			const tags = rule?.groups?.flatMap((g) => g.tags) ?? [];
			return { id: t.id, name: t.name, tags };
		});
	}

	async function applyToolTags(ids: string[], tagRule: TagRule, mode: 'replace' | 'append') {
		await bulkSetToolTagRule({ ids, tag_rule: tagRule, mode });
	}

	const columns: ColumnDef<ToolRow>[] = [
		{
			id: 'select',
			header: ({ table }) =>
				renderComponent(Checkbox, {
					checked: table.getIsAllPageRowsSelected(),
					indeterminate: table.getIsSomePageRowsSelected(),
					onCheckedChange: (v: boolean) => table.toggleAllPageRowsSelected(!!v)
				}),
			cell: ({ row }) =>
				renderComponent(Checkbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (v: boolean) => row.toggleSelected(!!v)
				}),
			enableSorting: false,
			enableHiding: false
		},
		{
			accessorKey: 'displayName',
			header: 'Name',
			cell: ({ row }) =>
				renderComponent(TitleSubtitleCell, {
					title: row.original.displayName ?? '',
					subtitle: row.original.toolKey ?? ''
				})
		},
		{
			accessorKey: 'category',
			header: 'Category',
			cell: ({ row }) =>
				renderComponent(BadgeCell, {
					variant: 'outline',
					value: row.original.category || '-'
				})
		},
		{
			accessorKey: 'computationType',
			header: 'Compute',
			cell: ({ row }) =>
				renderComponent(BadgeCell, {
					variant: 'secondary',
					value: row.original.computationType || 'worker'
				})
		},
		{
			accessorKey: 'isActive',
			header: 'Status',
			cell: ({ row }) =>
				renderComponent(BadgeCell, {
					variant: row.original.isActive ? 'default' : 'secondary',
					value: row.original.isActive ? 'Active' : 'Inactive'
				})
		},
		{
			id: 'tag_rule',
			header: 'Gated',
			cell: ({ row }) => (row.original.tagRule ? 'Yes' : 'No')
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
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold tracking-tight">Analytical Tools</h2>
				<p class="text-muted-foreground">
					Manage analytical tools — input schemas, output configs, and tag-based visibility.
				</p>
			</div>
			<div class="flex items-center space-x-2">
				{#if selectedTools.length > 0}
					<Button variant="outline" size="sm" onclick={() => (isBulkTagOpen = true)}>
						<Tag class="mr-2 h-4 w-4" />
						Set Tags ({selectedTools.length})
					</Button>
				{/if}
				<Button onclick={handleAdd}>Add Tool</Button>
			</div>
		</div>
	</div>

	<DataTable
		id="analytical_tools_table"
		{columns}
		data={data.tableData}
		enableRowSelection
		onSelectionChange={(rows) => {
			selectedTools = rows;
		}}
	/>
</div>

<Sheet.Root bind:open={isSheetOpen}>
	<Sheet.Content class="overflow-y-auto sm:max-w-2xl">
		<Sheet.Header>
			<Sheet.Title>{selectedTool ? 'Edit Tool' : 'Add Tool'}</Sheet.Title>
			<Sheet.Description>
				Configure the analytical tool definition, input schema, output config, and tag visibility.
			</Sheet.Description>
		</Sheet.Header>
		<div class="-mt-3 px-4">
			{#key isSheetOpen}
				<ToolForm tool={selectedTool} onsuccess={handleSuccess} />
			{/key}
		</div>
	</Sheet.Content>
</Sheet.Root>

<BulkTagSheet
	bind:open={isBulkTagOpen}
	selectedCount={selectedTools.length}
	{selectedIds}
	entityLabel="tool"
	{catalog}
	{presets}
	loadPreviews={loadToolPreviews}
	onApply={applyToolTags}
	onSavePreset={async (name, tagRule) => {
		await createPresetAction({ name, tag_rule: tagRule });
	}}
/>
