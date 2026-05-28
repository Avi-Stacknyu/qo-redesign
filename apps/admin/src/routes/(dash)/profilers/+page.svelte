<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import * as Sheet from '$lib/components/shadcn/sheet';
	import DataTable from '$lib/components/table/data-table.svelte';
	import BadgeCell from '$lib/components/table/widgets/badge-cell.svelte';
	import TitleSubtitleCell from '$lib/components/table/widgets/title-subtitle-cell.svelte';
	import type { ColumnDef } from '@tanstack/table-core';
	import ProfilerForm from './profiler-form.svelte';
	import ProfilerRowActions from './profiler-row-actions.svelte';
	import type { ProfilerRow } from './profiler.remote';

	let { data } = $props();

	let isSheetOpen = $state(false);
	let selectedProfiler = $state<ProfilerRow | null>(null);

	const columns: ColumnDef<ProfilerRow>[] = [
		{
			accessorKey: 'name',
			header: 'Name',
			cell: ({ row }) =>
				renderComponent(TitleSubtitleCell, {
					title: row.original.name ?? '',
					subtitle: row.original.description ?? undefined
				})
		},
		{
			accessorKey: 'model',
			header: 'Model',
			cell: ({ row }) => {
				const model = row.original.expand?.model;
				if (!model) return '-';
				return renderComponent(BadgeCell, {
					variant: 'outline',
					value: model.displayName ?? ''
				});
			}
		},
		{
			accessorKey: 'status',
			header: 'Status',
			cell: ({ row }) =>
				renderComponent(BadgeCell, {
					variant: row.original.status === 'active' ? 'default' : 'secondary',
					value: row.original.status ?? ''
				})
		},
		// {
		// 	id: 'schema',
		// 	header: 'Schema',
		// 	cell: ({ row }) => {
		// 		const schema = row.original.schema as unknown[];
		// 		const count = Array.isArray(schema) ? schema.length : 0;
		// 		return `${count} section${count !== 1 ? 's' : ''}`;
		// 	}
		// },
		{
			id: 'actions',
			cell: ({ row }) =>
				renderComponent(ProfilerRowActions, {
					row,
					onEdit: () => {
						selectedProfiler = row.original;
						isSheetOpen = true;
					}
				})
		}
	];

	function handleAdd() {
		selectedProfiler = null;
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
				<h2 class="text-2xl font-bold tracking-tight">Profiler Agents</h2>
				<p class="text-muted-foreground">
					Manage profiler agents that extract and maintain user profiles from conversations.
				</p>
			</div>
			<div class="flex items-center space-x-2">
				<Button variant="outline" href="/profilers/global-schema">Global Schema</Button>
				<Button onclick={handleAdd}>Add Profiler</Button>
			</div>
		</div>
	</div>

	<DataTable id="profilers_table" {columns} data={data.tableData} />
</div>

<Sheet.Root bind:open={isSheetOpen}>
	<Sheet.Content class="overflow-y-auto sm:max-w-3xl">
		<Sheet.Header>
			<Sheet.Title>{selectedProfiler ? 'Edit Profiler' : 'Add Profiler'}</Sheet.Title>
			<Sheet.Description>
				Configure the profiler agent's prompt, model, and profile schema.
			</Sheet.Description>
		</Sheet.Header>
		<div class="px-6 pb-6">
			{#key isSheetOpen}
				<ProfilerForm profiler={selectedProfiler} onsuccess={handleSuccess} />
			{/key}
		</div>
	</Sheet.Content>
</Sheet.Root>
