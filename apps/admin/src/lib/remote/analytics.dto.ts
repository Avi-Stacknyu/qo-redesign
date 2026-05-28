import {
	normalizeBreakdownMetricRows,
	type BreakdownMetricRow,
	type HistogramBucket,
	type ModelDrilldownDto,
	type ModelTrendChart,
	type TimeSeriesSpendPoint
} from '$lib/types/analytics-charts';
import { z } from 'zod/v4';

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export interface AnalyticsHeatmapCell {
	dayOfWeek: number;
	hour: number;
	cost: number;
	tokens: number;
	requests: number;
}

export interface AnalyticsModelLeaderboardRow {
	modelKey: string;
	model: string;
	provider: string;
	costUsd: number;
	tokens: number;
	requestCount: number;
	avgCostPerRequest: number;
}

export interface AnalyticsTopSpenderRow {
	userId: string;
	name: string | null;
	email: string | null;
	plan: string | null;
	costUsd: number;
	tokens: number;
	requestCount: number;
}

export interface AnalyticsDto {
	range: AnalyticsRange;
	kpis: {
		totalCostUsd: number;
		totalTokens: number;
		totalChats: number;
		activeUsers: number;
		avgCostPerChat: number;
		avgCostPerUser: number;
		totalRequests: number;
		costChangePercent: number | null;
	};
	charts: {
		spendTimeline: TimeSeriesSpendPoint[];
		providerSpend: Array<{ key: string; label: string; value: number; color?: string }>;
		categoryTokens: Array<{ key: string; label: string; value: number; color?: string }>;
		modelTrend: {
			series: Array<{ key: string; label: string; color: string }>;
			points: Array<{ day: string; values: Record<string, number> }>;
		};
		heatmap: AnalyticsHeatmapCell[];
		costHistogram: HistogramBucket[];
	};
	tables: {
		modelLeaderboard: AnalyticsModelLeaderboardRow[];
		topSpenders: AnalyticsTopSpenderRow[];
	};
}

type DailyUsageRow = {
	day: string | null;
	totalCost: unknown;
};

type CategoryUsageRow = {
	day?: string | null;
	category: string | null;
	totalCost?: unknown;
	totalTokens: unknown;
	requestCount?: unknown;
};

type UserUsageRow = {
	userId: string | null;
	name: string | null;
	email: string | null;
	plan: string | null;
	totalCost: unknown;
	totalTokens: unknown;
	requestCount: unknown;
};

type ChatCostRow = {
	totalCostUsd: unknown;
};

type HourlyUsageRow = {
	dayOfWeek: unknown;
	hourOfDay: unknown;
	totalCost: unknown;
	totalTokens: unknown;
	requestCount: unknown;
};

type ModelDailyUsageRow = {
	day: string | null;
	model: string | null;
	provider: string | null;
	totalCost: unknown;
	totalTokens?: unknown;
	requestCount?: unknown;
};

type ModelDrilldownDailyRow = {
	day: string | null;
	totalCost: unknown;
	totalTokens?: unknown;
	requestCount?: unknown;
};

export interface BuildAnalyticsDtoInput {
	range: AnalyticsRange;
	dailyUsage: DailyUsageRow[];
	prevDailyUsage: DailyUsageRow[];
	categoryUsage: CategoryUsageRow[];
	userUsage: UserUsageRow[];
	chatCostHistogram: HistogramBucket[];
	chatCosts: ChatCostRow[];
	hourlyUsage: HourlyUsageRow[];
	modelDailyUsage: ModelDailyUsageRow[];
}

export interface BuildModelDrilldownDtoInput {
	model: string;
	provider: string;
	dailyUsage: ModelDrilldownDailyRow[];
}

const analyticsRangeSchema = z.enum(['7d', '30d', '90d', 'all']);

const timeSeriesSpendPointSchema = z.object({
	day: z.string(),
	costUsd: z.number().finite()
});

const breakdownMetricRowSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	value: z.number().finite(),
	color: z.string().optional()
});

const modelTrendChartSchema = z.object({
	series: z.array(
		z.object({
			key: z.string().min(1),
			label: z.string().min(1),
			color: z.string().min(1)
		})
	),
	points: z.array(
		z.object({
			day: z.string(),
			values: z.record(z.string(), z.number().finite())
		})
	)
});

const histogramBucketSchema = z.object({
	rangeMin: z.number().finite(),
	rangeMax: z.number().finite(),
	count: z.number().int().nonnegative()
});

const analyticsHeatmapCellSchema = z.object({
	dayOfWeek: z.number().int().min(0).max(6),
	hour: z.number().int().min(0).max(23),
	cost: z.number().finite(),
	tokens: z.number().int().nonnegative(),
	requests: z.number().nonnegative()
});

const analyticsModelLeaderboardRowSchema = z.object({
	modelKey: z.string().min(1),
	model: z.string().min(1),
	provider: z.string().min(1),
	costUsd: z.number().finite(),
	tokens: z.number().int().nonnegative(),
	requestCount: z.number().nonnegative(),
	avgCostPerRequest: z.number().finite()
});

const analyticsTopSpenderRowSchema = z.object({
	userId: z.string(),
	name: z.string().nullable(),
	email: z.string().nullable(),
	plan: z.string().nullable(),
	costUsd: z.number().finite(),
	tokens: z.number().int().nonnegative(),
	requestCount: z.number().nonnegative()
});

const analyticsDtoSchema = z.object({
	range: analyticsRangeSchema,
	kpis: z.object({
		totalCostUsd: z.number().finite(),
		totalTokens: z.number().int().nonnegative(),
		totalChats: z.number().int().nonnegative(),
		activeUsers: z.number().int().nonnegative(),
		avgCostPerChat: z.number().finite(),
		avgCostPerUser: z.number().finite(),
		totalRequests: z.number().nonnegative(),
		costChangePercent: z.number().finite().nullable()
	}),
	charts: z.object({
		spendTimeline: z.array(timeSeriesSpendPointSchema),
		providerSpend: z.array(breakdownMetricRowSchema),
		categoryTokens: z.array(breakdownMetricRowSchema),
		modelTrend: modelTrendChartSchema,
		heatmap: z.array(analyticsHeatmapCellSchema),
		costHistogram: z.array(histogramBucketSchema)
	}),
	tables: z.object({
		modelLeaderboard: z.array(analyticsModelLeaderboardRowSchema),
		topSpenders: z.array(analyticsTopSpenderRowSchema)
	})
});

const modelDrilldownDtoSchema = z.object({
	model: z.string().min(1),
	provider: z.string().min(1),
	totals: z.object({
		costUsd: z.number().finite(),
		tokens: z.number().int().nonnegative(),
		requestCount: z.number().nonnegative(),
		avgCostPerRequest: z.number().finite()
	}),
	spendTimeline: z.array(timeSeriesSpendPointSchema)
});

const MODEL_TREND_COLORS = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)'
];

function round6(value: number) {
	return Math.round(value * 1_000_000) / 1_000_000;
}

function safeNumber(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function coalesceLabel(value: string | null | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : 'unknown';
}

function buildModelKey(model: string | null | undefined, provider: string | null | undefined) {
	return `${slugify(coalesceLabel(provider))}::${slugify(coalesceLabel(model))}`;
}

function slugify(value: string) {
	return (
		value
			.toLowerCase()
			.trim()
			.replace(/[’']/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'unknown'
	);
}

function sortBreakdownRows(rows: BreakdownMetricRow[]) {
	return [...rows].sort((left, right) => {
		const byValue = right.value - left.value;
		return byValue !== 0 ? byValue : left.label.localeCompare(right.label);
	});
}

function buildSpendTimeline(rows: readonly DailyUsageRow[] | readonly ModelDrilldownDailyRow[]) {
	return [...rows]
		.sort((left, right) => (left.day ?? '').localeCompare(right.day ?? ''))
		.map((row) => ({
			day: row.day ?? '',
			costUsd: round6(safeNumber(row.totalCost))
		}));
}

function buildBreakdownRows<T>(
	rows: readonly T[],
	getLabel: (row: T) => string | null | undefined,
	getValue: (row: T) => unknown,
	formatValue: (value: number) => number = round6
) {
	const totalsByLabel = new Map<string, number>();

	for (const row of rows) {
		const label = coalesceLabel(getLabel(row));
		const nextValue = (totalsByLabel.get(label) ?? 0) + safeNumber(getValue(row));
		totalsByLabel.set(label, nextValue);
	}

	return sortBreakdownRows(
		normalizeBreakdownMetricRows(
			Array.from(totalsByLabel, ([label, value]) => ({
				label,
				value: formatValue(value)
			}))
		)
	);
}

type ModelAggregate = {
	modelKey: string;
	model: string;
	provider: string;
	totalCost: number;
	totalTokens: number;
	requestCount: number;
};

function aggregateModelUsage(rows: readonly ModelDailyUsageRow[]) {
	const totalsByModel = new Map<string, ModelAggregate>();

	for (const row of rows) {
		const model = coalesceLabel(row.model);
		const provider = coalesceLabel(row.provider);
		const modelKey = buildModelKey(model, provider);
		const next = totalsByModel.get(modelKey) ?? {
			modelKey,
			model,
			provider,
			totalCost: 0,
			totalTokens: 0,
			requestCount: 0
		};

		next.totalCost += safeNumber(row.totalCost);
		next.totalTokens += safeNumber(row.totalTokens);
		next.requestCount += safeNumber(row.requestCount);
		totalsByModel.set(modelKey, next);
	}

	return Array.from(totalsByModel.values());
}

function aggregateTopSpenders(rows: readonly UserUsageRow[]) {
	const totalsByUser = new Map<string, AnalyticsTopSpenderRow>();

	for (const row of rows) {
		const userId = row.userId ?? '';
		const next = totalsByUser.get(userId) ?? {
			userId,
			name: row.name ?? null,
			email: row.email ?? null,
			plan: row.plan ?? null,
			costUsd: 0,
			tokens: 0,
			requestCount: 0
		};

		next.costUsd = round6(next.costUsd + safeNumber(row.totalCost));
		next.tokens += Math.round(safeNumber(row.totalTokens));
		next.requestCount += safeNumber(row.requestCount);
		next.name ??= row.name ?? null;
		next.email ??= row.email ?? null;
		next.plan ??= row.plan ?? null;
		totalsByUser.set(userId, next);
	}

	return Array.from(totalsByUser.values()).sort((left, right) => {
		const byCost = right.costUsd - left.costUsd;
		return byCost !== 0 ? byCost : left.userId.localeCompare(right.userId);
	});
}

function formatModelTrendLabel(row: ModelAggregate, duplicateModels: ReadonlySet<string>) {
	return duplicateModels.has(row.model) ? `${row.model} (${row.provider})` : row.model;
}

function buildModelTrendChart(modelDailyUsage: readonly ModelDailyUsageRow[]): ModelTrendChart {
	const topModels = aggregateModelUsage(modelDailyUsage)
		.sort((left, right) => {
			const byCost = right.totalCost - left.totalCost;
			return byCost !== 0 ? byCost : left.model.localeCompare(right.model);
		})
		.slice(0, 5);

	const modelCounts = new Map<string, number>();
	for (const row of topModels) {
		modelCounts.set(row.model, (modelCounts.get(row.model) ?? 0) + 1);
	}
	const duplicateModels = new Set(
		Array.from(modelCounts.entries())
			.filter(([, count]) => count > 1)
			.map(([model]) => model)
	);

	const series = topModels.map((row, index) => ({
		key: row.modelKey,
		label: formatModelTrendLabel(row, duplicateModels),
		color: MODEL_TREND_COLORS[index % MODEL_TREND_COLORS.length]
	}));

	const allowedKeys = new Set(series.map((item) => item.key));
	const valuesByDay = new Map<string, Record<string, number>>();

	for (const row of modelDailyUsage) {
		const day = row.day ?? '';
		const key = buildModelKey(row.model, row.provider);

		if (!allowedKeys.has(key)) continue;

		const values = valuesByDay.get(day) ?? {};
		values[key] = round6((values[key] ?? 0) + safeNumber(row.totalCost));
		valuesByDay.set(day, values);
	}

	const points = Array.from(valuesByDay.entries())
		.sort(([leftDay], [rightDay]) => leftDay.localeCompare(rightDay))
		.map(([day, values]) => ({
			day,
			values: Object.fromEntries(
				series.map((item) => [item.key, round6(safeNumber(values[item.key]))])
			)
		}));

	return { series, points };
}

export function buildAnalyticsDto({
	range,
	dailyUsage,
	prevDailyUsage,
	categoryUsage,
	userUsage,
	chatCostHistogram,
	chatCosts,
	hourlyUsage,
	modelDailyUsage
}: BuildAnalyticsDtoInput): AnalyticsDto {
	const modelUsage = aggregateModelUsage(modelDailyUsage);
	const fullWindowUsers = aggregateTopSpenders(userUsage);
	const topSpenders = fullWindowUsers.slice(0, 10);
	const currentTotalCost = dailyUsage.reduce((sum, row) => sum + safeNumber(row.totalCost), 0);
	const prevTotalCost = prevDailyUsage.reduce((sum, row) => sum + safeNumber(row.totalCost), 0);
	const totalTokens = modelUsage.reduce((sum, row) => sum + safeNumber(row.totalTokens), 0);
	const totalRequests = modelUsage.reduce((sum, row) => sum + safeNumber(row.requestCount), 0);
	const totalChats = chatCosts.length;
	const activeUsers = new Set(
		fullWindowUsers.map((row) => row.userId).filter((userId): userId is string => Boolean(userId))
	).size;

	const spendTimeline = buildSpendTimeline(dailyUsage);
	const providerSpend = buildBreakdownRows(
		modelDailyUsage,
		(row) => row.provider,
		(row) => row.totalCost
	);
	const categoryTokens = buildBreakdownRows(
		categoryUsage,
		(row) => row.category,
		(row) => row.totalTokens,
		(value) => Math.round(value)
	);
	const modelTrend = buildModelTrendChart(modelDailyUsage);

	const modelLeaderboard = [...modelUsage]
		.sort((left, right) => right.totalCost - left.totalCost)
		.slice(0, 20)
		.map((row) => ({
			modelKey: row.modelKey,
			model: row.model,
			provider: row.provider,
			costUsd: round6(row.totalCost),
			tokens: Math.round(row.totalTokens),
			requestCount: row.requestCount,
			avgCostPerRequest: row.requestCount > 0 ? round6(row.totalCost / row.requestCount) : 0
		}));

	const heatmap = [...hourlyUsage]
		.map((row) => ({
			dayOfWeek: safeNumber(row.dayOfWeek),
			hour: safeNumber(row.hourOfDay),
			cost: round6(safeNumber(row.totalCost)),
			tokens: Math.round(safeNumber(row.totalTokens)),
			requests: safeNumber(row.requestCount)
		}))
		.sort((left, right) => {
			const byDay = left.dayOfWeek - right.dayOfWeek;
			return byDay !== 0 ? byDay : left.hour - right.hour;
		});

	return analyticsDtoSchema.parse({
		range: analyticsRangeSchema.parse(range),
		kpis: {
			totalCostUsd: round6(currentTotalCost),
			totalTokens: Math.round(totalTokens),
			totalChats,
			activeUsers,
			avgCostPerChat: totalChats > 0 ? round6(currentTotalCost / totalChats) : 0,
			avgCostPerUser: activeUsers > 0 ? round6(currentTotalCost / activeUsers) : 0,
			totalRequests,
			costChangePercent:
				prevTotalCost > 0
					? round6(((currentTotalCost - prevTotalCost) / prevTotalCost) * 100)
					: null
		},
		charts: {
			spendTimeline,
			providerSpend,
			categoryTokens,
			modelTrend,
			heatmap,
			costHistogram: chatCostHistogram
		},
		tables: {
			modelLeaderboard,
			topSpenders
		}
	});
}

export function buildModelDrilldownDto({
	model,
	provider,
	dailyUsage
}: BuildModelDrilldownDtoInput): ModelDrilldownDto {
	const totalCost = dailyUsage.reduce((sum, row) => sum + safeNumber(row.totalCost), 0);
	const totalTokens = dailyUsage.reduce((sum, row) => sum + safeNumber(row.totalTokens), 0);
	const requestCount = dailyUsage.reduce((sum, row) => sum + safeNumber(row.requestCount), 0);

	return modelDrilldownDtoSchema.parse({
		model,
		provider: coalesceLabel(provider),
		totals: {
			costUsd: round6(totalCost),
			tokens: Math.round(totalTokens),
			requestCount,
			avgCostPerRequest: requestCount > 0 ? round6(totalCost / requestCount) : 0
		},
		spendTimeline: buildSpendTimeline(dailyUsage)
	});
}
