/**
 * Dashboard remote — CRUD for widget instances and layout management.
 * One domain: dashboard operations only.
 */

import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import {
  userProfiles,
  userDashboardLayouts,
  userWidgetInstances,
  dashboardWidgets,
  userTodos,
  userReminders,
  userBookmarks
} from '@repo/db/schema';
import { and, eq, asc, desc } from 'drizzle-orm';
import z from 'zod/v4';

import {
  type UserWidgetInstanceRecord,
  type UserDashboardLayoutRecord,
  WIDGET_CONFIG_SCHEMAS,
  visualConfigSchema,
  widgetPositionSchema
} from '$lib/types/widgets';

// ── Helpers ──────────────────────────────────────────────────────────────────

type LayoutRow = typeof userDashboardLayouts.$inferSelect;
type WidgetRow = typeof userWidgetInstances.$inferSelect;

function toLayoutRecord(row: LayoutRow): UserDashboardLayoutRecord {
  return {
    id: row.id,
    created: row.created ?? '',
    updated: row.updated ?? '',
    user: row.user ?? '',
    profile: row.profile ?? '',
    layout_name: row.layoutName ?? '',
    grid_config: row.gridConfig as Record<string, unknown> | null,
    is_active: row.isActive ?? false
  };
}

function toWidgetRecord(row: WidgetRow): UserWidgetInstanceRecord {
  return {
    id: row.id,
    created: row.created ?? '',
    updated: row.updated ?? '',
    dashboard: row.dashboard ?? '',
    user: row.user ?? '',
    widget_type: row.widgetType ?? '',
    widget_title: row.widgetTitle ?? '',
    position: row.position as UserWidgetInstanceRecord['position'],
    custom_config: (row.customConfig as Record<string, unknown>) ?? {},
    visual_config: row.visualConfig as UserWidgetInstanceRecord['visual_config'],
    is_visible: row.isVisible ?? true,
    created_by_ai: row.createdByAi ?? false,
    ai_generation_prompt: row.aiGenerationPrompt ?? ''
  };
}

function getDbAndUser() {
  const { locals } = getRequestEvent();
  if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
  return { db: locals.db, userId: locals.user.id };
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Combined dashboard data query — profile → layout → widgets in 3 DB calls.
 * Eliminates redundant "find active profile" lookups.
 */
export const loadDashboardData = query(async () => {
  const { db, userId } = getDbAndUser();

  // 1. Find active profile, falling back to the same default/last-accessed order as +layout.
  let [activeProfile] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(and(eq(userProfiles.user, userId), eq(userProfiles.isActive, true)))
    .limit(1);

  if (!activeProfile) {
    [activeProfile] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.user, userId))
      .orderBy(desc(userProfiles.isDefault), desc(userProfiles.lastAccessed))
      .limit(1);
  }

  if (!activeProfile) return { layout: null, widgets: [] };

  // 2. Find the profile's active layout
  const [layoutRow] = await db
    .select()
    .from(userDashboardLayouts)
    .where(
      and(
        eq(userDashboardLayouts.user, userId),
        eq(userDashboardLayouts.profile, activeProfile.id),
        eq(userDashboardLayouts.isActive, true)
      )
    )
    .limit(1);

  if (!layoutRow) return { layout: null, widgets: [] };

  // 3. Load widgets for that layout
  const widgetRows = await db
    .select()
    .from(userWidgetInstances)
    .where(
      and(eq(userWidgetInstances.dashboard, layoutRow.id), eq(userWidgetInstances.user, userId))
    )
    .orderBy(asc(userWidgetInstances.created));

  return {
    layout: toLayoutRecord(layoutRow),
    widgets: widgetRows.map(toWidgetRecord)
  };
});

/**
 * Load dashboard data for a specific profile by ID.
 * Used by the client-side store to prefetch non-active profiles' widgets.
 */
export const loadProfileDashboard = query(z.string(), async (profileId) => {
  const { db, userId } = getDbAndUser();

  const [layoutRow] = await db
    .select()
    .from(userDashboardLayouts)
    .where(
      and(
        eq(userDashboardLayouts.user, userId),
        eq(userDashboardLayouts.profile, profileId),
        eq(userDashboardLayouts.isActive, true)
      )
    )
    .limit(1);

  if (!layoutRow) return { layout: null, widgets: [] as UserWidgetInstanceRecord[] };

  const widgetRows = await db
    .select()
    .from(userWidgetInstances)
    .where(
      and(eq(userWidgetInstances.dashboard, layoutRow.id), eq(userWidgetInstances.user, userId))
    )
    .orderBy(asc(userWidgetInstances.created));

  return {
    layout: toLayoutRecord(layoutRow),
    widgets: widgetRows.map(toWidgetRecord)
  };
});

/** Load available widget types from the registry. */
export const loadWidgetCatalog = query(async () => {
  const { locals } = getRequestEvent();
  if (!locals.db) throw error(401, 'Unauthorized');

  const rows = await locals.db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.isActive, true))
    .orderBy(asc(dashboardWidgets.name));

  return rows;
});

// ── Commands ─────────────────────────────────────────────────────────────────

const addWidgetSchema = z.object({
  dashboardId: z.string().min(1),
  widgetType: z.string().min(1),
  widgetTitle: z.string().optional(),
  position: widgetPositionSchema,
  customConfig: z.record(z.string(), z.unknown()).optional(),
  visualConfig: visualConfigSchema.optional()
});

/** Add a new widget instance to a dashboard layout. */
export const addWidget = command(addWidgetSchema, async (data) => {
  const { db, userId } = getDbAndUser();
  const now = new Date().toISOString();

  const configSchema = WIDGET_CONFIG_SCHEMAS[data.widgetType as keyof typeof WIDGET_CONFIG_SCHEMAS];
  const parsedConfig = configSchema
    ? configSchema.parse(data.customConfig ?? {})
    : (data.customConfig ?? {});

  const [record] = await db
    .insert(userWidgetInstances)
    .values({
      id: generateId(),
      dashboard: data.dashboardId,
      user: userId,
      widgetType: data.widgetType,
      widgetTitle: data.widgetTitle ?? '',
      position: data.position,
      customConfig: parsedConfig,
      visualConfig: data.visualConfig ?? null,
      isVisible: true,
      createdByAi: false,
      created: now,
      updated: now
    })
    .returning();

  loadDashboardData().refresh();
  return toWidgetRecord(record);
});

const updateWidgetSchema = z.object({
  widgetId: z.string().min(1),
  widgetTitle: z.string().optional(),
  position: widgetPositionSchema.optional(),
  customConfig: z.record(z.string(), z.unknown()).optional(),
  visualConfig: visualConfigSchema.optional(),
  isVisible: z.boolean().optional()
});

/** Update an existing widget instance (title, config, position, visibility). */
export const updateWidget = command(updateWidgetSchema, async (data) => {
  const { db, userId } = getDbAndUser();

  const updates: Partial<typeof userWidgetInstances.$inferInsert> = {
    updated: new Date().toISOString()
  };
  if (data.widgetTitle !== undefined) updates.widgetTitle = data.widgetTitle;
  if (data.position !== undefined) updates.position = data.position;
  if (data.customConfig !== undefined) updates.customConfig = data.customConfig;
  if (data.visualConfig !== undefined) updates.visualConfig = data.visualConfig;
  if (data.isVisible !== undefined) updates.isVisible = data.isVisible;

  const [record] = await db
    .update(userWidgetInstances)
    .set(updates)
    .where(and(eq(userWidgetInstances.id, data.widgetId), eq(userWidgetInstances.user, userId)))
    .returning();

  loadDashboardData().refresh();
  return toWidgetRecord(record);
});

const removeWidgetSchema = z.object({
  widgetId: z.string().min(1)
});

/** Remove a widget instance from a dashboard. */
export const removeWidget = command(removeWidgetSchema, async (data) => {
  const { db, userId } = getDbAndUser();
  await db
    .delete(userWidgetInstances)
    .where(and(eq(userWidgetInstances.id, data.widgetId), eq(userWidgetInstances.user, userId)));

  loadDashboardData().refresh();
});

const saveLayoutSchema = z.object({
  dashboardId: z.string().min(1),
  widgetPositions: z.array(
    z.object({
      widgetId: z.string().min(1),
      position: widgetPositionSchema
    })
  )
});

/** Batch-update widget positions after drag-and-drop reorder. */
export const saveLayout = command(saveLayoutSchema, async (data) => {
  const { db, userId } = getDbAndUser();
  const now = new Date().toISOString();

  await Promise.all(
    data.widgetPositions.map((wp) =>
      db
        .update(userWidgetInstances)
        .set({ position: wp.position, updated: now })
        .where(and(eq(userWidgetInstances.id, wp.widgetId), eq(userWidgetInstances.user, userId)))
    )
  );
});

// ── Category Aggregation ─────────────────────────────────────────────────────

/** Load distinct categories from todos, reminders, and bookmarks for widget settings dropdowns. */
export const loadCategories = query(async () => {
  const { locals } = getRequestEvent();
  if (!locals.db || !locals.user) return [];

  const db = locals.db;
  const userId = locals.user.id;

  const [todos, reminders, bookmarks] = await Promise.all([
    db.select({ category: userTodos.category }).from(userTodos).where(eq(userTodos.user, userId)),
    db
      .select({ category: userReminders.category })
      .from(userReminders)
      .where(eq(userReminders.user, userId)),
    db
      .select({ category: userBookmarks.category })
      .from(userBookmarks)
      .where(eq(userBookmarks.user, userId))
  ]);

  const categories = new Set<string>();
  for (const item of [...todos, ...reminders, ...bookmarks]) {
    if (item.category) categories.add(item.category);
  }

  return [...categories]
    .sort()
    .map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));
});
