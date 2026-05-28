/**
 * Analytical Tools Remote — queries for tool catalog, execution, and results.
 */

import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import z from 'zod/v4';
import type { AnalyticalToolCatalogItem, ToolExecutionResult } from '@repo/shared/types';

// ── Tool Catalog ─────────────────────────────────────────────────────────────

export const loadVisibleTools = query(async () => {
	const { locals, platform } = getRequestEvent();
	if (!locals.user) throw error(401, 'Unauthorized');

	const worker = platform?.env?.CF_WORKER;
	if (!worker) return [] as AnalyticalToolCatalogItem[];

	const result = await worker.getVisibleAnalyticalTools({ userId: locals.user.id });
	return result.tools as AnalyticalToolCatalogItem[];
});

// ── Tool Execution ───────────────────────────────────────────────────────────

export const runTool = command(
	z.object({
		toolKey: z.string().min(1),
		inputParams: z.record(z.string(), z.unknown())
	}),
	async ({ toolKey, inputParams }) => {
		const { locals, platform } = getRequestEvent();
		if (!locals.user) throw error(401, 'Unauthorized');

		const worker = platform?.env?.CF_WORKER;
		if (!worker) return { success: false, error: 'Worker unavailable' };

		return await worker.executeAnalyticalTool({
			userId: locals.user.id,
			toolKey,
			inputParams
		});
	}
);

// ── Past Results ─────────────────────────────────────────────────────────────

export const loadToolResults = query(
	z.object({ toolKey: z.string().optional() }),
	async (params) => {
		const { locals, platform } = getRequestEvent();
		if (!locals.user) throw error(401, 'Unauthorized');

		const worker = platform?.env?.CF_WORKER;
		if (!worker) return [];

		const result = await worker.getToolResults({
			userId: locals.user.id,
			toolKey: params.toolKey
		});
		return result.results;
	}
);
