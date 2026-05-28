import { error } from '@sveltejs/kit';
import { getTableData } from '$lib/functions/server-pagination';
import { coreCreditLedger, planPaymentTransactions } from '@repo/db/schema';
import { sql, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const userId = event.params.id;
	if (!userId) throw error(400, 'Missing user id');
	const db = event.locals.db;

	const tableData = await getTableData({
		id: 'transactions_table',
		event,
		table: coreCreditLedger,
		searchFilters: ['transaction_type', 'description', 'notes'],
		sortKey: '-created',
		defaultFilter: sql`${coreCreditLedger.user} = ${userId}`
	});

	if (tableData.items.length === 0) return { tableData };

	const txnIds = [...new Set(tableData.items.map((t) => t.paymentTnx).filter(Boolean))] as string[];

	const txns =
		txnIds.length > 0
			? await db
					.select()
					.from(planPaymentTransactions)
					.where(inArray(planPaymentTransactions.id, txnIds))
			: [];

	const txnMap = new Map(txns.map((t) => [t.id, t]));

	const enriched = tableData.items.map((t) => ({
		...t,
		expand: {
			payment_tnx: txnMap.get(t.paymentTnx ?? '') ?? undefined
		}
	}));

	return { tableData: { ...tableData, items: enriched } };
};
