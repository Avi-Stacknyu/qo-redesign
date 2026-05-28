<script lang="ts" generics="TData, TValue">
	import { page, navigating } from '$app/state';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { createSvelteTable } from '$lib/components/shadcn/data-table';
	import FlexRender from '$lib/components/shadcn/data-table/flex-render.svelte';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import * as Table from '$lib/components/shadcn/table/index.js';
	import {
		Search,
		ChevronLeftIcon,
		ChevronRightIcon,
		ChevronsLeftIcon,
		ChevronsRightIcon,
		Loader2,
		X
	} from '@lucide/svelte';

	import type { CustomFilters } from '$lib/types/table-types';
	import {
		getCoreRowModel,
		getFacetedRowModel,
		getFacetedUniqueValues,
		getFilteredRowModel,
		getPaginationRowModel,
		type Column,
		type ColumnDef,
		type ColumnFiltersState,
		type PaginationState,
		type RowSelectionState,
		type SortingState,
		type VisibilityState
	} from '@tanstack/table-core';
	import DataTableFacetedFilter from './data-table-faceted-filter.svelte';
	import {
		buildApplySearchParams,
		buildClearSearchParams,
		shouldSubmitTableSearch
	} from './data-table-search';
	import DataTableViewOptions from './data-table-view-options.svelte';

	let {
		id,
		columns,
		customFilters,
		pageSize = 10,
		data,
		enableRowSelection = false,
		onSelectionChange
	}: {
		id: string;
		pageSize?: number;
		columns: ColumnDef<TData, TValue>[];
		customFilters?: CustomFilters;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: { items: any[]; totalItems: number; totalPages: number; page: number; perPage: number };
		enableRowSelection?: boolean;
		onSelectionChange?: (rows: TData[]) => void;
	} = $props();

	// Show loading when navigating and URL contains this table's params
	const isTableLoading = $derived(
		navigating !== null && navigating.to?.url.search.includes(`${id}_`)
	);

	/**
	 * Update URL search params and trigger SvelteKit load function rerun.
	 * This is the SSR mechanism: goto() causes the +page.server.ts load to re-execute,
	 * the server fetches fresh data, and SvelteKit swaps the page atomically.
	 */
	async function updateSearchParam(params: Record<string, string>) {
		const currentPageUrl = page.url;
		const searchParams = new URLSearchParams(currentPageUrl.search);

		Object.entries(params).forEach(([key, value]) => {
			const paramKey = `${id}_${key}`;
			if (value === '' || value === null || value === undefined) {
				searchParams.delete(paramKey);
			} else {
				searchParams.set(paramKey, value);
			}
		});

		const newUrl = `${currentPageUrl.pathname}?${searchParams}`;
		await goto(newUrl, {
			replaceState: true,
			invalidateAll: false,
			keepFocus: true,
			noScroll: true
		});
	}

	async function applySearch() {
		pagination = { ...pagination, pageIndex: 0 };
		await updateSearchParam(buildApplySearchParams(searchState));
	}

	async function clearSearch() {
		searchState = '';
		pagination = { ...pagination, pageIndex: 0 };
		await updateSearchParam(buildClearSearchParams());
	}

	function getTableParam(key: string) {
		return page.url.searchParams.get(`${id}_${key}`);
	}

	function getPaginationState(): PaginationState {
		return {
			pageIndex: (data.page || 1) - 1,
			pageSize: data.perPage || pageSize
		};
	}

	function getInitialColumnFilters(): ColumnFiltersState {
		const filtersParam = getTableParam('filters');
		if (!filtersParam) return [];

		const filters = JSON.parse(filtersParam) as [string, string, string | [string]][];
		return filters.map((filter) => ({
			id: filter[0],
			value: filter[2]
		}));
	}

	function getInitialSorting(): SortingState {
		const sortParam = getTableParam('sort');
		if (!sortParam) return [];

		const sortArray = JSON.parse(sortParam) as string[];
		return sortArray.map((sortStr) => {
			const [sortId, descStr] = sortStr.split(':');
			return {
				id: sortId,
				desc: descStr === 'desc'
			};
		});
	}

	function getSearchState() {
		return getTableParam('search') ?? '';
	}

	let pagination = $state<PaginationState>(getPaginationState());

	let columnFilters = $state<ColumnFiltersState>(getInitialColumnFilters());
	let sortOptions = $state<SortingState>(getInitialSorting());
	let columnVisibility = $state<VisibilityState>({});
	let rowSelection = $state<RowSelectionState>({});

	// Sync pagination state when server data changes (e.g. after goto triggers load rerun)
	$effect(() => {
		pagination = getPaginationState();
		rowSelection = {};
	});

	const table = createSvelteTable({
		manualPagination: true,
		manualFiltering: true,
		manualSorting: true,
		get rowCount() {
			return data.totalItems;
		},
		get data() {
			return data.items;
		},
		get columns() {
			return columns;
		},
		get enableRowSelection() {
			return enableRowSelection;
		},
		state: {
			get sorting() {
				return sortOptions;
			},
			get pagination() {
				return pagination;
			},
			get columnFilters() {
				return columnFilters;
			},
			get columnVisibility() {
				return columnVisibility;
			},
			get rowSelection() {
				return rowSelection;
			}
		},

		onRowSelectionChange: (updater) => {
			if (typeof updater === 'function') {
				rowSelection = updater(rowSelection);
			} else {
				rowSelection = updater;
			}
			onSelectionChange?.(table.getFilteredSelectedRowModel().rows.map((r) => r.original));
		},

		onPaginationChange: async (updater) => {
			if (typeof updater === 'function') {
				pagination = updater(pagination);
			} else {
				pagination = updater;
			}

			await updateSearchParam({
				page: String(pagination.pageIndex + 1),
				perPage: String(pagination.pageSize || pageSize)
			});
		},

		onSortingChange: async (updater) => {
			if (typeof updater === 'function') {
				sortOptions = updater(sortOptions);
			} else {
				sortOptions = updater;
			}

			const sortParam = sortOptions.map((sort) => `${sort.id}:${sort.desc ? 'desc' : 'asc'}`);

			await updateSearchParam({ sort: JSON.stringify(sortParam) });
		},

		onColumnFiltersChange: async (updater) => {
			if (typeof updater === 'function') {
				columnFilters = updater(columnFilters);
			} else {
				columnFilters = updater;
			}

			const dat = columnFilters.map((filter) => {
				let tarray = [];
				tarray.push(filter.id);
				tarray.push('~');
				tarray.push(filter.value);
				return tarray;
			});

			// Reset to first page when filtering
			pagination = { ...pagination, pageIndex: 0 };

			await updateSearchParam({
				filters: JSON.stringify(dat),
				page: '1'
			});
		},

		onColumnVisibilityChange: (updater) => {
			if (typeof updater === 'function') {
				columnVisibility = updater(columnVisibility);
			} else {
				columnVisibility = updater;
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues()
	});

	let searchState = $state(getSearchState());
	const isFiltered = $derived(table.getState().columnFilters.length > 0);

	$effect(() => {
		searchState = getSearchState();
	});
</script>

<div class="w-full flex-col justify-start gap-6 space-y-4 px-4 lg:px-6">
	<div class="flex items-center justify-between">
		<div class="flex flex-1 items-center space-x-2">
			{#if !customFilters?.disableSearch}
				<div class="flex items-center gap-2">
					<Input
						placeholder="Type To Filter ..."
						bind:value={searchState}
						onkeydown={async (e) => {
							if (!shouldSubmitTableSearch(e)) return;
							await applySearch();
						}}
						class="h-8 w-37.5 lg:w-62.5"
					/>
					<Button variant="outline" onclick={applySearch} class="h-8 px-2 lg:px-3">
						<Search class="size-4" />
						<span class="sr-only">Search table</span>
					</Button>
					{#if searchState}
						<Button variant="outline" onclick={clearSearch} class="h-8 px-2 lg:px-3">
							<X />
						</Button>
					{/if}
				</div>
			{/if}

			{#if customFilters?.facetedFilters}
				{#each customFilters.facetedFilters as facet}
					<DataTableFacetedFilter
						column={table.getColumn(facet.column) as Column<TData, unknown>}
						title={facet.title}
						options={facet.options}
					/>
				{/each}

				{#if isFiltered}
					<Button
						variant="ghost"
						onclick={async () => {
							table.resetColumnFilters();
							await updateSearchParam({ filters: '' });
						}}
						class="h-8 px-2 lg:px-3"
					>
						Reset
						<X />
					</Button>
				{/if}
			{/if}
		</div>
		<DataTableViewOptions {table} />
	</div>

	<div class="relative rounded-md border">
		{#if isTableLoading}
			<div
				class="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-[1px]"
			>
				<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		{/if}
		<Table.Root>
			<Table.Header>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						{#each headerGroup.headers as header (header.id)}
							<Table.Head colspan={header.colSpan}>
								{#if !header.isPlaceholder}
									<FlexRender
										content={header.column.columnDef.header}
										context={header.getContext()}
									/>
								{/if}
							</Table.Head>
						{/each}
					</Table.Row>
				{/each}
			</Table.Header>
			<Table.Body>
				{#each table.getRowModel().rows as row (row.id)}
					<Table.Row data-state={row.getIsSelected() && 'selected'}>
						{#each row.getVisibleCells() as cell (cell.id)}
							<Table.Cell>
								<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
							</Table.Cell>
						{/each}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={columns.length} class="h-24 text-center">No results.</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
	{@render Pagination()}
</div>

{#snippet Pagination()}
	<div class="flex items-center justify-between px-2">
		<div class="flex-1 text-sm text-muted-foreground">
			{table.getFilteredSelectedRowModel().rows.length} of
			{table.getFilteredRowModel().rows.length} row(s) selected.
		</div>
		<div class="flex items-center space-x-6 lg:space-x-8">
			<div class="flex items-center space-x-2">
				<p class="text-sm font-medium">Rows per page</p>
				<Select.Root
					allowDeselect={false}
					type="single"
					value={`${table.getState().pagination.pageSize}`}
					onValueChange={(value) => {
						table.setPageSize(Number(value));
					}}
				>
					<Select.Trigger class="h-8 w-17.5">
						{String(table.getState().pagination.pageSize)}
					</Select.Trigger>
					<Select.Content side="top">
						{#each [10, 20, 30, 40, 50] as size (size)}
							<Select.Item value={`${size}`}>
								{size}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="flex w-25 items-center justify-center text-sm font-medium">
				Page {table.getState().pagination.pageIndex + 1} of
				{table.getPageCount()}
			</div>
			<div class="flex items-center space-x-2">
				<Button
					variant="outline"
					class="hidden size-8 p-0 lg:flex"
					onclick={() => table.setPageIndex(0)}
					disabled={!table.getCanPreviousPage()}
				>
					<span class="sr-only">Go to first page</span>
					<ChevronsLeftIcon />
				</Button>
				<Button
					variant="outline"
					class="size-8 p-0"
					onclick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
				>
					<span class="sr-only">Go to previous page</span>
					<ChevronLeftIcon />
				</Button>
				<Button
					variant="outline"
					class="size-8 p-0"
					onclick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
				>
					<span class="sr-only">Go to next page</span>
					<ChevronRightIcon />
				</Button>
				<Button
					variant="outline"
					class="hidden size-8 p-0 lg:flex"
					onclick={() => table.setPageIndex(table.getPageCount() - 1)}
					disabled={!table.getCanNextPage()}
				>
					<span class="sr-only">Go to last page</span>
					<ChevronsRightIcon />
				</Button>
			</div>
		</div>
	</div>
{/snippet}
