import { getRequestEvent, query } from '$app/server';
import { coreTokenLedger, users } from '@repo/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import z from 'zod/v4';

import { buildCostingAnalyticsDto } from './costing.dto';

const inputSchema = z.object({
	range: z.enum(['7d', '30d', '90d'])
});

function rangeToDays(range: '7d' | '30d' | '90d') {
	switch (range) {
		case '7d':
			return 7;
		case '30d':
			return 30;
		case '90d':
			return 90;
	}
}

export const getAiSpendAnalytics = query(inputSchema, async ({ range }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const days = rangeToDays(range);
	const start = new Date();
	start.setUTCHours(0, 0, 0, 0);
	start.setUTCDate(start.getUTCDate() - (days - 1));
	const startIso = start.toISOString();
	const rangeFilter = gte(coreTokenLedger.created, startIso);
	const dayBucket = sql<string>`(${coreTokenLedger.created}::date)::text`;

	const [summaryRows, dailyUsage, providerUsage, modelUsage, categoryUsage, topSpenders] =
		await Promise.all([
			db
				.select({
					totalCost: sql<string>`coalesce(sum(${coreTokenLedger.costUsd}), 0)`,
					totalTokens: sql<string>`coalesce(sum(${coreTokenLedger.tokens}), 0)`,
					totalRequests: sql<number>`count(*)::int`,
					uniqueUsers: sql<number>`count(distinct ${coreTokenLedger.user})::int`,
					uniqueModels: sql<number>`count(distinct ${coreTokenLedger.model})::int`
				})
				.from(coreTokenLedger)
				.where(rangeFilter),
			db
				.select({
					day: dayBucket,
					totalCost: sql<string>`coalesce(sum(${coreTokenLedger.costUsd}), 0)`
				})
				.from(coreTokenLedger)
				.where(rangeFilter)
				.groupBy(dayBucket)
				.orderBy(dayBucket),
			db
				.select({
					provider: coreTokenLedger.provider,
					totalCost: sql<string>`coalesce(sum(${coreTokenLedger.costUsd}), 0)`,
					totalTokens: sql<string>`coalesce(sum(${coreTokenLedger.tokens}), 0)`
				})
				.from(coreTokenLedger)
				.where(rangeFilter)
				.groupBy(coreTokenLedger.provider),
			db
				.select({
					model: coreTokenLedger.model,
					totalCost: sql<string>`coalesce(sum(${coreTokenLedger.costUsd}), 0)`,
					totalTokens: sql<string>`coalesce(sum(${coreTokenLedger.tokens}), 0)`,
					requestCount: sql<number>`count(*)::int`
				})
				.from(coreTokenLedger)
				.where(rangeFilter)
				.groupBy(coreTokenLedger.model),
			db
				.select({
					category: coreTokenLedger.category,
					totalCost: sql<string>`coalesce(sum(${coreTokenLedger.costUsd}), 0)`,
					totalTokens: sql<string>`coalesce(sum(${coreTokenLedger.tokens}), 0)`,
					requestCount: sql<number>`count(*)::int`
				})
				.from(coreTokenLedger)
				.where(rangeFilter)
				.groupBy(coreTokenLedger.category),
			db
				.select({
					userId: coreTokenLedger.user,
					name: users.name,
					email: users.email,
					totalCost: sql<string>`coalesce(sum(${coreTokenLedger.costUsd}), 0)`,
					totalTokens: sql<string>`coalesce(sum(${coreTokenLedger.tokens}), 0)`,
					requestCount: sql<number>`count(*)::int`
				})
				.from(coreTokenLedger)
				.leftJoin(users, eq(coreTokenLedger.user, users.id))
				.where(rangeFilter)
				.groupBy(coreTokenLedger.user, users.name, users.email)
				.orderBy(sql`coalesce(sum(${coreTokenLedger.costUsd}), 0) desc`)
				.limit(10)
		]);

	return buildCostingAnalyticsDto({
		range,
		windowStartIso: startIso,
		summaryRow: summaryRows[0],
		dailyUsage,
		providerUsage,
		modelUsage,
		categoryUsage,
		topSpenders
	});
});
