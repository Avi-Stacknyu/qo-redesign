<script lang="ts">
	import SectionCards from '$lib/components/layout/section-cards.svelte';
	import DataTable from '$lib/components/table/data-table.svelte';

	import { renderComponent } from '$lib/components/shadcn/data-table';
	import TableHeaderCell from '$lib/components/table/widgets/table-header-cell.svelte';
	import TableTitleCell from '$lib/components/table/widgets/table-title-cell.svelte';
	import UserRowActions from './user-row-actions.svelte';
	import { getUserStats } from '$lib/remote/user.remote';
	type UserRow = Record<string, any>;
	import type { CustomFilters } from '$lib/types/table-types';
	import type { ColumnDef } from '@tanstack/table-core';
	import { Badge } from '$lib/components/shadcn/badge';
	import { createRawSnippet } from 'svelte';

	let { data } = $props();

	const userStatsQuery = getUserStats();
	const userStats = $derived(userStatsQuery.current);

	type MetricCard = {
		description: string;
		value: string;
		change: {
			percentage: string;
			trend: 'positive' | 'negative';
			note: string;
		};
	};

	function buildStatsCards(
		stats: ReturnType<typeof getUserStats>['current']
	): MetricCard[] {
		if (!stats) {
			return Array.from({ length: 4 }, () => ({
				description: 'Loading...',
				value: '-',
				change: { percentage: '', trend: 'positive', note: '' }
			}));
		}

		return [
			{
				description: 'Total Users',
				value: stats.totalUsers?.toLocaleString(),
				change: { percentage: '', trend: 'positive', note: 'Total registered users' }
			},
			{
				description: 'Active Users',
				value: stats.activeUsers?.toLocaleString(),
				change: { percentage: '', trend: 'positive', note: 'Users with active status' }
			},
			{
				description: 'Total Credits Assigned',
				value: stats.totalCreditsAssigned?.toLocaleString(),
				change: { percentage: '', trend: 'positive', note: 'Lifetime purchased credits' }
			},
			{
				description: 'System Status',
				value: 'Active',
				change: { percentage: '', trend: 'positive', note: 'System operational' }
			}
		];
	}

	let statsCardsData: MetricCard[] = $derived(buildStatsCards(userStats));

	const columns: ColumnDef<UserRow>[] = [
		// {
		// 	accessorKey: 'id',
		// 	header: ({ column }) => {
		// 		return renderComponent(TableHeaderCell, {
		// 			column,
		// 			title: 'Task'
		// 		});
		// 	},
		// 	cell: ({ row }) => {
		// 		const idSnippet = createRawSnippet<[{ id: string }]>((getId) => {
		// 			const { id } = getId();
		// 			return {
		// 				render: () => `<div class="w-[80px]">${id}</div>`
		// 			};
		// 		});

		// 		return renderSnippet(idSnippet, {
		// 			id: row.original.id
		// 		});
		// 	},
		// 	enableSorting: false,
		// 	enableHiding: false
		// },

		{
			accessorKey: 'name',
			header: () => 'Name',
			cell: ({ row }) => {
				return renderComponent(TableTitleCell, {
					labelValue: row.original.name,
					value: row.original.name
				});
			}
		},
		{
			accessorKey: 'email',
			header: ({ column }) => {
				return renderComponent(TableHeaderCell, {
					column,
					title: 'Email'
				});
			},

			enableSorting: false,
			enableHiding: false
		},
		{
			accessorKey: 'trialClaimed',
			header: ({ column }) => {
				return renderComponent(TableHeaderCell, {
					column,
					title: 'Trial Claimed'
				});
			},
			enableHiding: false
		},
		{
			accessorKey: 'accountStatus',
			header: ({ column }) => {
				return renderComponent(TableHeaderCell, {
					column,
					title: 'Status'
				});
			},
			cell: ({ row }) => {
				const status = row.original.accountStatus;
				return renderComponent(Badge, {
					variant: status === 'active' ? 'default' : 'destructive',
					children: createRawSnippet(() => ({
						render: () => `<span>${status}</span>`
					}))
				});
			},
			enableHiding: false
		},
		{
			accessorFn: (row) => row?.expand?.role?.name ?? 'User',
			id: 'role.name',
			header: ({ column }) => {
				return renderComponent(TableHeaderCell, {
					column,
					title: 'Role'
				});
			}
		},

		{
			accessorFn: (row) => row?.expand?.plan?.type,
			id: 'plan.type',
			header: ({ column }) => {
				return renderComponent(TableHeaderCell, {
					column,
					title: 'Plan'
				});
			}
		},
		{
			accessorKey: 'created',
			accessorFn: (row) => new Date(row.created).toLocaleDateString(),
			header: ({ column }) => {
				return renderComponent(TableHeaderCell, {
					column,
					title: 'Joined At'
				});
			},
			enableSorting: true,
			enableHiding: false
		},
		{
			id: 'credits',
			header: ({ column }) => {
				return renderComponent(TableHeaderCell, {
					column,
					title: 'Credits'
				});
			},
			cell: ({ row }) => {
				const balanceRecord = (row.original.expand as any)?.['user_credit_balance(user)']?.[0];
				const balance = Number(balanceRecord?.balance ?? 0);
				return renderComponent(TableTitleCell, {
					value: balance.toFixed(2)
				});
			}
		},
		{
			id: 'actions',
			cell: ({ row }) => renderComponent(UserRowActions, { row })
		}
	];
	// 	header: ({ column }) =>
	// 		renderSnippet(ColumnHeader, {
	// 			column,
	// 			title: 'Status'
	// 		}),
	// 	cell: ({ row }) => {
	// 		return renderSnippet(StatusCell, {
	// 			value: row.original.status
	// 		});
	// 	},
	// 	filterFn: (row, id, value) => {
	// 		return value.includes(row.getValue(id));
	// 	}
	// },
	// {
	// 	accessorKey: 'priority',
	// 	header: ({ column }) => {
	// 		return renderSnippet(ColumnHeader, {
	// 			title: 'Priority',
	// 			column
	// 		});
	// 	},
	// 	cell: ({ row }) => {
	// 		return renderSnippet(PriorityCell, {
	// 			value: row.original.priority
	// 		});
	// 	},

	// },
	// {
	// 	id: 'actions',
	// 	cell: ({ row }) => renderSnippet(RowActions, { row })
	// }

	const tableFilter: CustomFilters = {
		facetedFilters: [
			{
				column: 'role.name',
				title: 'Role',
				options: [{ label: 'Admin', value: 'Super Admin' }]
			},
			{
				column: 'plan.type',
				title: 'Plan',
				options: [
					{ label: 'Trial', value: 'trial' },
					{ label: 'Pro', value: 'Pro' },
					{ label: 'Enterprise', value: 'Enterprise' }
				]
			}
		]
	};
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<SectionCards data={statsCardsData} />
	<DataTable
		id="users_table"
		customFilters={tableFilter}
		{columns}
		data={data.tableData}
		pageSize={10}
	/>
</div>
