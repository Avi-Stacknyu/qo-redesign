/**
 * Agent Tools — Barrel
 *
 * Complete set of AI SDK v5 compatible tools for the flow executor.
 * All tools use the AI SDK tool format with:
 * - description: What the tool does
 * - inputSchema: Zod schema for parameters
 * - execute: Async function that performs the action
 *
 * SDK Tools are fully dynamic - provider.tools[sdk_tool_name](config)
 * No registry needed. Just add tool records to database with:
 * - provider_key: "google", "anthropic", "openai", "xai"
 * - sdk_tool_name: Exact name on provider.tools (e.g., "googleSearch")
 * - execution_config: Config object to pass to factory
 */

import { z } from 'zod';
import { tool, type Tool } from 'ai';
import { createLogger } from '../../utils/logger';

// Re-export shared types
export type { ToolContext } from './types';

// Re-export visualization types
export type {
	ShadcnChartType,
	ChartSeries,
	CategoryDataPoint,
	PieDataPoint,
	RadarDataPoint,
	RadialDataPoint,
	ShadcnChartOutput
} from './visualization-tools';

// Re-export SDK helper
export { getSdkTool } from './sdk-providers';

// Import all tool group factories
import { createNotesTools } from './note-tools';
import { createTaskTools } from './task-tools';
import { createReminderTools } from './reminder-tools';
import { createDocumentTools } from './document-tools';
import { createUtilityTools } from './utility-tools';
import { createVisualizationTools } from './visualization-tools';
import { createConfirmationTools } from './confirmation-tools';
import { createMemorySearchTools } from './memory-search-tools';
import { createDashboardTools } from './dashboard-tools';
import { createDataTools } from './data-tools';
import { getSdkTool } from './sdk-providers';
import type { ToolContext } from './types';

// Re-export individual factories for direct use / tests
export {
	createNotesTools,
	createTaskTools,
	createReminderTools,
	createDocumentTools,
	createUtilityTools,
	createVisualizationTools,
	createConfirmationTools,
	createMemorySearchTools,
	createDashboardTools,
	createDataTools
};

// ============================================================================
// Create All Tools
// ============================================================================

export function createAllTools(ctx: ToolContext) {
	return {
		...createMemorySearchTools(ctx),
		...createNotesTools(ctx),
		...createTaskTools(ctx),
		...createReminderTools(ctx),
		...createDocumentTools(ctx),
		...createUtilityTools(ctx),
		// ...createWebSearchTools(ctx),
		...createVisualizationTools(ctx),
		...createConfirmationTools(ctx),
		...createDashboardTools(ctx),
		...createDataTools(ctx)
	};
}

// ============================================================================
// Lazy Tool Registry
// ============================================================================

type ToolGroupFactory = (ctx: ToolContext) => Record<string, Tool<any, any>>;

const TOOL_GROUP_ENTRIES: [string[], ToolGroupFactory][] = [
	[['recall_memory', 'recall_sessions'], createMemorySearchTools],
	[['create_note', 'get_notes', 'update_note', 'delete_note'], createNotesTools],
	[['create_task', 'get_tasks', 'update_task', 'toggle_task', 'delete_task'], createTaskTools],
	[['create_reminder', 'get_reminders', 'update_reminder', 'delete_reminder'], createReminderTools],
	[
		['search_knowledge_base', 'list_files', 'search_documents', 'read_file_content'],
		createDocumentTools
	],
	[['get_current_time', 'calculate'], createUtilityTools],
	[['display_chart', 'display_table'], createVisualizationTools],
	[['ask_confirmation', 'request_input'], createConfirmationTools],
	[
		[
			'get_dashboard_state',
			'add_dashboard_widget',
			'remove_dashboard_widget',
			'update_dashboard_widget',
			'reorder_dashboard_widgets',
			'update_dashboard_theme',
			'create_widget_data'
		],
		createDashboardTools
	],
	[['list_analytical_tools', 'run_analytical_tool'], createDataTools]
];

const TOOL_KEY_TO_FACTORY = new Map<string, ToolGroupFactory>();
for (const [keys, factory] of TOOL_GROUP_ENTRIES) {
	for (const key of keys) {
		TOOL_KEY_TO_FACTORY.set(key, factory);
	}
}

/** Lazily resolve a single builtin tool by key, caching group results per call */
function resolveBuiltinTool(
	ctx: ToolContext,
	key: string,
	groupCache: Map<ToolGroupFactory, Record<string, any>>
): ReturnType<typeof tool<z.ZodTypeAny, unknown>> | undefined {
	const factory = TOOL_KEY_TO_FACTORY.get(key);
	if (!factory) return undefined;

	let group = groupCache.get(factory);
	if (!group) {
		group = factory(ctx);
		groupCache.set(factory, group);
	}
	return group[key];
}

// ============================================================================
// Get Tools for LLM Node
// ============================================================================

/**
 * Resolved tool configuration from compiled flow
 */
interface ResolvedToolConfig {
	id: string;
	tool_key: string;
	tool_type: 'builtin' | 'sdk';
	sdk_tool_name?: string;
	execution_config?: Record<string, unknown>;
	provider_key?: string;
}

/**
 * Get tools for an LLM node based on configured tool IDs
 *
 * Handles both:
 * - Builtin tools: Custom tools defined in createAllTools()
 * - SDK tools: Provider-defined tools from @ai-sdk/* packages
 *
 * SDK tools are looked up in SDK_TOOLS_REGISTRY using:
 * - provider_key: The AI provider (google, anthropic, openai, xai)
 * - sdk_tool_name: The tool factory name (e.g., "googleSearch", "webSearch_20250305")
 * - execution_config: Configuration passed to the tool factory
 */
export async function getToolsForNode(
	ctx: ToolContext,
	toolIds: string[],
	resolvedTools: Record<string, ResolvedToolConfig>,
	activeProviderKey?: string
): Promise<Record<string, ReturnType<typeof tool<z.ZodTypeAny, unknown>>>> {
	const groupCache = new Map<ToolGroupFactory, Record<string, any>>();
	const selectedTools: Record<string, any> = {};
	const log = createLogger('Tools', { userId: ctx.userId });

	for (const toolId of toolIds) {
		const toolConfig = resolvedTools[toolId];
		if (!toolConfig) continue;

		// Tier gating: skip tools not in the allowed set (empty set = all allowed)
		if (ctx.allowedToolIds && ctx.allowedToolIds.size > 0 && !ctx.allowedToolIds.has(toolId)) {
			continue;
		}

		const toolKey = toolConfig.tool_key;

		if (toolConfig.tool_type === 'builtin') {
			// Builtin tool - lazily resolve from group registry
			const t = resolveBuiltinTool(ctx, toolKey, groupCache);
			if (t) {
				selectedTools[toolKey] = t;
			}
		} else if (toolConfig.tool_type === 'sdk') {
			// SDK tool - look up in SDK_TOOLS_REGISTRY
			if (!toolConfig.provider_key || !toolConfig.sdk_tool_name) {
				log.warn('sdk_tool_missing_config', { toolKey });
				continue;
			}

			// Silently skip SDK tools incompatible with the active model's provider
			if (activeProviderKey && toolConfig.provider_key !== activeProviderKey) {
				log.debug('sdk_tool_skipped_provider_mismatch', {
					toolKey,
					toolProvider: toolConfig.provider_key,
					activeProvider: activeProviderKey
				});
				continue;
			}

			const sdkTool = getSdkTool(
				toolConfig.provider_key,
				toolConfig.sdk_tool_name,
				toolConfig.execution_config
			);

			if (sdkTool) {
				// Use tool_key as the key (this is what the LLM sees)
				selectedTools[toolKey] = sdkTool;
				log.debug('sdk_tool_loaded', {
					toolKey,
					provider: toolConfig.provider_key,
					sdkTool: toolConfig.sdk_tool_name
				});
			}
		}
	}

	return selectedTools;
}

// ============================================================================
// Tool Key List (for reference)
// ============================================================================

export const BUILTIN_TOOL_KEYS = [
	// Memory Search
	'recall_memory',
	'recall_sessions',
	// Notes
	'create_note',
	'get_notes',
	'update_note',
	'delete_note',
	// Tasks
	'create_task',
	'get_tasks',
	'update_task',
	'toggle_task',
	'delete_task',
	// Reminders
	'create_reminder',
	'get_reminders',
	'update_reminder',
	'delete_reminder',
	// Documents
	'search_knowledge_base',
	'list_files',
	'search_documents',
	'read_file_content',
	// Utilities
	'get_current_time',
	'calculate',
	// Web (conditional)
	// 'web_search',
	// Visualization (client-side)
	'display_chart',
	'display_table',
	// Human-in-the-loop (client-side)
	'ask_confirmation',
	'request_input',
	// Dashboard
	'get_dashboard_state',
	'add_dashboard_widget',
	'remove_dashboard_widget',
	'update_dashboard_widget',
	'reorder_dashboard_widgets',
	'update_dashboard_theme',
	'create_widget_data'
] as const;

export type BuiltinToolKey = (typeof BUILTIN_TOOL_KEYS)[number];
