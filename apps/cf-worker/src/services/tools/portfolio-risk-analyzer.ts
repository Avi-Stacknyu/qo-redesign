/**
 * Portfolio Risk Analyzer — Reference Implementation
 *
 * Computes portfolio metrics from holdings data:
 * - Asset allocation breakdown (pie chart)
 * - Concentration risk (HHI)
 * - Diversification score
 * - Unrealized P&L per holding
 * - Risk category
 * - Rebalancing suggestions (optional)
 *
 * Pure computation — no external API calls.
 */

import { z } from 'zod';
import type { ToolHandler } from '../analytical-tool-engine';
import { ToolValidationError } from '../analytical-tool-engine';
import type { ResolvedData, ResolvedColumn, DataSourceRef } from '@repo/shared/types';
import type { ToolExecutionResult, SuggestedVisualization } from '@repo/shared/types';
import { userDataSources } from '@repo/db/schema';
import { generateId } from '@repo/db/id';

// ── Input Validation ─────────────────────────────────────────────────────────

const AssetClass = z.enum(['equity', 'debt', 'gold', 'cash', 'real_estate', 'crypto', 'other']);

const HoldingSchema = z.object({
	symbol: z.string().min(1),
	name: z.string().optional().default(''),
	quantity: z.number().positive(),
	avg_cost: z.number().nonnegative(),
	current_price: z.number().nonnegative(),
	asset_class: AssetClass
});

const InputSchema = z.object({
	holdings: z.array(HoldingSchema).min(1, 'At least one holding is required'),
	target_allocation: z.record(z.string(), z.number().min(0).max(100)).optional(),
	risk_free_rate: z.number().min(0).max(100).optional()
});

type Holding = z.infer<typeof HoldingSchema>;
type ToolInput = z.infer<typeof InputSchema>;

// ── Computation Helpers ──────────────────────────────────────────────────────

function computeHoldingValues(holdings: Holding[]) {
	return holdings.map((h) => {
		const current_value = h.quantity * h.current_price;
		const cost_value = h.quantity * h.avg_cost;
		const unrealized_pnl = current_value - cost_value;
		const pnl_pct = cost_value > 0 ? (unrealized_pnl / cost_value) * 100 : 0;
		return { ...h, current_value, cost_value, unrealized_pnl, pnl_pct };
	});
}

function computeAllocationBreakdown(holdingsWithValues: ReturnType<typeof computeHoldingValues>) {
	const totalValue = holdingsWithValues.reduce((sum, h) => sum + h.current_value, 0);
	if (totalValue === 0) return [];

	const byClass = new Map<string, number>();
	for (const h of holdingsWithValues) {
		byClass.set(h.asset_class, (byClass.get(h.asset_class) ?? 0) + h.current_value);
	}

	return [...byClass.entries()]
		.map(([asset_class, value]) => ({
			asset_class,
			value: Math.round(value * 100) / 100,
			percentage: Math.round((value / totalValue) * 10000) / 100
		}))
		.sort((a, b) => b.value - a.value);
}

function computeHHI(holdingsWithValues: ReturnType<typeof computeHoldingValues>) {
	const totalValue = holdingsWithValues.reduce((sum, h) => sum + h.current_value, 0);
	if (totalValue === 0) return 0;

	return holdingsWithValues.reduce((sum, h) => {
		const weight = h.current_value / totalValue;
		return sum + weight * weight;
	}, 0);
}

function classifyRisk(allocation: ReturnType<typeof computeAllocationBreakdown>) {
	const equityPct = allocation.find((a) => a.asset_class === 'equity')?.percentage ?? 0;
	if (equityPct > 80) return 'Aggressive';
	if (equityPct > 60) return 'Growth';
	if (equityPct > 30) return 'Moderate';
	return 'Conservative';
}

function computeRebalancing(
	allocation: ReturnType<typeof computeAllocationBreakdown>,
	totalValue: number,
	target: Record<string, number>
) {
	return Object.entries(target).map(([asset_class, targetPct]) => {
		const current = allocation.find((a) => a.asset_class === asset_class);
		const currentPct = current?.percentage ?? 0;
		const drift = currentPct - targetPct;
		const currentValue = current?.value ?? 0;
		const targetValue = totalValue * (targetPct / 100);
		const suggestedChange = targetValue - currentValue;
		return {
			asset_class,
			current_pct: Math.round(currentPct * 100) / 100,
			target_pct: targetPct,
			drift: Math.round(drift * 100) / 100,
			suggested_change: Math.round(suggestedChange * 100) / 100
		};
	});
}

// ── Column Definitions ───────────────────────────────────────────────────────

const ALLOCATION_COLUMNS: ResolvedColumn[] = [
	{ key: 'asset_class', label: 'Asset Class', type: 'string' },
	{ key: 'value', label: 'Value', type: 'number' },
	{ key: 'percentage', label: 'Allocation %', type: 'number' }
];

const HOLDINGS_COLUMNS: ResolvedColumn[] = [
	{ key: 'symbol', label: 'Symbol', type: 'string' },
	{ key: 'name', label: 'Name', type: 'string' },
	{ key: 'asset_class', label: 'Asset Class', type: 'string' },
	{ key: 'quantity', label: 'Qty', type: 'number' },
	{ key: 'avg_cost', label: 'Avg Cost', type: 'number' },
	{ key: 'current_price', label: 'Current Price', type: 'number' },
	{ key: 'current_value', label: 'Value', type: 'number' },
	{ key: 'weight', label: 'Weight %', type: 'number' },
	{ key: 'unrealized_pnl', label: 'P&L', type: 'number' },
	{ key: 'pnl_pct', label: 'P&L %', type: 'number' }
];

const REBALANCING_COLUMNS: ResolvedColumn[] = [
	{ key: 'asset_class', label: 'Asset Class', type: 'string' },
	{ key: 'current_pct', label: 'Current %', type: 'number' },
	{ key: 'target_pct', label: 'Target %', type: 'number' },
	{ key: 'drift', label: 'Drift %', type: 'number' },
	{ key: 'suggested_change', label: 'Suggested Change (₹)', type: 'number' }
];

// ── Handler ──────────────────────────────────────────────────────────────────

export const portfolioRiskAnalyzerHandler: ToolHandler = async (req, ctx) => {
	// Validate inputs
	const parsed = InputSchema.safeParse(req.input_params);
	if (!parsed.success) {
		const firstIssue = parsed.error.issues[0];
		throw new ToolValidationError(firstIssue.message, String(firstIssue.path[0] ?? ''));
	}

	const { holdings, target_allocation, risk_free_rate: _rfr } = parsed.data;

	// Compute
	const holdingsWithValues = computeHoldingValues(holdings);
	const totalValue = holdingsWithValues.reduce((s, h) => s + h.current_value, 0);
	const totalCost = holdingsWithValues.reduce((s, h) => s + h.cost_value, 0);
	const totalPnl = totalValue - totalCost;
	const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
	const allocation = computeAllocationBreakdown(holdingsWithValues);
	const hhi = computeHHI(holdingsWithValues);
	const diversificationScore = Math.round((1 - hhi) * 100);
	const riskCategory = classifyRisk(allocation);

	// Build result datasets
	const allocationChart: ResolvedData = {
		columns: ALLOCATION_COLUMNS,
		rows: allocation,
		meta: { title: 'Asset Allocation' }
	};

	const holdingsTable: ResolvedData = {
		columns: HOLDINGS_COLUMNS,
		rows: holdingsWithValues.map((h) => ({
			...h,
			weight: totalValue > 0 ? Math.round((h.current_value / totalValue) * 10000) / 100 : 0
		})),
		meta: { title: 'Holdings Analysis' }
	};

	const data: Record<string, ResolvedData> = {
		allocation_chart: allocationChart,
		holdings_table: holdingsTable
	};

	// Optional rebalancing
	if (target_allocation && Object.keys(target_allocation).length > 0) {
		data.rebalancing_table = {
			columns: REBALANCING_COLUMNS,
			rows: computeRebalancing(allocation, totalValue, target_allocation),
			meta: { title: 'Rebalancing Suggestions' }
		};
	}

	const metrics: Record<string, unknown> = {
		total_value: Math.round(totalValue * 100) / 100,
		total_pnl: Math.round(totalPnl * 100) / 100,
		total_pnl_pct: Math.round(totalPnlPct * 100) / 100,
		diversification_score: diversificationScore,
		hhi: Math.round(hhi * 10000) / 10000,
		risk_category: riskCategory,
		holdings_count: holdings.length
	};

	const visualizations: SuggestedVisualization[] = [
		{ chart_type: 'pie', data_key: 'allocation_chart', title: 'Asset Allocation' },
		{ chart_type: 'bar', data_key: 'holdings_table', title: 'Holdings by Value' }
	];

	const result: ToolExecutionResult = {
		data,
		data_source_ref: { type: 'analytical-tool', source_id: 'portfolio-risk-analyzer' },
		visualizations,
		metrics
	};

	// Persist full result to user_data_sources so history loads correctly
	const now = new Date().toISOString();
	const newId = generateId();
	await ctx.db.insert(userDataSources).values({
		id: newId,
		user: req.user_id,
		sourceKey: `tool-${crypto.randomUUID()}`,
		displayName: `Portfolio Risk Analysis — ${new Date().toLocaleDateString()}`,
		data: result,
		createdBy: 'tool',
		toolKey: 'portfolio-risk-analyzer',
		inputParams: req.input_params,
		created: now,
		updated: now
	});

	result.data_source_ref = {
		type: 'analytical-tool',
		source_id: 'portfolio-risk-analyzer',
		params: { record_id: newId }
	};

	return result;
};
