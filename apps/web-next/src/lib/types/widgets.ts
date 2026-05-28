/**
 * Widget system types, Zod config schemas, and database response shapes.
 * Widget types match the `dashboard_widgets` table (kebab-case).
 */
import z from 'zod/v4';

// Re-export shared types — type definitions only (data is now DB-driven)
import {
	type WidgetType,
	type WidgetSize,
	type ConfigFieldType,
	type ConfigFieldDescriptor,
	type WidgetMeta
} from '@repo/shared/types';

export {
	type WidgetType,
	type WidgetSize,
	type ConfigFieldType,
	type ConfigFieldDescriptor,
	type WidgetMeta
};

// ── Per-Type Config Schemas ──────────────────────────────────────────────────

export const chartConfigSchema = z.object({
	chartType: z.enum(['area', 'bar', 'line', 'pie', 'radar']).default('area'),
	dateRange: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
	dataSource: z.string().optional(),
	dataSourceType: z.string().optional()
});

export const todoConfigSchema = z.object({
	filter: z.enum(['all', 'active', 'done']).default('active'),
	sortBy: z.enum(['date', 'priority']).default('date'),
	category: z.string().optional(),
	limit: z.number().default(10)
});

export const newsConfigSchema = z.object({
	source: z.string().default('all'),
	limit: z.number().default(8),
	density: z.enum(['compact', 'comfortable']).default('comfortable')
});

export const remindersConfigSchema = z.object({
	timeGroup: z.enum(['today', 'week', 'month']).default('week'),
	showCompleted: z.boolean().default(false),
	category: z.string().optional(),
	limit: z.number().default(5)
});

export const quickActionsConfigSchema = z.object({
	actions: z
		.array(
			z.object({
				label: z.string(),
				icon: z.string(),
				route: z.string()
			})
		)
		.default([])
});

export const recentChatsConfigSchema = z.object({
	limit: z.number().default(5),
	showAgentName: z.boolean().default(true)
});

export const calendarConfigSchema = z.object({});

export const bookmarksConfigSchema = z.object({
	category: z.string().optional()
});

export const profileSummaryConfigSchema = z.object({
	compact: z.boolean().default(false)
});

export const knowledgeConfigSchema = z.object({
	category: z.string().optional(),
	viewMode: z.enum(['card', 'list']).default('card'),
	limit: z.number().default(10)
});

// ── Config Schema Registry ───────────────────────────────────────────────────

export const WIDGET_CONFIG_SCHEMAS: Record<WidgetType, z.ZodType> = {
	chart: chartConfigSchema,
	todo: todoConfigSchema,
	news: newsConfigSchema,
	reminders: remindersConfigSchema,
	'quick-actions': quickActionsConfigSchema,
	'recent-chats': recentChatsConfigSchema,
	calendar: calendarConfigSchema,
	bookmarks: bookmarksConfigSchema,
	'profile-summary': profileSummaryConfigSchema,
	knowledge: knowledgeConfigSchema,
	'bank-accounts': z.object({})
};

// ── Inferred Config Types ────────────────────────────────────────────────────

export type ChartConfig = z.infer<typeof chartConfigSchema>;
export type TodoConfig = z.infer<typeof todoConfigSchema>;
export type NewsConfig = z.infer<typeof newsConfigSchema>;
export type RemindersConfig = z.infer<typeof remindersConfigSchema>;
export type QuickActionsConfig = z.infer<typeof quickActionsConfigSchema>;
export type RecentChatsConfig = z.infer<typeof recentChatsConfigSchema>;
export type CalendarConfig = z.infer<typeof calendarConfigSchema>;
export type BookmarksConfig = z.infer<typeof bookmarksConfigSchema>;
export type ProfileSummaryConfig = z.infer<typeof profileSummaryConfigSchema>;
export type KnowledgeConfig = z.infer<typeof knowledgeConfigSchema>;

export type WidgetConfig =
	| ChartConfig
	| TodoConfig
	| NewsConfig
	| RemindersConfig
	| QuickActionsConfig
	| RecentChatsConfig
	| CalendarConfig
	| BookmarksConfig
	| ProfileSummaryConfig
	| KnowledgeConfig;

// ── Visual Config ────────────────────────────────────────────────────────────

export const visualConfigSchema = z.object({
	bg: z.string().optional(),
	border: z.string().optional(),
	accent: z.string().optional(),
	tint: z.string().optional()
});

export type VisualConfig = z.infer<typeof visualConfigSchema>;

// ── Widget Position ──────────────────────────────────────────────────────────

export const widgetPositionSchema = z.object({
	order: z.number(),
	size: z.enum(['sm', 'md', 'lg']).default('md')
});

export type WidgetPosition = z.infer<typeof widgetPositionSchema>;

// ── PB Response Types ────────────────────────────────────────────────────────

interface PBBaseFields {
	id: string;
	created: string;
	updated: string;
}

export interface DashboardWidgetRecord extends PBBaseFields {
	widget_type: string;
	name: string;
	description: string;
	default_config: Record<string, unknown>;
	default_size: WidgetSize;
	is_active: boolean;
}

export interface UserProfileRecord extends PBBaseFields {
	user: string;
	profile_name: string;
	profile_type: 'work' | 'personal' | 'custom';
	profile_icon: string;
	profile_color: string;
	theme_preset: string;
	theme_mode: 'light' | 'dark';
	is_default: boolean;
	is_active: boolean;
	is_pinned: boolean;
	sort_order: number;
	template_id: string;
	last_accessed: string;
	access_count: number;
}

export interface UserDashboardLayoutRecord extends PBBaseFields {
	user: string;
	profile: string;
	layout_name: string;
	grid_config: Record<string, unknown> | null;
	is_active: boolean;
}

export interface UserWidgetInstanceRecord extends PBBaseFields {
	dashboard: string;
	user: string;
	widget_type: string;
	position: WidgetPosition;
	widget_title: string;
	custom_config: Record<string, unknown>;
	visual_config: VisualConfig | null;
	is_visible: boolean;
	created_by_ai: boolean;
	ai_generation_prompt: string;
}
