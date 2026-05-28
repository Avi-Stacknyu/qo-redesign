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
	import type { TagRule } from '@repo/shared/types';
	import TemplateForm from './template-form.svelte';
	import TemplateRowActions from './template-row-actions.svelte';
	import type { TemplateRow } from './template.remote';
	import {
		getTagCatalogForTemplates,
		getTemplatesForBulkPreview,
		bulkSetTemplateTagRule
	} from './template.remote';
	import { getTagRulePresets, createPresetAction } from '../tags/tags.remote';

	let { data } = $props();

	let isSheetOpen = $state(false);
	let isBulkTagOpen = $state(false);
	let selectedTemplate = $state<TemplateRow | null>(null);
	let selectedTemplates = $state<TemplateRow[]>([]);

	let selectedIds = $derived(selectedTemplates.map((t) => t.id));

	const catalogQuery = getTagCatalogForTemplates();
	let catalog = $derived(catalogQuery.current ?? []);
	const presetsQuery = getTagRulePresets();
	let presets = $derived(presetsQuery.current ?? []);

	async function loadTemplatePreviews(ids: string[]) {
		const items = await getTemplatesForBulkPreview({ ids });
		return items.map((t) => {
			const rule = t.tag_rule as { groups: { tags: string[] }[] } | null;
			const tags = rule?.groups?.flatMap((g) => g.tags) ?? [];
			return { id: t.id, name: t.name, tags };
		});
	}

	async function applyTemplateTags(ids: string[], tagRule: TagRule, mode: 'replace' | 'append') {
		await bulkSetTemplateTagRule({ ids, tag_rule: tagRule, mode });
	}

	const columns: ColumnDef<TemplateRow>[] = [
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
					subtitle: row.original.description || '',
					href: `/dashboard-templates/${row.original.id}`
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
			id: 'widgets',
			header: 'Widgets',
			cell: ({ row }) => {
				const widgets = row.original.defaultWidgets as unknown[];
				const count = Array.isArray(widgets) ? widgets.length : 0;
				return `${count} widget${count !== 1 ? 's' : ''}`;
			}
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
				renderComponent(TemplateRowActions, {
					row,
					onEdit: () => {
						selectedTemplate = row.original;
						isSheetOpen = true;
					}
				})
		}
	];

	function handleAdd() {
		selectedTemplate = null;
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
				<h2 class="text-2xl font-bold tracking-tight">Dashboard Templates</h2>
				<p class="text-muted-foreground">
					Manage dashboard templates that define default widget layouts for user profiles.
				</p>
			</div>
			<div class="flex items-center space-x-2">
				{#if selectedTemplates.length > 0}
					<Button variant="outline" size="sm" onclick={() => (isBulkTagOpen = true)}>
						<Tag class="mr-2 h-4 w-4" />
						Set Tags ({selectedTemplates.length})
					</Button>
				{/if}
				<Button onclick={handleAdd}>Add Template</Button>
			</div>
		</div>
	</div>

	<DataTable
		id="templates_table"
		{columns}
		data={data.tableData}
		enableRowSelection
		onSelectionChange={(rows) => {
			selectedTemplates = rows;
		}}
	/>
</div>

<Sheet.Root bind:open={isSheetOpen}>
	<Sheet.Content class="overflow-y-auto sm:max-w-2xl">
		<Sheet.Header>
			<Sheet.Title>{selectedTemplate ? 'Edit Template' : 'Add Template'}</Sheet.Title>
			<Sheet.Description>
				Configure the dashboard template name, default widgets, and tag-based visibility.
			</Sheet.Description>
		</Sheet.Header>
		<div class="-mt-3 px-4">
			{#key isSheetOpen}
				<TemplateForm template={selectedTemplate} onsuccess={handleSuccess} />
			{/key}
		</div>
	</Sheet.Content>
</Sheet.Root>

<BulkTagSheet
	bind:open={isBulkTagOpen}
	selectedCount={selectedTemplates.length}
	{selectedIds}
	entityLabel="template"
	{catalog}
	{presets}
	loadPreviews={loadTemplatePreviews}
	onApply={applyTemplateTags}
	onSavePreset={async (name, tagRule) => {
		await createPresetAction({ name, tag_rule: tagRule });
	}}
/>
