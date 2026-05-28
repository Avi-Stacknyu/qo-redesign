/**
 * Billing Utility Tests
 *
 * Tests for createCostTracker, getPricingForModel,
 * getPricingForTool, getCreditsPerUsd.
 */

import { describe, it, expect, vi } from 'vitest';
import {
	createCostTracker,
	getPricingForModel,
	getPricingForTool,
	getCreditsPerUsd
} from '../../utils/billing';
import { createMockDb } from '../../__tests__/setup';
import type { AICostEvent } from '../../types/flow';

// ============================================================================
// createCostTracker (pure — no mocks needed)
// ============================================================================

describe('createCostTracker', () => {
	it('initializes with zero counts', () => {
		const tracker = createCostTracker();

		expect(tracker.events).toEqual([]);
		expect(tracker.totalCostUsd).toBe(0);
		expect(tracker.totalCredits).toBe(0);
	});

	it('addEvent accumulates cost and credits', () => {
		const tracker = createCostTracker();

		const event: AICostEvent = {
			operation: 'inference',
			modelId: 'gpt-4.1',
			tokens: { input: 100, output: 50 },
			costUsd: 0.005,
			credits: 0.5,
			pricingRateId: 'p1'
		};

		tracker.addEvent(event);

		expect(tracker.events).toHaveLength(1);
		expect(tracker.totalCostUsd).toBeCloseTo(0.005);
		expect(tracker.totalCredits).toBeCloseTo(0.5);
	});

	it('addEvent accumulates across multiple events', () => {
		const tracker = createCostTracker();

		tracker.addEvent({
			operation: 'inference',
			modelId: 'gpt-4.1',
			tokens: { input: 1000, output: 500 },
			costUsd: 0.01,
			credits: 1.0
		});

		tracker.addEvent({
			operation: 'embedding',
			modelId: '@cf/baai/bge-base-en-v1.5',
			tokens: { input: 200, output: 0 },
			costUsd: 0.0001,
			credits: 0.01
		});

		expect(tracker.events).toHaveLength(2);
		expect(tracker.totalCostUsd).toBeCloseTo(0.0101);
		expect(tracker.totalCredits).toBeCloseTo(1.01);
	});

	it('getSummary aggregates by operation', () => {
		const tracker = createCostTracker();

		tracker.addEvent({
			operation: 'inference',
			modelId: 'gpt-4.1',
			tokens: { input: 1000, output: 500 },
			costUsd: 0.01,
			credits: 1.0
		});

		tracker.addEvent({
			operation: 'inference',
			modelId: 'gpt-4.1',
			tokens: { input: 500, output: 200 },
			costUsd: 0.005,
			credits: 0.5
		});

		tracker.addEvent({
			operation: 'embedding',
			modelId: 'bge',
			tokens: { input: 300, output: 0 },
			costUsd: 0.0001,
			credits: 0.01
		});

		const summary = tracker.getSummary();

		expect(summary.byOperation.inference.count).toBe(2);
		expect(summary.byOperation.inference.inputTokens).toBe(1500);
		expect(summary.byOperation.inference.outputTokens).toBe(700);
		expect(summary.byOperation.inference.costUsd).toBeCloseTo(0.015);

		expect(summary.byOperation.embedding.count).toBe(1);
		expect(summary.byOperation.embedding.inputTokens).toBe(300);

		expect(summary.totalInputTokens).toBe(1800);
		expect(summary.totalOutputTokens).toBe(700);
		expect(summary.totalCostUsd).toBeCloseTo(0.0151);
	});

	it('getSummary returns zeroes when empty', () => {
		const tracker = createCostTracker();
		const summary = tracker.getSummary();

		expect(summary.totalCostUsd).toBe(0);
		expect(summary.totalCredits).toBe(0);
		expect(summary.totalInputTokens).toBe(0);
		expect(summary.totalOutputTokens).toBe(0);
		expect(Object.keys(summary.byOperation)).toHaveLength(0);
	});
});

// ============================================================================
// Pricing Lookups (mock PB)
// ============================================================================

describe('getPricingForModel', () => {
	it('returns pricing when model found', async () => {
		const db = createMockDb();
		db.then
			.mockImplementationOnce((r: any) => r([{ currentPricing: 'p1' }]))
			.mockImplementationOnce((r: any) =>
				r([{ id: 'p1', inputPricePer1M: '2.5', outputPricePer1M: '5.0' }])
			);

		const result = await getPricingForModel(db as any, 'gpt-4.1');
		expect(result).toBeDefined();
		expect(result?.id).toBe('p1');
		expect(result?.input_price_per_1m).toBe(2.5);
	});

	it('returns null when model not found', async () => {
		const db = createMockDb();
		// Default: then resolves to [] → no model found

		const result = await getPricingForModel(db as any, 'nonexistent');
		expect(result).toBeNull();
	});
});

describe('getPricingForTool', () => {
	it('returns pricing for tool', async () => {
		const db = createMockDb();
		db.then
			.mockImplementationOnce((r: any) => r([{ currentPricing: 'p2' }]))
			.mockImplementationOnce((r: any) => r([{ id: 'p2', pricePerCall: '0.001' }]));

		const result = await getPricingForTool(db as any, 'web_search');
		expect(result).toBeDefined();
		expect(result?.id).toBe('p2');
		expect(result?.price_per_call).toBe(0.001);
	});

	it('returns null on failure', async () => {
		const db = createMockDb();
		db.then.mockImplementation((_r: any, reject: any) => reject(new Error('nope')));

		const result = await getPricingForTool(db as any, 'missing_tool');
		expect(result).toBeNull();
	});
});

describe('getCreditsPerUsd', () => {
	it('returns exchange rate from DB', async () => {
		const db = createMockDb();
		db.then.mockImplementation((r: any) => r([{ rate: '200' }]));

		const result = await getCreditsPerUsd(db as any);
		expect(result).toBe(200);
	});

	it('returns default (100) on failure', async () => {
		const db = createMockDb();
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		db.then.mockImplementation((_r: any, reject: any) => reject(new Error('fail')));

		const result = await getCreditsPerUsd(db as any);
		expect(result).toBe(100);
		spy.mockRestore();
	});
});
