import { z } from 'zod';
import { tool } from 'ai';
import { userDataSources, analyticalTools } from '@repo/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { createLogger, formatError } from '../../utils/logger';
import { executeAnalyticalTool } from '../../services/analytical-tool-engine';
import { resolveDataSource } from '../../services/data-resolver';
import { resolveUserTags } from '../../utils/resolve-user-tags';
import { filterVisibleByTags } from '../../utils/tag-visibility';
import type { ToolContext } from './types';

export function createDataTools(ctx: ToolContext) {
	const log = createLogger('DataTools', { userId: ctx.userId });

	return {
		list_analytical_tools: tool({
			description:
				'List available analytical tools the user can run. Returns tool names, descriptions, categories, and input requirements.',
			inputSchema: z.object({}),
			execute: async () => {
				try {
					const userTags = await resolveUserTags(ctx.userId, ctx.db);
					const allTools = await ctx.db
						.select({
							id: analyticalTools.id,
							tool_key: analyticalTools.toolKey,
							display_name: analyticalTools.displayName,
							description: analyticalTools.description,
							category: analyticalTools.category,
							icon: analyticalTools.icon,
							input_schema: analyticalTools.inputSchema,
							tag_rule: analyticalTools.tagRule
						})
						.from(analyticalTools)
						.where(eq(analyticalTools.isActive, true))
						.orderBy(asc(analyticalTools.displayName));

					const visible = filterVisibleByTags(
						allTools.map((t) => ({
							...t,
							tag_rule: t.tag_rule as import('@repo/shared/types').TagRule | null
						})),
						userTags
					);
					return {
						_toolType: 'data_result',
						tools: visible.map((t) => ({
							tool_key: t.tool_key,
							display_name: t.display_name,
							description: t.description || '',
							category: t.category,
							input_schema: t.input_schema
						}))
					};
				} catch (error) {
					log.error('list_analytical_tools_failed', { ...formatError(error) });
					return { _toolType: 'error', error: 'Failed to list analytical tools.' };
				}
			}
		}),

		run_analytical_tool: tool({
			description:
				'Run an analytical tool on the provided input data. Returns computed results, metrics, and visualization suggestions. Use list_analytical_tools first to see available tools and their input schemas.',
			inputSchema: z.object({
				tool_key: z.string().describe('The tool_key of the analytical tool to run'),
				input_params: z
					.record(z.string(), z.unknown())
					.describe("Input parameters matching the tool's input_schema")
			}),
			execute: async ({ tool_key, input_params }) => {
				try {
					const result = await executeAnalyticalTool(
						{ tool_key, input_params, user_id: ctx.userId },
						{ userId: ctx.userId, db: ctx.db }
					);

					log.info('analytical_tool_executed', { tool_key });
					return {
						_toolType: 'analytical_tool_result',
						tool_key,
						data_source_ref: result.data_source_ref,
						metrics: result.metrics,
						visualizations: result.visualizations,
						data_keys: Object.keys(result.data)
					};
				} catch (error) {
					log.error('run_analytical_tool_failed', { tool_key, ...formatError(error) });
					return { _toolType: 'error', error: (error as Error).message };
				}
			}
		}),

		get_data_from_source: tool({
			description:
				'Read data from any data source by reference. Works for static data, user uploads, agent-generated data, and analytical tool results. Analytical tool results may contain multiple datasets (e.g. allocation_chart, holdings_table, rebalancing_table). The response includes available_data_keys — use data_key param to fetch a specific dataset.',
			inputSchema: z.object({
				type: z
					.enum(['static', 'agent-generated', 'user-upload', 'analytical-tool', 'external'])
					.describe('The data source type'),
				source_id: z.string().describe('The source ID or record ID'),
				data_key: z
					.string()
					.optional()
					.describe(
						'For analytical-tool sources with multiple datasets, specify which dataset to retrieve (e.g. "holdings_table", "allocation_chart", "rebalancing_table"). If omitted, returns the first dataset along with available_data_keys.'
					),
				params: z
					.record(z.string(), z.unknown())
					.optional()
					.describe('Optional params like record_id for specific analytical tool results')
			}),
			execute: async ({ type, source_id, data_key, params }) => {
				try {
					const resolveParams = { ...params };
					if (data_key) resolveParams.data_key = data_key;

					const data = await resolveDataSource(
						{ type, source_id, params: resolveParams },
						{ userId: ctx.userId, db: ctx.db }
					);

					if (!data || !data.rows?.length) {
						return {
							_toolType: 'data_result',
							data: null,
							message: 'No data found for this source.',
							available_data_keys: data?.meta?.available_data_keys ?? null
						};
					}

					// Summarize for agent context (limit to 50 rows to avoid overloading context)
					const truncated = data.rows.length > 50;
					const rows = truncated ? data.rows.slice(0, 50) : data.rows;

					return {
						_toolType: 'data_result',
						columns: data.columns,
						rows,
						total_rows: data.rows.length,
						truncated,
						meta: data.meta,
						available_data_keys: data.meta?.available_data_keys ?? null
					};
				} catch (error) {
					log.error('get_data_from_source_failed', { type, source_id, ...formatError(error) });
					return { _toolType: 'error', error: 'Failed to resolve data source.' };
				}
			}
		}),

		list_user_data_sources: tool({
			description:
				"List the user's stored data sources — past tool results, agent-generated data, and uploaded data. Useful to find data that can be used with get_data_from_source or added to dashboard widgets.",
			inputSchema: z.object({
				created_by: z
					.enum(['agent', 'tool', 'upload', 'user', 'system'])
					.optional()
					.describe('Filter by who created the data source')
			}),
			execute: async ({ created_by }) => {
				try {
					const conditions = [eq(userDataSources.user, ctx.userId)];
					if (created_by) conditions.push(eq(userDataSources.createdBy, created_by));

					const records = await ctx.db
						.select({
							id: userDataSources.id,
							sourceKey: userDataSources.sourceKey,
							displayName: userDataSources.displayName,
							createdBy: userDataSources.createdBy,
							toolKey: userDataSources.toolKey,
							created: userDataSources.created,
							isStale: userDataSources.isStale
						})
						.from(userDataSources)
						.where(and(...conditions))
						.orderBy(desc(userDataSources.created));

					return {
						_toolType: 'data_result',
						sources: records.map((r) => ({
							id: r.id,
							source_key: r.sourceKey,
							display_name: r.displayName,
							created_by: r.createdBy,
							tool_key: r.toolKey || null,
							created: r.created,
							is_stale: r.isStale ?? false
						}))
					};
				} catch (error) {
					log.error('list_user_data_sources_failed', { ...formatError(error) });
					return { _toolType: 'error', error: 'Failed to list data sources.' };
				}
			}
		})
	};
}
