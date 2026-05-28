// import { renderComponent, renderSnippet } from '$lib/components/shadcn/data-table';
// import type { ColumnDef } from '@tanstack/table-core';
// import type { Checkbox } from 'bits-ui';
// import { createRawSnippet } from 'svelte';
// import type { Task } from '../data/schemas';

// const columns: ColumnDef<Task>[] = [
// 	{
// 		id: 'select',
// 		header: ({ table }) =>
// 			renderComponent(Checkbox, {
// 				checked: table.getIsAllPageRowsSelected(),
// 				onCheckedChange: (value) => table.toggleAllPageRowsSelected(value),
// 				indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
// 				'aria-label': 'Select all'
// 			}),
// 		cell: ({ row }) =>
// 			renderComponent(Checkbox, {
// 				checked: row.getIsSelected(),
// 				onCheckedChange: (value) => row.toggleSelected(value),
// 				'aria-label': 'Select row'
// 			}),
// 		enableSorting: false,
// 		enableHiding: false
// 	},
// 	{
// 		accessorKey: 'id',
// 		header: ({ column }) => {
// 			return renderSnippet(ColumnHeader, {
// 				column,
// 				title: 'Task'
// 			});
// 		},
// 		cell: ({ row }) => {
// 			const idSnippet = createRawSnippet<[{ id: string }]>((getId) => {
// 				const { id } = getId();
// 				return {
// 					render: () => `<div class="w-[80px]">${id}</div>`
// 				};
// 			});

// 			return renderSnippet(idSnippet, {
// 				id: row.original.id
// 			});
// 		},
// 		enableSorting: false,
// 		enableHiding: false
// 	},
// 	{
// 		accessorKey: 'title',
// 		header: ({ column }) => renderSnippet(ColumnHeader, { column, title: 'Title' }),
// 		cell: ({ row }) => {
// 			return renderSnippet(TitleCell, {
// 				labelValue: row.original.label,
// 				value: row.original.title
// 			});
// 		}
// 	},
// 	{
// 		accessorKey: 'status',
// 		header: ({ column }) =>
// 			renderSnippet(ColumnHeader, {
// 				column,
// 				title: 'Status'
// 			}),
// 		cell: ({ row }) => {
// 			return renderSnippet(StatusCell, {
// 				value: row.original.status
// 			});
// 		},
// 		filterFn: (row, id, value) => {
// 			return value.includes(row.getValue(id));
// 		}
// 	},
// 	{
// 		accessorKey: 'priority',
// 		header: ({ column }) => {
// 			return renderSnippet(ColumnHeader, {
// 				title: 'Priority',
// 				column
// 			});
// 		},
// 		cell: ({ row }) => {
// 			return renderSnippet(PriorityCell, {
// 				value: row.original.priority
// 			});
// 		},
// 		filterFn: (row, id, value) => {
// 			return value.includes(row.getValue(id));
// 		}
// 	},
// 	{
// 		id: 'actions',
// 		cell: ({ row }) => renderSnippet(RowActions, { row })
// 	}
// ];
