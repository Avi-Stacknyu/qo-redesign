import type { BreakdownMetricRow, TimeSeriesSpendPoint } from '$lib/types/analytics-charts';

export type CostingRange = '7d' | '30d' | '90d';

type SummaryRow = {
	totalCost: unknown;
	totalTokens: unknown;
	totalRequests: unknown;
	uniqueUsers: unknown;
	uniqueModels: unknown;
};

type DailyUsageRow = {
	day: string | null;
	totalCost: unknown;
};

type ProviderUsageRow = {
	provider: string | null;
	totalCost: unknown;
	totalTokens: unknown;
};

type ModelUsageRow = {
	model: string | null;
	totalCost: unknown;
	totalTokens: unknown;
	requestCount: unknown;
};

type CategoryUsageRow = {
	category: string | null;
	totalCost: unknown;
	totalTokens: unknown;
	requestCount: unknown;
};

type TopSpenderAggregateRow = {
	userId: string | null;
	name: string | null;
	email: string | null;
	totalCost: unknown;
	totalTokens: unknown;
	requestCount: unknown;
};

export interface CostingTopSpenderRow {
	userId: string;
	name: string | null;
	email: string | null;
	costUsd: number;
	tokens: number;
	requestCount: number;
}

export interface CostingAnalyticsDto {
	range: CostingRange;
	windowStartIso: string;
	records: {
		rows: number;
		uniqueRequests: number;
		truncated: false;
	};
	summary: {
		totalCostUsd: number;
		totalTokens: number;
		uniqueUsers: number;
		uniqueModels: number;
		topModel: string | null;
		topProvider: string | null;
	};
	charts: {
		spendTimeline: TimeSeriesSpendPoint[];
		providerSpend: BreakdownMetricRow[];
		modelSpend: BreakdownMetricRow[];
		categoryTokens: BreakdownMetricRow[];
	};
	tables: {
		topSpenders: CostingTopSpenderRow[];
	};
}

export interface BuildCostingAnalyticsDtoInput {
	range: CostingRange;
	windowStartIso: string;
	summaryRow: SummaryRow | undefined;
	dailyUsage: DailyUsageRow[];
	providerUsage: ProviderUsageRow[];
	modelUsage: ModelUsageRow[];
	categoryUsage: CategoryUsageRow[];
	topSpenders: TopSpenderAggregateRow[];
}

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

function sortBreakdownRows(rows: BreakdownMetricRow[]) {
	return [...rows].sort((left, right) => {
		const byValue = right.value - left.value;
		return byValue !== 0 ? byValue : left.label.localeCompare(right.label);
	});
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
		Array.from(totalsByLabel, ([label, value]) => ({
			key: label,
			label,
			value: formatValue(value)
		}))
	);
}

export function buildCostingAnalyticsDto({
	range,
	windowStartIso,
	summaryRow,
	dailyUsage,
	providerUsage,
	modelUsage,
	categoryUsage,
	topSpenders
}: BuildCostingAnalyticsDtoInput): CostingAnalyticsDto {
	const totalCostUsd = round6(safeNumber(summaryRow?.totalCost));
	const totalTokens = Math.round(safeNumber(summaryRow?.totalTokens));
	const totalRequests = safeNumber(summaryRow?.totalRequests);
	const uniqueUsers = safeNumber(summaryRow?.uniqueUsers);
	const uniqueModels = safeNumber(summaryRow?.uniqueModels);

	const spendTimeline: TimeSeriesSpendPoint[] = [...dailyUsage]
		.sort((left, right) => (left.day ?? '').localeCompare(right.day ?? ''))
		.map((row) => ({
			day: row.day ?? '',
			costUsd: round6(safeNumber(row.totalCost))
		}));

	const providerSpend = buildBreakdownRows(
		providerUsage,
		(row) => row.provider,
		(row) => row.totalCost
	);

	const modelSpend = buildBreakdownRows(
		modelUsage,
		(row) => row.model,
		(row) => row.totalCost
	).slice(0, 10);

	const categoryTokens = buildBreakdownRows(
		categoryUsage,
		(row) => row.category,
		(row) => row.totalTokens,
		(value) => Math.round(value)
	);

	const topSpendersTable = [...topSpenders]
		.sort((left, right) => safeNumber(right.totalCost) - safeNumber(left.totalCost))
		.map((row) => ({
			userId: row.userId ?? '',
			name: row.name ?? null,
			email: row.email ?? null,
			costUsd: round6(safeNumber(row.totalCost)),
			tokens: Math.round(safeNumber(row.totalTokens)),
			requestCount: safeNumber(row.requestCount)
		}));

	return {
		range,
		windowStartIso,
		records: {
			rows: totalRequests,
			uniqueRequests: totalRequests,
			truncated: false
		},
		summary: {
			totalCostUsd,
			totalTokens,
			uniqueUsers,
			uniqueModels,
			topModel: modelSpend[0]?.label ?? null,
			topProvider: providerSpend[0]?.label ?? null
		},
		charts: {
			spendTimeline,
			providerSpend,
			modelSpend,
			categoryTokens
		},
		tables: {
			topSpenders: topSpendersTable
		}
	};
}
