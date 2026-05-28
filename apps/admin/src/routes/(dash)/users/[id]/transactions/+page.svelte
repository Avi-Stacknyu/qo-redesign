<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import { renderComponent } from '$lib/components/shadcn/data-table';
	import DataTable from '$lib/components/table/data-table.svelte';
	import TableHeaderCell from '$lib/components/table/widgets/table-header-cell.svelte';
	import type { CoreCreditLedgerRow, PlanPaymentTransactionRow } from '@repo/db/types';
	import type { ColumnDef } from '@tanstack/table-core';
	import { createRawSnippet } from 'svelte';
	import PaymentDetailsDialog from '../payment-details-dialog.svelte';

	type LedgerEntryWithPayment = CoreCreditLedgerRow & {
		expand?: { payment_tnx?: PlanPaymentTransactionRow };
	};

	let { data } = $props();

	let isPaymentDialogOpen = $state(false);
	let selectedPayment = $state<PlanPaymentTransactionRow | null>(null);

	function openPaymentDetails(payment: PlanPaymentTransactionRow) {
		selectedPayment = payment;
		isPaymentDialogOpen = true;
	}

	const transactionColumns: ColumnDef<LedgerEntryWithPayment>[] = [
		{
			accessorKey: 'created',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Date' }),
			enableSorting: true,
			cell: ({ row }) =>
				row.original.created ? new Date(row.original.created).toLocaleDateString() : '—'
		},
		{
			accessorKey: 'transactionType',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Type' }),
			enableSorting: true,
			cell: ({ row }) => {
				const type = row.original.transactionType || 'unknown';
				const isCredit = row.original.type === 'credit';
				return renderComponent(Badge, {
					variant: isCredit ? 'default' : 'secondary',
					children: createRawSnippet(() => ({
						render: () => `<span class="capitalize text-[11px]">${type}</span>`
					}))
				});
			}
		},
		{
			accessorKey: 'creditsChanged',
			header: ({ column }) => renderComponent(TableHeaderCell, { column, title: 'Credits' }),
			enableSorting: true,
			cell: ({ row }) => {
				const amount = Number(row.original.creditsChanged ?? 0);
				const isCredit = row.original.type === 'credit';
				return `${isCredit ? '+' : '-'}${Math.abs(amount).toFixed(2)}`;
			}
		},
		{
			id: 'balance',
			header: 'Balance',
			cell: ({ row }) => {
				const before =
					row.original.balanceBefore != null ? Number(row.original.balanceBefore).toFixed(2) : '-';
				const after =
					row.original.balanceAfter != null ? Number(row.original.balanceAfter).toFixed(2) : '-';
				return `${before} → ${after}`;
			}
		},
		{
			id: 'reference',
			header: 'Reference',
			cell: ({ row }) => {
				const payment = row.original.expand?.payment_tnx;
				if (payment) return `${(payment.provider ?? '').toUpperCase()} (${payment.status})`;
				if (row.original.transactionType === 'adjustment') return 'Admin';
				if (row.original.transactionType === 'usage') return 'AI Usage';
				return '-';
			}
		},
		{
			id: 'payment_details',
			header: 'Payment',
			cell: ({ row }) => {
				const payment = row.original.expand?.payment_tnx;
				if (!payment) return '-';
				const displayId = payment.providerPaymentId || payment.id;
				return renderComponent(Button, {
					variant: 'link',
					class: 'h-auto p-0 text-primary underline font-mono text-xs',
					onclick: () => openPaymentDetails(payment),
					children: createRawSnippet(() => ({
						render: () => `<span>${displayId}</span>`
					}))
				});
			}
		},
		{
			accessorKey: 'description',
			header: 'Description',
			cell: ({ row }) => {
				const desc = row.original.description || row.original.notes || '-';
				return desc.length > 40 ? desc.slice(0, 39) + '…' : desc;
			}
		},
		{
			id: 'metadata_info',
			header: 'Meta',
			cell: ({ row }) => {
				const metadata = row.original.metadata;
				if (!metadata || typeof metadata !== 'object') return '—';
				const keys = Object.keys(metadata);
				if (keys.length === 0) return '—';
				return `${keys.length} field${keys.length > 1 ? 's' : ''}`;
			}
		}
	];
</script>

<DataTable id="transactions_table" columns={transactionColumns} data={data.tableData} />

<PaymentDetailsDialog bind:open={isPaymentDialogOpen} payment={selectedPayment} />
