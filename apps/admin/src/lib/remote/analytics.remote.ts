import { getRequestEvent, query } from '$app/server';
import {
	viewDailyUsage,
	viewCategoryUsage,
	viewChatCosts,
	viewHourlyUsage,
	viewModelDailyUsage,
	viewUserDailyUsage,
	users,
	planPackages
} from '@repo/db/schema';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { z } from 'zod/v4';
import { buildAnalyticsDto, buildModelDrilldownDto } from './analytics.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rangeSchema = z.object({
	range: z.enum(['7d', '30d', '90d', 'all'])
});

function round6(n: number) {
	return Math.round(n * 1_000_000) / 1_000_000;
}

function safeNum(v: unknown): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function rangeToDays(range: '7d' | '30d' | '90d' | 'all') {
	switch (range) {
		case '7d':
			return 7;
		case '30d':
			return 30;
		case '90d':
			return 90;
		case 'all':
			return 365 * 10;
	}
}

function startDateStrForRange(range: '7d' | '30d' | '90d' | 'all') {
	const days = rangeToDays(range);
	const start = new Date();
	start.setUTCHours(0, 0, 0, 0);
	start.setUTCDate(start.getUTCDate() - (days - 1));
	return start.toISOString().slice(0, 10);
}

function prevPeriodDateStrs(range: '7d' | '30d' | '90d' | 'all') {
	const days = rangeToDays(range);
	const end = new Date();
	end.setUTCHours(0, 0, 0, 0);
	end.setUTCDate(end.getUTCDate() - (days - 1));
	const start = new Date(end);
	start.setUTCDate(start.getUTCDate() - days);
	return {
		startStr: start.toISOString().slice(0, 10),
		endStr: end.toISOString().slice(0, 10)
	};
}

// ---------------------------------------------------------------------------
// 13a. getGlobalAnalytics — aggregate stats from views
// ---------------------------------------------------------------------------

export const getGlobalAnalytics = query(rangeSchema, async ({ range }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const startStr = startDateStrForRange(range);
	const prev = prevPeriodDateStrs(range);

	const dayFilter = range === 'all' ? undefined : gte(viewDailyUsage.day, startStr);
	const prevDayFilter = and(
		gte(viewDailyUsage.day, prev.startStr),
		lt(viewDailyUsage.day, prev.endStr)
	);

	const [
		dailyUsage,
		prevDailyUsage,
		categoryUsage,
		userUsageRows,
		chatCosts,
		hourlyUsage,
		modelDailyUsage
	] = await Promise.all([
		db.select().from(viewDailyUsage).where(dayFilter).orderBy(viewDailyUsage.day),
		db.select().from(viewDailyUsage).where(prevDayFilter),
		db
			.select()
			.from(viewCategoryUsage)
			.where(range === 'all' ? undefined : gte(viewCategoryUsage.day, startStr))
			.orderBy(viewCategoryUsage.day),
		db
			.select({
				userId: viewUserDailyUsage.user,
				totalCost: viewUserDailyUsage.totalCost,
				totalTokens: viewUserDailyUsage.totalTokens,
				requestCount: viewUserDailyUsage.requestCount,
				userName: users.name,
				userEmail: users.email,
				plan: planPackages.title
			})
			.from(viewUserDailyUsage)
			.leftJoin(users, eq(viewUserDailyUsage.user, users.id))
			.leftJoin(planPackages, eq(users.plan, planPackages.id))
			.where(range === 'all' ? undefined : gte(viewUserDailyUsage.day, startStr)),
		db
			.select()
			.from(viewChatCosts)
			.where(range === 'all' ? undefined : gte(viewChatCosts.lastMessageAt, startStr))
			.orderBy(desc(viewChatCosts.totalCostUsd)),
		db
			.select()
			.from(viewHourlyUsage)
			.where(range === 'all' ? undefined : gte(viewHourlyUsage.hour, startStr)),
		db
			.select()
			.from(viewModelDailyUsage)
			.where(range === 'all' ? undefined : gte(viewModelDailyUsage.day, startStr))
			.orderBy(viewModelDailyUsage.day)
	]);

	// --- Chat cost distribution (histogram buckets) ---
	const chatCostValues = chatCosts
		.map((c) => safeNum(c.totalCostUsd))
		.filter((v) => v > 0)
		.sort((a, b) => a - b);

	let histogram: { rangeMin: number; rangeMax: number; count: number }[] = [];

	if (chatCostValues.length > 0) {
		const p95Idx = Math.min(Math.floor(chatCostValues.length * 0.95), chatCostValues.length - 1);
		const effectiveMax = chatCostValues[p95Idx];
		const absoluteMax = chatCostValues[chatCostValues.length - 1];

		const niceSteps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
		const targetBuckets = 10;
		const rawStep = effectiveMax / targetBuckets;
		const bucketSize = niceSteps.find((s) => s >= rawStep) ?? rawStep;

		const edges: number[] = [];
		for (let e = 0; e < effectiveMax + bucketSize; e = round6(e + bucketSize)) {
			edges.push(round6(e));
			if (edges.length > 20) break;
		}

		histogram = [];
		for (let i = 0; i < edges.length - 1; i++) {
			histogram.push({ rangeMin: edges[i], rangeMax: edges[i + 1], count: 0 });
		}

		if (absoluteMax > effectiveMax && histogram.length > 0) {
			histogram.push({
				rangeMin: histogram[histogram.length - 1].rangeMax,
				rangeMax: round6(absoluteMax + bucketSize),
				count: 0
			});
		}

		for (const cost of chatCostValues) {
			const idx = Math.min(
				histogram.findIndex((b) => cost >= b.rangeMin && cost < b.rangeMax),
				histogram.length - 1
			);
			if (idx >= 0) histogram[idx].count++;
			else if (histogram.length > 0) histogram[histogram.length - 1].count++;
		}

		while (histogram.length > 1 && histogram[histogram.length - 1].count === 0) {
			histogram.pop();
		}
	}

	return buildAnalyticsDto({
		range,
		dailyUsage,
		prevDailyUsage,
		categoryUsage,
		userUsage: userUsageRows.map((row) => ({
			userId: row.userId ?? '',
			name: row.userName ?? null,
			email: row.userEmail ?? null,
			plan: row.plan ?? null,
			totalCost: row.totalCost,
			totalTokens: row.totalTokens,
			requestCount: row.requestCount
		})),
		chatCostHistogram: histogram,
		chatCosts,
		hourlyUsage,
		modelDailyUsage
	});
});

// ---------------------------------------------------------------------------
// 13b. getModelDrilldown — detailed stats for a specific model
// ---------------------------------------------------------------------------

const modelDrilldownSchema = z.object({
	model: z.string().min(1),
	provider: z.string().min(1),
	range: z.enum(['7d', '30d', '90d', 'all'])
});

export const getModelDrilldown = query(modelDrilldownSchema, async ({ model, provider, range }) => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const startStr = startDateStrForRange(range);

	const dayFilter =
		range === 'all'
			? and(eq(viewModelDailyUsage.model, model), eq(viewModelDailyUsage.provider, provider))
			: and(
					eq(viewModelDailyUsage.model, model),
					eq(viewModelDailyUsage.provider, provider),
					gte(viewModelDailyUsage.day, startStr)
				);

	const dailyUsage = await db
		.select({
			day: viewModelDailyUsage.day,
			totalCost: viewModelDailyUsage.totalCost,
			totalTokens: viewModelDailyUsage.totalTokens,
			requestCount: viewModelDailyUsage.requestCount
		})
		.from(viewModelDailyUsage)
		.where(dayFilter)
		.orderBy(viewModelDailyUsage.day);

	return buildModelDrilldownDto({
		model,
		provider,
		dailyUsage
	});
});
