/**
 * Analytical Tool Execution Engine
 *
 * Registry-based engine that dispatches tool execution requests to handlers.
 * Each handler validates inputs, computes results, persists to user_data_sources,
 * and returns a ToolExecutionResult.
 */

import type { ToolExecutionRequest, ToolExecutionResult } from '@repo/shared/types';
import type { ResolverContext } from './data-resolver';
import { portfolioRiskAnalyzerHandler } from './tools/portfolio-risk-analyzer';

// ── Handler Interface ────────────────────────────────────────────────────────

export type ToolHandler = (
	req: ToolExecutionRequest,
	ctx: ResolverContext
) => Promise<ToolExecutionResult>;

// ── Handler Registry ─────────────────────────────────────────────────────────

const handlers: Record<string, ToolHandler> = {};

/** Register a tool handler by key. */
export function registerToolHandler(toolKey: string, handler: ToolHandler): void {
	handlers[toolKey] = handler;
}

// ── Pre-register built-in handlers ───────────────────────────────────────────

registerToolHandler('portfolio-risk-analyzer', portfolioRiskAnalyzerHandler);

// ── Execution ────────────────────────────────────────────────────────────────

export class ToolValidationError extends Error {
	constructor(
		message: string,
		public readonly field?: string
	) {
		super(message);
		this.name = 'ToolValidationError';
	}
}

export class ToolExecutionError extends Error {
	constructor(
		message: string,
		public readonly partial?: Partial<ToolExecutionResult>
	) {
		super(message);
		this.name = 'ToolExecutionError';
	}
}

/**
 * Execute an analytical tool by key.
 * Looks up the handler in the registry, runs it, and returns the result.
 */
export async function executeAnalyticalTool(
	req: ToolExecutionRequest,
	ctx: ResolverContext
): Promise<ToolExecutionResult> {
	const handler = handlers[req.tool_key];
	if (!handler) {
		throw new ToolValidationError(`Unknown analytical tool: "${req.tool_key}"`);
	}

	return handler(req, ctx);
}
