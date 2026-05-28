import { describe, expect, test } from 'vitest';

import { buildAnalyticsDto, buildModelDrilldownDto } from './analytics.dto';

describe('buildAnalyticsDto', () => {
	test('derives selected-window aggregates and provider-aware model identities from windowed daily rows', () => {
		const dto = buildAnalyticsDto({
			range: '30d',
			dailyUsage: [
				{ day: '2026-04-01', totalCost: '1.23456789' },
				{ day: '2026-04-02', totalCost: '2.5' }
			],
			prevDailyUsage: [
				{ day: '2026-03-30', totalCost: '1.23456789' },
				{ day: '2026-03-31', totalCost: '2.5' }
			],
			categoryUsage: [
				{ day: '2026-04-01', category: 'prompt', totalCost: '0', totalTokens: '2000' },
				{ day: '2026-04-02', category: 'prompt', totalCost: '0', totalTokens: '500' },
				{ day: '2026-04-01', category: 'completion', totalCost: '0', totalTokens: '956' }
			],
			userUsage: [
				{
					userId: 'user_1',
					name: 'Ada Lovelace',
					email: 'ada@example.com',
					plan: 'Pro',
					totalCost: '5',
					totalTokens: '1200',
					requestCount: 7
				},
				{
					userId: 'user_1',
					name: 'Ada Lovelace',
					email: 'ada@example.com',
					plan: 'Pro',
					totalCost: '3.1234567',
					totalTokens: '800',
					requestCount: 4
				},
				{
					userId: 'user_2',
					name: null,
					email: 'grace@example.com',
					plan: null,
					totalCost: '0.6111112',
					totalTokens: '1456',
					requestCount: 7
				}
			],
			chatCosts: [{ totalCostUsd: '0.42' }, { totalCostUsd: '1.5' }],
			chatCostHistogram: [
				{ rangeMin: 0, rangeMax: 0.5, count: 1 },
				{ rangeMin: 0.5, rangeMax: 2, count: 1 }
			],
			hourlyUsage: [
				{
					dayOfWeek: '1',
					hourOfDay: '10',
					totalCost: '1.25',
					totalTokens: '300',
					requestCount: '2'
				}
			],
			modelDailyUsage: [
				{
					day: '2026-04-01',
					model: 'gpt-4o',
					provider: 'OpenAI',
					totalCost: '4.5',
					totalTokens: '900',
					requestCount: 5
				},
				{
					day: '2026-04-02',
					model: 'gpt-4o',
					provider: 'OpenAI',
					totalCost: '2.75',
					totalTokens: '600',
					requestCount: 3
				},
				{
					day: '2026-04-01',
					model: 'gpt-4o',
					provider: 'Azure OpenAI',
					totalCost: '4.1',
					totalTokens: '1200',
					requestCount: 6
				},
				{
					day: '2026-04-02',
					model: 'claude-4-opus',
					provider: 'Anthropic',
					totalCost: '0.9567891',
					totalTokens: '756',
					requestCount: 4
				}
			]
		});

		expect(dto).toEqual({
			range: '30d',
			kpis: {
				totalCostUsd: 3.734568,
				totalTokens: 3456,
				totalChats: 2,
				activeUsers: 2,
				avgCostPerChat: 1.867284,
				avgCostPerUser: 1.867284,
				totalRequests: 18,
				costChangePercent: 0
			},
			charts: {
				spendTimeline: [
					{ day: '2026-04-01', costUsd: 1.234568 },
					{ day: '2026-04-02', costUsd: 2.5 }
				],
				providerSpend: [
					{ key: 'openai', label: 'OpenAI', value: 7.25, color: undefined },
					{ key: 'azure-openai', label: 'Azure OpenAI', value: 4.1, color: undefined },
					{ key: 'anthropic', label: 'Anthropic', value: 0.956789, color: undefined }
				],
				categoryTokens: [
					{ key: 'prompt', label: 'prompt', value: 2500, color: undefined },
					{ key: 'completion', label: 'completion', value: 956, color: undefined }
				],
				modelTrend: {
					series: [
						{
							key: 'openai::gpt-4o',
							label: 'gpt-4o (OpenAI)',
							color: 'var(--chart-1)'
						},
						{
							key: 'azure-openai::gpt-4o',
							label: 'gpt-4o (Azure OpenAI)',
							color: 'var(--chart-2)'
						},
						{
							key: 'anthropic::claude-4-opus',
							label: 'claude-4-opus',
							color: 'var(--chart-3)'
						}
					],
					points: [
						{
							day: '2026-04-01',
							values: {
								'azure-openai::gpt-4o': 4.1,
								'openai::gpt-4o': 4.5,
								'anthropic::claude-4-opus': 0
							}
						},
						{
							day: '2026-04-02',
							values: {
								'azure-openai::gpt-4o': 0,
								'openai::gpt-4o': 2.75,
								'anthropic::claude-4-opus': 0.956789
							}
						}
					]
				},
				heatmap: [{ dayOfWeek: 1, hour: 10, cost: 1.25, tokens: 300, requests: 2 }],
				costHistogram: [
					{ rangeMin: 0, rangeMax: 0.5, count: 1 },
					{ rangeMin: 0.5, rangeMax: 2, count: 1 }
				]
			},
			tables: {
				modelLeaderboard: [
					{
						modelKey: 'openai::gpt-4o',
						model: 'gpt-4o',
						provider: 'OpenAI',
						costUsd: 7.25,
						tokens: 1500,
						requestCount: 8,
						avgCostPerRequest: 0.90625
					},
					{
						modelKey: 'azure-openai::gpt-4o',
						model: 'gpt-4o',
						provider: 'Azure OpenAI',
						costUsd: 4.1,
						tokens: 1200,
						requestCount: 6,
						avgCostPerRequest: 0.683333
					},
					{
						modelKey: 'anthropic::claude-4-opus',
						model: 'claude-4-opus',
						provider: 'Anthropic',
						costUsd: 0.956789,
						tokens: 756,
						requestCount: 4,
						avgCostPerRequest: 0.239197
					}
				],
				topSpenders: [
					{
						userId: 'user_1',
						name: 'Ada Lovelace',
						email: 'ada@example.com',
						plan: 'Pro',
						costUsd: 8.123457,
						tokens: 2000,
						requestCount: 11
					},
					{
						userId: 'user_2',
						name: null,
						email: 'grace@example.com',
						plan: null,
						costUsd: 0.611111,
						tokens: 1456,
						requestCount: 7
					}
				]
			}
		});
	});

	test('keeps active-user KPIs based on the full window before top-spender truncation', () => {
		const userUsage = Array.from({ length: 12 }, (_, index) => ({
			userId: `user_${index + 1}`,
			name: `User ${index + 1}`,
			email: `user${index + 1}@example.com`,
			plan: index % 2 === 0 ? 'Pro' : 'Starter',
			totalCost: String(12 - index),
			totalTokens: String((index + 1) * 100),
			requestCount: index + 1
		}));

		const dto = buildAnalyticsDto({
			range: '30d',
			dailyUsage: [{ day: '2026-04-01', totalCost: '78' }],
			prevDailyUsage: [],
			categoryUsage: [],
			userUsage,
			chatCosts: [{ totalCostUsd: '10' }, { totalCostUsd: '20' }, { totalCostUsd: '48' }],
			chatCostHistogram: [],
			hourlyUsage: [],
			modelDailyUsage: []
		});

		expect(dto.kpis.activeUsers).toBe(12);
		expect(dto.kpis.avgCostPerUser).toBe(6.5);
		expect(dto.tables.topSpenders).toHaveLength(10);
		expect(dto.tables.topSpenders.at(-1)?.userId).toBe('user_10');
	});
});

describe('buildModelDrilldownDto', () => {
	test('derives provider-scoped drilldown totals from the selected-window rows', () => {
		const dto = buildModelDrilldownDto({
			model: 'gpt-4o',
			provider: 'OpenAI',
			dailyUsage: [
				{ day: '2026-04-02', totalCost: '2.75', totalTokens: '600', requestCount: 3 },
				{ day: '2026-04-01', totalCost: '4.5', totalTokens: '900', requestCount: 5 }
			]
		});

		expect(dto).toEqual({
			model: 'gpt-4o',
			provider: 'OpenAI',
			totals: {
				costUsd: 7.25,
				tokens: 1500,
				requestCount: 8,
				avgCostPerRequest: 0.90625
			},
			spendTimeline: [
				{ day: '2026-04-01', costUsd: 4.5 },
				{ day: '2026-04-02', costUsd: 2.75 }
			]
		});
		expect(dto).not.toHaveProperty('timeSeries');
	});
});
