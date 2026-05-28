import { getTableData } from '$lib/functions/server-pagination';
import { users, planPackages, coreRolePermissions, userCreditBalance } from '@repo/db/schema';
import { inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = event.locals.db;

	const tableData = await getTableData({
		id: 'users_table',
		event,
		table: users,
		searchFilters: ['name', 'email'],
		sortKey: '-created'
	});

	if (tableData.items.length === 0) return { tableData };

	const planIds = [...new Set(tableData.items.map((u) => u.plan).filter(Boolean))] as string[];
	const roleIds = [...new Set(tableData.items.map((u) => u.role).filter(Boolean))] as string[];
	const userIds = tableData.items.map((u) => u.id);

	const [plans, roles, balances] = await Promise.all([
		planIds.length > 0
			? db.select().from(planPackages).where(inArray(planPackages.id, planIds))
			: [],
		roleIds.length > 0
			? db.select().from(coreRolePermissions).where(inArray(coreRolePermissions.id, roleIds))
			: [],
		db.select().from(userCreditBalance).where(inArray(userCreditBalance.user, userIds))
	]);

	const planMap = new Map(plans.map((p) => [p.id, p]));
	const roleMap = new Map(roles.map((r) => [r.id, r]));
	const balanceMap = new Map(balances.map((b) => [b.user, b]));

	const enriched = tableData.items.map((u) => ({
		...u,
		expand: {
			plan: planMap.get(u.plan ?? '') ?? undefined,
			role: roleMap.get(u.role ?? '') ?? undefined,
			'user_credit_balance(user)': balanceMap.get(u.id) ? [balanceMap.get(u.id)!] : undefined
		}
	}));

	return { tableData: { ...tableData, items: enriched } };
};
