import { describe, expect, test } from 'vitest';

import { normalizeBreakdownMetricRows } from '$lib/types/analytics-charts';
import { buildCostingAnalyticsDto } from './costing.dto';

describe('buildCostingAnalyticsDto', () => {
	test('groups costing data into canonical summary, charts, tables, and records DTOs', () => {
		const dto = buildCostingAnalyticsDto({
			range: '30d',
			windowStartIso: '2026-03-13T00:00:00.000Z',
			summaryRow: {
				totalCost: '12.3456789',
				totalTokens: '3456',
				totalRequests: 18,
				uniqueUsers: 42,
				uniqueModels: 3
			},
			dailyUsage: [
				{ day: '2026-04-01', totalCost: '1.23456789' },
				{ day: '2026-04-02', totalCost: '2.5' }
			],
			providerUsage: [
				{ provider: 'OpenAI', totalCost: '9.5', totalTokens: '2400' },
				{ provider: null, totalCost: '2.8456789', totalTokens: '1056' }
			],
			modelUsage: [
				{
					model: 'gpt-4.1',
					totalCost: '7.25',
					totalTokens: '1500',
					requestCount: 8
				},
				{ model: 'claude-4', totalCost: '4.1', totalTokens: '1200', requestCount: 6 },
				{ model: null, totalCost: '1.0', totalTokens: '756', requestCount: 4 }
			],
			categoryUsage: [
				{
					category: 'prompt',
					totalCost: '5.25',
					totalTokens: '2500',
					requestCount: 10
				},
				{ category: 'completion', totalCost: '7.0956789', totalTokens: '956', requestCount: 8 }
			],
			topSpenders: [
				{
					userId: 'user_1',
					name: 'Ada Lovelace',
					email: 'ada@example.com',
					totalCost: '8.1234567',
					totalTokens: '2000',
					requestCount: 11
				},
				{
					userId: 'user_2',
					name: null,
					email: 'grace@example.com',
					totalCost: '4.2222222',
					totalTokens: '1456',
					requestCount: 7
				}
			]
		});

		expect(dto).toEqual({
			range: '30d',
			windowStartIso: '2026-03-13T00:00:00.000Z',
			records: {
				rows: 18,
				uniqueRequests: 18,
				truncated: false
			},
			summary: {
				totalCostUsd: 12.345679,
				totalTokens: 3456,
				uniqueUsers: 42,
				uniqueModels: 3,
				topModel: 'gpt-4.1',
				topProvider: 'OpenAI'
			},
			charts: {
				spendTimeline: [
					{ day: '2026-04-01', costUsd: 1.234568 },
					{ day: '2026-04-02', costUsd: 2.5 }
				],
				providerSpend: [
					{ key: 'OpenAI', label: 'OpenAI', value: 9.5 },
					{ key: 'unknown', label: 'unknown', value: 2.845679 }
				],
				modelSpend: [
					{ key: 'gpt-4.1', label: 'gpt-4.1', value: 7.25 },
					{ key: 'claude-4', label: 'claude-4', value: 4.1 },
					{ key: 'unknown', label: 'unknown', value: 1 }
				],
				categoryTokens: [
					{ key: 'prompt', label: 'prompt', value: 2500 },
					{ key: 'completion', label: 'completion', value: 956 }
				]
			},
			tables: {
				topSpenders: [
					{
						userId: 'user_1',
						name: 'Ada Lovelace',
						email: 'ada@example.com',
						costUsd: 8.123457,
						tokens: 2000,
						requestCount: 11
					},
					{
						userId: 'user_2',
						name: null,
						email: 'grace@example.com',
						costUsd: 4.222222,
						tokens: 1456,
						requestCount: 7
					}
				]
			}
		});
	});

	test('coalesces duplicate normalized breakdown labels into chart-safe rows', () => {
		const dto = buildCostingAnalyticsDto({
			range: '7d',
			windowStartIso: '2026-04-01T00:00:00.000Z',
			summaryRow: {
				totalCost: '7',
				totalTokens: '150',
				totalRequests: 3,
				uniqueUsers: 2,
				uniqueModels: 1
			},
			dailyUsage: [{ day: '2026-04-01', totalCost: '7' }],
			providerUsage: [
				{ provider: null, totalCost: '1.25', totalTokens: '0' },
				{ provider: '   ', totalCost: '0.75', totalTokens: '0' },
				{ provider: 'OpenAI', totalCost: '5', totalTokens: '150' }
			],
			modelUsage: [
				{ model: 'gpt-4.1', totalCost: '2', totalTokens: '60', requestCount: 1 },
				{ model: 'gpt-4.1 ', totalCost: '3', totalTokens: '90', requestCount: 2 }
			],
			categoryUsage: [
				{ category: null, totalCost: '0', totalTokens: '90', requestCount: 1 },
				{ category: '   ', totalCost: '0', totalTokens: '60', requestCount: 2 }
			],
			topSpenders: []
		});

		expect(dto.summary.topProvider).toBe('OpenAI');
		expect(dto.summary.topModel).toBe('gpt-4.1');
		expect(dto.charts.providerSpend).toEqual([
			{ key: 'OpenAI', label: 'OpenAI', value: 5 },
			{ key: 'unknown', label: 'unknown', value: 2 }
		]);
		expect(dto.charts.modelSpend).toEqual([{ key: 'gpt-4.1', label: 'gpt-4.1', value: 5 }]);
		expect(dto.charts.categoryTokens).toEqual([{ key: 'unknown', label: 'unknown', value: 150 }]);

		expect(normalizeBreakdownMetricRows(dto.charts.providerSpend)).toEqual(
			dto.charts.providerSpend
		);
		expect(normalizeBreakdownMetricRows(dto.charts.modelSpend)).toEqual(dto.charts.modelSpend);
		expect(normalizeBreakdownMetricRows(dto.charts.categoryTokens)).toEqual(
			dto.charts.categoryTokens
		);
	});
});
