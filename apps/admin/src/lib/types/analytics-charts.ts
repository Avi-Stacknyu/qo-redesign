export interface TimeSeriesSpendPoint {
	day: string;
	costUsd: number;
}

export interface BreakdownMetricRow {
	key: string;
	label: string;
	value: number;
	color?: string;
}

export type BreakdownMetricInput = Omit<BreakdownMetricRow, 'key'> & {
	key?: string;
};

export interface HistogramBucket {
	rangeMin: number;
	rangeMax: number;
	count: number;
}

export interface HistogramChartRow {
	label: string;
	rangeLabel: string;
	count: number;
	rangeMin: number;
	rangeMax: number;
	sharePct: number;
}

export interface TokenBreakdownRow {
	label: string;
	inputTokens: number;
	outputTokens: number;
	cachedTokens?: number;
	reasoningTokens?: number;
}

export interface LatencyPoint {
	label: string;
	valueMs: number;
}

export interface ModelTrendSeries {
	key: string;
	label: string;
	color: string;
}

export interface ModelTrendPoint {
	day: string;
	values: Record<string, number>;
}

export interface ModelTrendChart {
	series: ModelTrendSeries[];
	points: ModelTrendPoint[];
}

export interface ModelDrilldownDto {
	model: string;
	provider: string;
	totals: {
		costUsd: number;
		tokens: number;
		requestCount: number;
		avgCostPerRequest: number;
	};
	spendTimeline: TimeSeriesSpendPoint[];
}

export type ModelTrendChartDataRow = {
	day: string;
	dayDate: Date;
	[key: string]: string | Date | number;
};

const UTC_DAY_INPUT = /^\d{4}-\d{2}-\d{2}$/;

function slugifyBreakdownKey(value: string) {
	const slug = value
		.toLowerCase()
		.trim()
		.replace(/[’']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return slug || 'metric';
}

function parseUtcDay(day: string) {
	if (!UTC_DAY_INPUT.test(day)) {
		throw new Error(`Invalid UTC day: "${day}"`);
	}

	return new Date(`${day}T00:00:00Z`);
}

export function formatHistogramUsd(value: number): string {
	if (value === 0) return '$0';
	if (value < 0.01) return `$${value.toFixed(3)}`;
	if (value < 1) return `$${value.toFixed(2)}`;
	if (value < 10) return `$${value.toFixed(1)}`;
	return `$${Math.round(value)}`;
}

export function buildHistogramChartData(buckets: readonly HistogramBucket[]): HistogramChartRow[] {
	const totalChats = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

	return buckets
		.filter((bucket, index) => bucket.count > 0 || index === 0)
		.map((bucket) => ({
			label: formatHistogramUsd(bucket.rangeMax),
			rangeLabel: `${formatHistogramUsd(bucket.rangeMin)} - ${formatHistogramUsd(bucket.rangeMax)}`,
			count: bucket.count,
			rangeMin: bucket.rangeMin,
			rangeMax: bucket.rangeMax,
			sharePct: totalChats > 0 ? (bucket.count / totalChats) * 100 : 0
		}));
}

export function normalizeBreakdownMetricRows(
	rows: readonly BreakdownMetricInput[]
): BreakdownMetricRow[] {
	const seenLabels = new Set<string>();
	const seenKeys = new Map<string, number>();

	return rows.map((row, index) => {
		const normalizedLabel = row.label.trim();

		if (seenLabels.has(normalizedLabel)) {
			throw new Error(`Duplicate breakdown labels are not supported: "${normalizedLabel}"`);
		}

		seenLabels.add(normalizedLabel);

		const baseKey =
			row.key?.trim() || slugifyBreakdownKey(normalizedLabel) || `metric-${index + 1}`;
		const nextCount = (seenKeys.get(baseKey) ?? 0) + 1;
		seenKeys.set(baseKey, nextCount);

		return {
			key: nextCount === 1 ? baseKey : `${baseKey}-${nextCount}`,
			label: row.label,
			value: row.value,
			color: row.color
		};
	});
}

export function formatUtcDayLabel(day: string | Date, options: Intl.DateTimeFormatOptions): string {
	const date = typeof day === 'string' ? parseUtcDay(day) : day;

	return new Intl.DateTimeFormat('en-US', {
		...options,
		timeZone: 'UTC'
	}).format(date);
}

export function formatSpendAreaAxisDayLabel(day: Date): string {
	return formatUtcDayLabel(day, { month: 'short', day: 'numeric' });
}

export function formatSpendAreaTooltipDayLabel(day: Date): string {
	return formatUtcDayLabel(day, {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

export function formatHistogramAxisLabel(
	chartData: readonly Pick<HistogramChartRow, 'rangeLabel' | 'label'>[],
	value: string
): string {
	const bucket = chartData.find((entry) => entry.rangeLabel === value);
	const label = bucket?.label ?? value;

	if (chartData.length <= 12) return label;

	const index = chartData.findIndex((entry) => entry.rangeLabel === value);
	if (index === -1) return label;

	return index % 2 === 0 ? label : '';
}

export function formatHistogramTooltipBucketLabel(
	chartData: readonly Pick<HistogramChartRow, 'rangeLabel'>[],
	value: string
): string {
	return chartData.find((entry) => entry.rangeLabel === value)?.rangeLabel ?? value;
}

export function buildModelTrendChartData(chart: ModelTrendChart): ModelTrendChartDataRow[] {
	return [...chart.points]
		.sort((left, right) => left.day.localeCompare(right.day))
		.map((point) => {
			const row: ModelTrendChartDataRow = {
				day: point.day,
				dayDate: parseUtcDay(point.day)
			};

			for (const series of chart.series) {
				row[series.key] = point.values[series.key] ?? 0;
			}

			return row;
		});
}
