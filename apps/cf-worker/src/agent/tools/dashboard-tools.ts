import { z } from 'zod';
import { tool } from 'ai';
import {
	userWidgetInstances,
	dashboardWidgets,
	userProfiles,
	userTodos,
	userReminders,
	userBookmarks,
	userDataSources
} from '@repo/db/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { createLogger } from '../../utils/logger';
import { ValidationError } from '../../utils/errors';
import {
	getActiveProfileAndLayout,
	resolveDashboardTemplate,
	instantiateDashboardFromTemplate
} from '../../services/dashboard-template';
import { resolveUserTags } from '../../utils/resolve-user-tags';
import type { ToolContext } from './types';

export function createDashboardTools(ctx: ToolContext) {
	const log = createLogger('DashboardTools', { userId: ctx.userId });

	return {
		get_dashboard_state: tool({
			description:
				"Read the user's active dashboard including profile info, layout, all widgets with their positions, configs, visual settings, descriptions, and the user's content categories. Categories (for todo, reminders, bookmarks, knowledge) are created by the user — they are personal organizational labels, not system settings.",
			inputSchema: z.object({}),
			execute: async () => {
				let dashboard;
				try {
					dashboard = await getActiveProfileAndLayout(ctx.db, ctx.userId);
				} catch {
					// Auto-create default dashboard for new users
					const userTags = await resolveUserTags(ctx.userId, ctx.db);
					const template = await resolveDashboardTemplate(ctx.db, userTags);
					if (template) {
						await instantiateDashboardFromTemplate(ctx.db, ctx.userId, template, userTags);
						try {
							dashboard = await getActiveProfileAndLayout(ctx.db, ctx.userId);
						} catch {
							return { _toolType: 'error', error: 'Failed to create default dashboard.' };
						}
					} else {
						return {
							_toolType: 'error',
							error: 'No active dashboard found. The user needs to create a dashboard first.'
						};
					}
				}

				const { profile, layout } = dashboard;

				const widgets = await ctx.db
					.select()
					.from(userWidgetInstances)
					.where(
						and(
							eq(userWidgetInstances.dashboard, layout.id),
							eq(userWidgetInstances.user, ctx.userId)
						)
					)
					.orderBy(asc(userWidgetInstances.created));

				// Fetch catalog descriptions for widget types
				const types = [...new Set(widgets.map((w) => w.widgetType))].filter(Boolean) as string[];
				const descByType = new Map<string, string>();
				if (types.length > 0) {
					const catalogRows = await ctx.db
						.select({
							widgetType: dashboardWidgets.widgetType,
							name: dashboardWidgets.name,
							description: dashboardWidgets.description
						})
						.from(dashboardWidgets)
						.where(inArray(dashboardWidgets.widgetType, types));
					for (const cw of catalogRows) {
						if (cw.description && cw.widgetType) descByType.set(cw.widgetType, cw.description);
					}
				}

				// Fetch user's content categories (personal organizational labels)
				const [todos, reminders, bookmarks] = await Promise.all([
					ctx.db
						.select({ category: userTodos.category })
						.from(userTodos)
						.where(eq(userTodos.user, ctx.userId)),
					ctx.db
						.select({ category: userReminders.category })
						.from(userReminders)
						.where(eq(userReminders.user, ctx.userId)),
					ctx.db
						.select({ category: userBookmarks.category })
						.from(userBookmarks)
						.where(eq(userBookmarks.user, ctx.userId))
				]);
				const categorySet = new Set<string>();
				for (const item of [...todos, ...reminders, ...bookmarks]) {
					if (item.category) categorySet.add(item.category);
				}

				return {
					_toolType: 'dashboard_state',
					profile: {
						id: profile.id,
						name: profile.profileName,
						type: profile.profileType,
						theme_preset: profile.themePreset,
						theme_mode: profile.themeMode,
						profile_color: profile.profileColor
					},
					layout: { id: layout.id, name: layout.layoutName },
					widgets: widgets.map((w) => ({
						id: w.id,
						widget_type: w.widgetType,
						widget_title: w.widgetTitle,
						description: descByType.get(w.widgetType ?? '') || null,
						position: w.position,
						custom_config: w.customConfig,
						visual_config: w.visualConfig,
						is_visible: w.isVisible
					})),
					user_categories: [...categorySet].sort()
				};
			}
		}),

		add_dashboard_widget: tool({
			description:
				"Add a new widget to the user's active dashboard. Returns the created widget. Use create_widget_data first if you need to generate chart data. Config 'category' fields (todo, reminders, bookmarks) are the user's personal categories, not system categories.",
			inputSchema: z.object({
				widget_type: z
					.string()
					.describe(
						'Widget type key, e.g. "chart", "todo", "news", "reminders", "bookmarks", "bank-accounts"'
					),
				title: z.string().optional().describe('Display title for the widget'),
				size: z.enum(['sm', 'md', 'lg']).optional().default('md').describe('Widget size'),
				config: z
					.object({})
					.passthrough()
					.optional()
					.describe('Widget-specific configuration (chartType, dataSource, filter, etc.)'),
				visual_config: z
					.object({
						tint: z.string().optional().describe('Hex color for tint gradient, e.g. "#ef4444"')
					})
					.optional()
					.describe('Visual styling')
			}),
			execute: async ({ widget_type, title, size, config, visual_config }) => {
				let dashboard;
				try {
					dashboard = await getActiveProfileAndLayout(ctx.db, ctx.userId);
				} catch {
					return {
						_toolType: 'error',
						error: 'No active dashboard found. The user needs to create a dashboard first.'
					};
				}
				const { layout } = dashboard;

				const existing = await ctx.db
					.select({ id: userWidgetInstances.id })
					.from(userWidgetInstances)
					.where(eq(userWidgetInstances.dashboard, layout.id));

				const now = new Date().toISOString();
				const newId = generateId();
				await ctx.db.insert(userWidgetInstances).values({
					id: newId,
					dashboard: layout.id,
					user: ctx.userId,
					widgetType: widget_type,
					widgetTitle: title ?? '',
					position: { order: existing.length, size: size ?? 'md' },
					customConfig: config ?? {},
					visualConfig: visual_config ?? null,
					isVisible: true,
					createdByAi: true,
					aiGenerationPrompt: '',
					created: now,
					updated: now
				});

				log.info('widget_added', { widgetId: newId, widget_type });
				return {
					_toolType: 'dashboard_update',
					action: 'widget_added',
					widget: { id: newId, widget_type, title }
				};
			}
		}),

		remove_dashboard_widget: tool({
			description: "Remove a widget from the user's dashboard by its ID.",
			inputSchema: z.object({
				widget_id: z.string().describe('The widget instance ID to remove')
			}),
			execute: async ({ widget_id }) => {
				const widget = await ctx.db.query.userWidgetInstances.findFirst({
					where: and(
						eq(userWidgetInstances.id, widget_id),
						eq(userWidgetInstances.user, ctx.userId)
					)
				});

				if (!widget) {
					throw new ValidationError('Cannot remove a widget that does not belong to you');
				}

				await ctx.db.delete(userWidgetInstances).where(eq(userWidgetInstances.id, widget_id));
				log.info('widget_removed', { widgetId: widget_id });
				return {
					_toolType: 'dashboard_update',
					action: 'widget_removed',
					widget_id
				};
			}
		}),

		update_dashboard_widget: tool({
			description:
				"Update a widget's title, size, configuration, or visual styling. Only provided fields are changed. Note: widget config 'category' fields (for todo, reminders, bookmarks) refer to the user's personal categories — use get_dashboard_state to see available user_categories first.",
			inputSchema: z.object({
				widget_id: z.string().describe('The widget instance ID to update'),
				title: z.string().optional().describe('New display title'),
				size: z.enum(['sm', 'md', 'lg']).optional().describe('New size'),
				config: z
					.object({})
					.passthrough()
					.optional()
					.describe('Widget config to merge (partial update)'),
				visual_config: z
					.object({
						tint: z.string().optional().describe('Hex color for tint gradient')
					})
					.optional()
					.describe('Visual styling to set')
			}),
			execute: async ({ widget_id, title, size, config, visual_config }) => {
				const widget = await ctx.db.query.userWidgetInstances.findFirst({
					where: and(
						eq(userWidgetInstances.id, widget_id),
						eq(userWidgetInstances.user, ctx.userId)
					)
				});

				if (!widget) {
					throw new ValidationError('Cannot update a widget that does not belong to you');
				}

				const updates: Record<string, unknown> = {};
				if (title !== undefined) updates.widgetTitle = title;
				if (size !== undefined) {
					updates.position = { ...(widget.position as Record<string, unknown>), size };
				}
				if (config !== undefined) {
					updates.customConfig = { ...(widget.customConfig as Record<string, unknown>), ...config };
				}
				if (visual_config !== undefined) updates.visualConfig = visual_config;
				updates.updated = new Date().toISOString();

				await ctx.db
					.update(userWidgetInstances)
					.set(updates)
					.where(eq(userWidgetInstances.id, widget_id));

				log.info('widget_updated', { widgetId: widget_id });
				return {
					_toolType: 'dashboard_update',
					action: 'widget_updated',
					widget_id
				};
			}
		}),

		reorder_dashboard_widgets: tool({
			description: 'Reorder widgets on the dashboard by providing new positions.',
			inputSchema: z.object({
				positions: z
					.array(
						z.object({
							widget_id: z.string(),
							order: z.number()
						})
					)
					.describe('Array of widget IDs with their new order values')
			}),
			execute: async ({ positions }) => {
				await Promise.all(
					positions.map(async ({ widget_id, order }) => {
						const widget = await ctx.db.query.userWidgetInstances.findFirst({
							where: and(
								eq(userWidgetInstances.id, widget_id),
								eq(userWidgetInstances.user, ctx.userId)
							)
						});

						if (!widget) return;

						await ctx.db
							.update(userWidgetInstances)
							.set({
								position: { ...(widget.position as Record<string, unknown>), order },
								updated: new Date().toISOString()
							})
							.where(eq(userWidgetInstances.id, widget_id));
					})
				);

				log.info('widgets_reordered', { count: positions.length });
				return {
					_toolType: 'dashboard_update',
					action: 'widgets_reordered',
					count: positions.length
				};
			}
		}),

		update_dashboard_theme: tool({
			description: "Change the user's dashboard theme preset, color mode, or profile color.",
			inputSchema: z.object({
				theme_preset: z.string().optional().describe('Theme preset key'),
				theme_mode: z.enum(['light', 'dark']).optional().describe('Light or dark mode'),
				profile_color: z.string().optional().describe('Profile accent color hex')
			}),
			execute: async ({ theme_preset, theme_mode, profile_color }) => {
				let dashboard;
				try {
					dashboard = await getActiveProfileAndLayout(ctx.db, ctx.userId);
				} catch {
					return {
						_toolType: 'error',
						error: 'No active dashboard found. The user needs to create a dashboard first.'
					};
				}
				const { profile } = dashboard;

				const updates: Record<string, unknown> = {};
				if (theme_preset !== undefined) updates.themePreset = theme_preset;
				if (theme_mode !== undefined) updates.themeMode = theme_mode;
				if (profile_color !== undefined) updates.profileColor = profile_color;
				updates.updated = new Date().toISOString();

				await ctx.db.update(userProfiles).set(updates).where(eq(userProfiles.id, profile.id));
				log.info('theme_updated', { profileId: profile.id });
				return {
					_toolType: 'dashboard_update',
					action: 'theme_updated'
				};
			}
		}),

		create_widget_data: tool({
			description:
				'Create a data source from agent-generated data (e.g., financial analysis results). Returns a source reference that can be used when adding a chart widget.',
			inputSchema: z.object({
				title: z.string().describe('Display name for this data source'),
				columns: z
					.array(
						z.object({
							key: z.string(),
							label: z.string(),
							type: z.enum(['string', 'number', 'date'])
						})
					)
					.describe('Column definitions for the data'),
				rows: z.array(z.object({}).passthrough()).describe('Data rows matching the column keys'),
				chart_type: z
					.enum(['area', 'bar', 'line', 'pie', 'radar'])
					.optional()
					.describe('Suggested chart type for visualization')
			}),
			execute: async ({ title, columns, rows, chart_type }) => {
				const now = new Date().toISOString();
				const newId = generateId();
				await ctx.db.insert(userDataSources).values({
					id: newId,
					user: ctx.userId,
					sourceKey: `agent-${crypto.randomUUID()}`,
					displayName: title,
					data: { columns, rows, meta: { title, updated_at: now } },
					createdBy: 'agent',
					agentPrompt: ctx.chatId ?? '',
					created: now,
					updated: now
				});

				log.info('widget_data_created', { recordId: newId, title });
				return {
					_toolType: 'dashboard_update',
					action: 'data_created',
					data_source: {
						type: 'agent-generated' as const,
						source_id: newId
					},
					suggested_chart_type: chart_type ?? 'bar',
					record_id: newId,
					title
				};
			}
		})
	};
}
