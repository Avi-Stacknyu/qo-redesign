<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/shadcn/button';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import * as Sheet from '$lib/components/shadcn/sheet';
	import DataTable from '$lib/components/table/data-table.svelte';
	import BadgeCell from '$lib/components/table/widgets/badge-cell.svelte';
	import TagsCell from '$lib/components/table/widgets/tags-cell.svelte';
	import TableTitleCell from '$lib/components/table/widgets/table-title-cell.svelte';
	import { Tag } from '@lucide/svelte';
	import type { AiAgentRow } from '@repo/db/types';
	import type { ColumnDef } from '@tanstack/table-core';
	import AgentForm from './agent-form.svelte';
	import AgentRowActions from './agent-row-actions.svelte';
	import BulkTagSheet from '$lib/components/bulk-tag-sheet.svelte';
	import type { TagRule } from '@repo/shared/types';
	import {
		getTagCatalogForBulk,
		bulkSetAgentTagRule,
		getAgentsForBulkPreview
	} from './agent.remote';
	import { getTagRulePresets, createPresetAction } from '../tags/tags.remote';
	import { getTagRuleTags } from '$lib/utils/tag-helpers';

	let { data } = $props();

	type AgentRow = AiAgentRow;

	let isSheetOpen = $state(false);
	let isBulkTagOpen = $state(false);
	let selectedAgent = $state<AgentRow | null>(null);
	let selectedAgents = $state<AgentRow[]>([]);

	let selectedIds = $derived(selectedAgents.map((a) => a.id));

	const catalogQuery = getTagCatalogForBulk();
	let catalog = $derived(catalogQuery.current?.tags ?? []);
	const presetsQuery = getTagRulePresets();
	let presets = $derived(presetsQuery.current ?? []);

	async function loadAgentPreviews(ids: string[]) {
		const agents = await getAgentsForBulkPreview({ agentIds: ids });
		return agents.map((a) => ({ id: a.id, name: a.name, tags: a.tags }));
	}

	async function applyAgentTags(ids: string[], tagRule: TagRule, mode: 'replace' | 'append') {
		await bulkSetAgentTagRule({ agentIds: ids, tag_rule: tagRule, mode });
	}

	function openCreate() {
		selectedAgent = null;
		isSheetOpen = true;
	}

	function openEdit(agent: AgentRow) {
		selectedAgent = agent;
		isSheetOpen = true;
	}

	function onFormSuccess() {
		isSheetOpen = false;
		invalidateAll();
	}

	const columns: ColumnDef<AgentRow>[] = [
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
			cell: ({ row }) => renderComponent(TableTitleCell, { value: row.original.name ?? '' })
		},
		{
			accessorKey: 'description',
			header: 'Description',
			cell: ({ row }) => row.original.description
		},
		{
			id: 'tags',
			header: 'Tags',
			cell: ({ row }) => {
				const tags = getTagRuleTags((row.original.tagRule as TagRule | null) ?? null);
				return renderComponent(TagsCell, { tags });
			}
		},
		{
			accessorKey: 'status',
			header: 'Status',
			cell: ({ row }) => {
				return renderComponent(BadgeCell, {
					variant: row.original.status ? 'default' : 'secondary',
					value: row.original.status ? row.original.status : '--'
				});
			}
		},
		{
			id: 'actions',
			cell: ({ row }) => {
				return renderComponent(AgentRowActions, { row, onEdit: () => openEdit(row.original) });
			}
		}
	];
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<div class="space-y-6 px-4 lg:px-6">
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-bold">AI Agents</h1>
			<div class="flex items-center gap-2">
				{#if selectedAgents.length > 0}
					<Button variant="outline" size="sm" onclick={() => (isBulkTagOpen = true)}>
						<Tag class="mr-2 h-4 w-4" />
						Set Tags ({selectedAgents.length})
					</Button>
				{/if}
				<Button onclick={openCreate}>Add Agent</Button>
			</div>
		</div>
	</div>

	<DataTable
		id="agents_table"
		{columns}
		data={data.tableData}
		enableRowSelection
		onSelectionChange={(rows) => {
			selectedAgents = rows;
		}}
	/>

	<Sheet.Root bind:open={isSheetOpen}>
		<Sheet.Content class="flex flex-col gap-0 overflow-y-auto p-0 sm:max-w-150">
			<Sheet.Header class="p-6">
				<Sheet.Title>{selectedAgent ? 'Edit Agent' : 'Add Agent'}</Sheet.Title>
			</Sheet.Header>
			<div class="flex-1 overflow-y-auto p-6 pt-0">
				{#key isSheetOpen}
					<AgentForm agent={selectedAgent as any} onsuccess={onFormSuccess} />
				{/key}
			</div>
		</Sheet.Content>
	</Sheet.Root>

	<BulkTagSheet
		bind:open={isBulkTagOpen}
		selectedCount={selectedAgents.length}
		{selectedIds}
		entityLabel="agent"
		catalog={catalog as any}
		presets={presets as any}
		loadPreviews={loadAgentPreviews}
		onApply={applyAgentTags}
		onSavePreset={async (name, tagRule) => {
			await createPresetAction({ name, tag_rule: tagRule });
		}}
	/>
</div>
