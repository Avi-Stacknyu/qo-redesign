import { describe, expect, test } from 'vitest';

import {
	buildHistogramChartData,
	buildModelTrendChartData,
	formatUtcDayLabel,
	normalizeBreakdownMetricRows,
	type ModelTrendChart
} from './analytics-charts';

describe('buildHistogramChartData', () => {
	test('prepares range labels and share values for histogram tooltips', () => {
		const rows = buildHistogramChartData([
			{ rangeMin: 0, rangeMax: 0.01, count: 0 },
			{ rangeMin: 0.01, rangeMax: 0.1, count: 2 },
			{ rangeMin: 0.1, rangeMax: 1, count: 1 },
			{ rangeMin: 1, rangeMax: 10, count: 0 }
		]);

		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({
			label: '$0.01',
			rangeLabel: '$0 - $0.01',
			count: 0,
			sharePct: 0
		});
		expect(rows[1]).toMatchObject({
			label: '$0.10',
			rangeLabel: '$0.01 - $0.10',
			count: 2
		});
		expect(rows[1].sharePct).toBeCloseTo(66.6667, 4);
		expect(rows[2]).toMatchObject({
			label: '$1.0',
			rangeLabel: '$0.10 - $1.0',
			count: 1
		});
		expect(rows[2].sharePct).toBeCloseTo(33.3333, 4);
	});
});

describe('normalizeBreakdownMetricRows', () => {
	test('preserves explicit keys and derives stable fallback keys for unique labels', () => {
		const rows = normalizeBreakdownMetricRows([
			{ key: 'openai', label: 'OpenAI', value: 10 },
			{ label: 'Anthropic/Claude', value: 20 },
			{ label: 'Anthropic Claude', value: 5 }
		]);

		expect(rows).toEqual([
			{ key: 'openai', label: 'OpenAI', value: 10 },
			{ key: 'anthropic-claude', label: 'Anthropic/Claude', value: 20 },
			{ key: 'anthropic-claude-2', label: 'Anthropic Claude', value: 5 }
		]);
	});

	test('rejects duplicate labels instead of silently collapsing bar categories', () => {
		expect(() =>
			normalizeBreakdownMetricRows([
				{ label: 'Anthropic Claude', value: 20 },
				{ label: 'Anthropic Claude', value: 5 }
			])
		).toThrowError('Duplicate breakdown labels are not supported: "Anthropic Claude"');
	});
});

describe('buildModelTrendChartData', () => {
	test('sorts points by day, preserves the server day string, and backfills missing series values with zero', () => {
		const chart: ModelTrendChart = {
			series: [
				{ key: 'gpt-4o', label: 'GPT-4o', color: 'var(--chart-1)' },
				{ key: 'claude-4', label: 'Claude 4', color: 'var(--chart-2)' }
			],
			points: [
				{ day: '2026-04-02', values: { 'claude-4': 7.2 } },
				{ day: '2026-04-01', values: { 'gpt-4o': 4.5 } }
			]
		};

		const rows = buildModelTrendChartData(chart);

		expect(rows).toEqual([
			{
				day: '2026-04-01',
				dayDate: new Date('2026-04-01T00:00:00Z'),
				'gpt-4o': 4.5,
				'claude-4': 0
			},
			{
				day: '2026-04-02',
				dayDate: new Date('2026-04-02T00:00:00Z'),
				'gpt-4o': 0,
				'claude-4': 7.2
			}
		]);
	});
});

describe('formatUtcDayLabel', () => {
	test('formats UTC-midnight model trend dates without shifting to the previous local day', () => {
		const utcMidnight = new Date('2026-04-01T00:00:00Z');

		expect(formatUtcDayLabel(utcMidnight, { month: 'short', day: 'numeric' })).toBe('Apr 1');
		expect(
			formatUtcDayLabel(utcMidnight, {
				weekday: 'short',
				month: 'short',
				day: 'numeric'
			})
		).toBe('Wed, Apr 1');
	});
});
