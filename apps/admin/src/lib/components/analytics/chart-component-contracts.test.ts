import { describe, expect, test } from 'vitest';
import { render } from 'svelte/server';

import {
	formatCostHistogramAxisLabel,
	formatCostHistogramTooltipBucketLabel
} from './cost-histogram.svelte';
import SpendAreaChart, {
	formatSpendAreaAxisDayLabel,
	formatSpendAreaTooltipDayLabel
} from './spend-area-chart.svelte';

describe('spend-area-chart component contract', () => {
	test('formats UTC-midnight server days without shifting to the previous local day', () => {
		const utcMidnight = new Date('2026-04-01T00:00:00Z');

		expect(formatSpendAreaAxisDayLabel(utcMidnight)).toBe('Apr 1');
		expect(formatSpendAreaTooltipDayLabel(utcMidnight)).toBe('Wed, Apr 1');
	});

	test('renders a one-point spend timeline instead of the fallback empty state', () => {
		const { body } = render(SpendAreaChart, {
			props: {
				data: [{ day: '2026-04-01', costUsd: 12.3456 }],
				gradientId: 'single-point-spend'
			}
		});

		expect(body).toContain('data-slot="chart"');
		expect(body).not.toContain('Not enough data points for chart');
	});
});

describe('cost-histogram component contract', () => {
	test('preserves the full hovered bucket label even when dense axis ticks are thinned', () => {
		const denseChartData = Array.from({ length: 13 }, (_, index) => ({
			label: `Bucket ${index}`,
			rangeLabel: `Range ${index}`,
			count: index + 1,
			rangeMin: index,
			rangeMax: index + 1,
			sharePct: ((index + 1) / 91) * 100
		}));

		expect(formatCostHistogramAxisLabel(denseChartData, denseChartData[1].rangeLabel)).toBe('');
		expect(
			formatCostHistogramTooltipBucketLabel(denseChartData, denseChartData[1].rangeLabel)
		).toBe('Range 1');
	});
});
