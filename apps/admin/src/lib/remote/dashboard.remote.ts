import { query, getRequestEvent } from '$app/server';
import {
	viewProviderUsage,
	viewDailyUsage,
	userCreditBalance,
	viewTopSpenders,
	viewModelUsage,
	coreTokenLedger,
	users,
	planPackages
} from '@repo/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

function safeNum(v: unknown): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function round6(n: number) {
	return Math.round(n * 1_000_000) / 1_000_000;
}

export const getDashboardStats = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	// Compute date strings for filtering
	const now = new Date();
	const todayStr = now.toISOString().slice(0, 10);
	const yesterday = new Date(now);
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);
	const yesterdayStr = yesterday.toISOString().slice(0, 10);
	const sevenDaysAgo = new Date(now);
	sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
	const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

	const [providerUsage, dailyUsage, balances, topSpendersRows, modelUsageRows, recentActivityRows] =
		await Promise.all([
			db.select().from(viewProviderUsage),
			db.select().from(viewDailyUsage).orderBy(viewDailyUsage.day),
			db.select().from(userCreditBalance),
			db
				.select({
					user: viewTopSpenders.user,
					totalCost: viewTopSpenders.totalCost,
					totalTokens: viewTopSpenders.totalTokens,
					requestCount: viewTopSpenders.requestCount,
					userName: users.name,
					userEmail: users.email,
					planTitle: planPackages.title
				})
				.from(viewTopSpenders)
				.leftJoin(users, eq(viewTopSpenders.user, users.id))
				.leftJoin(planPackages, eq(users.plan, planPackages.id))
				.orderBy(desc(viewTopSpenders.totalCost))
				.limit(5),
			db.select().from(viewModelUsage).orderBy(desc(viewModelUsage.totalCost)).limit(10),
			db
				.select({
					id: coreTokenLedger.id,
					user: coreTokenLedger.user,
					model: coreTokenLedger.model,
					provider: coreTokenLedger.provider,
					category: coreTokenLedger.category,
					tokens: coreTokenLedger.tokens,
					costUsd: coreTokenLedger.costUsd,
					created: coreTokenLedger.created,
					userName: users.name,
					userEmail: users.email
				})
				.from(coreTokenLedger)
				.leftJoin(users, eq(coreTokenLedger.user, users.id))
				.orderBy(desc(coreTokenLedger.created))
				.limit(10)
		]);

	const totalDistributedCredits = balances.reduce((acc, curr) => acc + safeNum(curr.balance), 0);
	const totalUsageUSD = providerUsage.reduce((acc, curr) => acc + safeNum(curr.totalCost), 0);

	// --- Today vs Yesterday comparison ---
	const todayCost = dailyUsage
		.filter((d) => d.day === todayStr)
		.reduce((s, r) => s + safeNum(r.totalCost), 0);
	const yesterdayCost = dailyUsage
		.filter((d) => d.day === yesterdayStr)
		.reduce((s, r) => s + safeNum(r.totalCost), 0);
	const todayVsYesterdayPercent =
		yesterdayCost > 0 ? round6(((todayCost - yesterdayCost) / yesterdayCost) * 100) : null;

	// --- 7-day sparkline data ---
	const last7Days = dailyUsage
		.filter((d) => (d.day ?? '') >= sevenDaysAgoStr)
		.map((d) => ({
			day: d.day ?? '',
			costUsd: round6(safeNum(d.totalCost))
		}));

	// --- 7-day total vs previous 7-day total for trend ---
	const fourteenDaysAgo = new Date(now);
	fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);
	const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().slice(0, 10);
	const prev7Cost = dailyUsage
		.filter((d) => {
			const day = d.day ?? '';
			return day >= fourteenDaysAgoStr && day < sevenDaysAgoStr;
		})
		.reduce((s, r) => s + safeNum(r.totalCost), 0);
	const curr7Cost = last7Days.reduce((s, d) => s + d.costUsd, 0);
	const weekOverWeekPercent =
		prev7Cost > 0 ? round6(((curr7Cost - prev7Cost) / prev7Cost) * 100) : null;

	// --- Provider breakdown for donut (sorted + with tokens) ---
	const providerBreakdown = providerUsage
		.map((p) => ({
			label: (p.provider || 'unknown').toString(),
			costUsd: round6(safeNum(p.totalCost)),
			tokens: Math.round(safeNum(p.totalTokens))
		}))
		.sort((a, b) => b.costUsd - a.costUsd);

	// --- Avg daily cost (last 7 days) ---
	const avgDailyCost7d = last7Days.length > 0 ? round6(curr7Cost / last7Days.length) : 0;

	return {
		providerUsage,
		dailyUsage,
		totalDistributedCredits,
		totalUsageUSD,
		topSpenders: topSpendersRows,
		modelUsage: modelUsageRows,
		recentActivity: recentActivityRows,
		// New enhanced data
		todayCost: round6(todayCost),
		yesterdayCost: round6(yesterdayCost),
		todayVsYesterdayPercent,
		last7Days,
		curr7DayCost: round6(curr7Cost),
		weekOverWeekPercent,
		providerBreakdown,
		avgDailyCost7d
	};
});
