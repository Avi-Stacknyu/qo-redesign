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
	import type { DashboardWidgetRow } from '@repo/db/types';
	import type { ColumnDef } from '@tanstack/table-core';
	import type { TagRule } from '@repo/shared/types';
	import WidgetForm from './widget-form.svelte';
	import WidgetRowActions from './widget-row-actions.svelte';
	import {
		getTagCatalogForWidgets,
		getWidgetsForBulkPreview,
		bulkSetWidgetTagRule
	} from './widget.remote';
	import { getTagRulePresets, createPresetAction } from '../tags/tags.remote';

	let { data } = $props();
	type WidgetRow = DashboardWidgetRow;

	let isSheetOpen = $state(false);
	let isBulkTagOpen = $state(false);
	let selectedWidget = $state<WidgetRow | null>(null);
	let selectedWidgets = $state<WidgetRow[]>([]);

	let selectedIds = $derived(selectedWidgets.map((w) => w.id));

	const catalogQuery = getTagCatalogForWidgets();
	let catalog = $derived(catalogQuery.current ?? []);
	const presetsQuery = getTagRulePresets();
	let presets = $derived(presetsQuery.current ?? []);

	async function loadWidgetPreviews(ids: string[]) {
		const items = await getWidgetsForBulkPreview({ ids });
		return items.map((w) => {
			const rule = w.tag_rule as { groups: { tags: string[] }[] } | null;
			const tags = rule?.groups?.flatMap((g) => g.tags) ?? [];
			return { id: w.id, name: w.name, tags };
		});
	}

	async function applyWidgetTags(ids: string[], tagRule: TagRule, mode: 'replace' | 'append') {
		await bulkSetWidgetTagRule({ ids, tag_rule: tagRule, mode });
	}

	const columns: ColumnDef<WidgetRow>[] = [
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
			accessorKey: 'name',
			header: 'Name',
			cell: ({ row }) =>
				renderComponent(TitleSubtitleCell, {
					title: row.original.name ?? '',
					subtitle: row.original.description || row.original.widgetType || ''
				})
		},
		{
			id: 'kind',
			header: 'Kind',
			cell: ({ row }) =>
				renderComponent(BadgeCell, {
					variant: row.original.baseType ? 'outline' : 'default',
					value: row.original.baseType ? `Variant of ${row.original.baseType}` : 'Base'
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
			accessorKey: 'defaultSize',
			header: 'Size',
			cell: ({ row }) =>
				renderComponent(BadgeCell, {
					variant: 'secondary',
					value: row.original.defaultSize || 'md'
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
				renderComponent(WidgetRowActions, {
					row,
					onEdit: () => {
						selectedWidget = row.original;
						isSheetOpen = true;
					}
				})
		}
	];

	function handleAdd() {
		selectedWidget = null;
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
				<h2 class="text-2xl font-bold tracking-tight">Widget Catalog</h2>
				<p class="text-muted-foreground">
					Manage the widget catalog — base widgets, variants, default configs, and tag visibility.
				</p>
			</div>
			<div class="flex items-center space-x-2">
				{#if selectedWidgets.length > 0}
					<Button variant="outline" size="sm" onclick={() => (isBulkTagOpen = true)}>
						<Tag class="mr-2 h-4 w-4" />
						Set Tags ({selectedWidgets.length})
					</Button>
				{/if}
				<Button onclick={handleAdd}>Add Widget</Button>
			</div>
		</div>
	</div>

	<DataTable
		id="widgets_table"
		{columns}
		data={data.tableData}
		enableRowSelection
		onSelectionChange={(rows) => {
			selectedWidgets = rows;
		}}
	/>
</div>

<Sheet.Root bind:open={isSheetOpen}>
	<Sheet.Content class="overflow-y-auto sm:max-w-2xl">
		<Sheet.Header>
			<Sheet.Title>{selectedWidget ? 'Edit Widget' : 'Add Widget'}</Sheet.Title>
			<Sheet.Description>
				Configure the widget type, default configuration, locked fields, and tag-based visibility.
			</Sheet.Description>
		</Sheet.Header>
		<div class="-mt-3 px-4">
			{#key isSheetOpen}
				<WidgetForm widget={selectedWidget} onsuccess={handleSuccess} />
			{/key}
		</div>
	</Sheet.Content>
</Sheet.Root>

<BulkTagSheet
	bind:open={isBulkTagOpen}
	selectedCount={selectedWidgets.length}
	{selectedIds}
	entityLabel="widget"
	{catalog}
	{presets}
	loadPreviews={loadWidgetPreviews}
	onApply={applyWidgetTags}
	onSavePreset={async (name, tagRule) => {
		await createPresetAction({ name, tag_rule: tagRule });
	}}
/>
