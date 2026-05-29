/**
 * Profile remote — CRUD for user profiles + default profile creation.
 * One domain: profile management only.
 */

import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { userProfiles, userDashboardLayouts, userWidgetInstances, users } from '@repo/db/schema';
import { and, eq, ne, desc, sql, asc } from 'drizzle-orm';
import z from 'zod/v4';

import type { UserProfileRecord } from '$lib/types/widgets';

// ── Helpers ──────────────────────────────────────────────────────────────────

type ProfileRow = typeof userProfiles.$inferSelect;

function toProfileRecord(row: ProfileRow): UserProfileRecord {
  return {
    id: row.id,
    created: row.created ?? '',
    updated: row.updated ?? '',
    user: row.user ?? '',
    profile_name: row.profileName ?? '',
    profile_type: (row.profileType as UserProfileRecord['profile_type']) ?? 'personal',
    profile_icon: row.profileIcon ?? 'User',
    profile_color: row.profileColor ?? 'oklch(0.7 0.15 250)',
    theme_preset: row.themePreset ?? 'slate',
    theme_mode: (row.themeMode as 'light' | 'dark') ?? 'dark',
    is_default: row.isDefault ?? false,
    is_active: row.isActive ?? false,
    is_pinned: row.isPinned ?? false,
    sort_order: Number(row.sortOrder ?? 0),
    template_id: row.templateId ?? '',
    last_accessed: row.lastAccessed ?? '',
    access_count: Number(row.accessCount ?? 0)
  };
}

function getDbAndUser() {
  const { locals } = getRequestEvent();
  if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
  return { db: locals.db, userId: locals.user.id };
}

// ── Commands ─────────────────────────────────────────────────────────────────

const createProfileSchema = z.object({
  profileName: z.string().min(1).max(100),
  profileType: z.enum(['work', 'personal', 'custom']).default('personal'),
  profileIcon: z.string().default('User'),
  profileColor: z.string().default('oklch(0.7 0.15 250)')
});

/** Create a new profile with a linked dashboard layout. */
export const createProfile = command(createProfileSchema, async (data) => {
  const { db, userId } = getDbAndUser();
  const now = new Date().toISOString();

  const existingCount = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.user, userId));

  const [profile] = await db
    .insert(userProfiles)
    .values({
      id: generateId(),
      user: userId,
      profileName: data.profileName,
      profileType: data.profileType,
      profileIcon: data.profileIcon,
      profileColor: data.profileColor,
      themePreset: 'slate',
      themeMode: 'dark',
      isDefault: false,
      isActive: false,
      isPinned: true,
      sortOrder: existingCount.length,
      lastAccessed: now,
      accessCount: '0',
      created: now,
      updated: now
    })
    .returning();

  await db.insert(userDashboardLayouts).values({
    id: generateId(),
    user: userId,
    profile: profile.id,
    layoutName: 'Default',
    gridConfig: null,
    isActive: true,
    created: now,
    updated: now
  });

  return toProfileRecord(profile);
});

const switchProfileSchema = z.object({
  profileId: z.string().min(1)
});

/** Switch active profile — deactivate current active, activate new. */
export const switchProfile = command(switchProfileSchema, async (data) => {
  const { db, userId } = getDbAndUser();
  const now = new Date().toISOString();

  // Deactivate all other active profiles for this user
  await db
    .update(userProfiles)
    .set({ isActive: false, updated: now })
    .where(
      and(
        eq(userProfiles.user, userId),
        eq(userProfiles.isActive, true),
        ne(userProfiles.id, data.profileId)
      )
    );

  // Activate target profile and bump access
  const [updated] = await db
    .update(userProfiles)
    .set({
      isActive: true,
      lastAccessed: now,
      accessCount: sql`COALESCE(${userProfiles.accessCount}::int, 0) + 1`,
      updated: now
    })
    .where(and(eq(userProfiles.id, data.profileId), eq(userProfiles.user, userId)))
    .returning();

  if (!updated) throw error(404, 'Profile not found');
  return toProfileRecord(updated);
});

const updateProfileSchema = z.object({
  profileId: z.string().min(1),
  profileName: z.string().min(1).max(100).optional(),
  profileType: z.enum(['work', 'personal', 'custom']).optional(),
  profileIcon: z.string().optional(),
  profileColor: z.string().optional(),
  themePreset: z.string().optional(),
  themeMode: z.enum(['light', 'dark']).optional(),
  isPinned: z.boolean().optional(),
  sortOrder: z.number().optional()
});

/** Update profile settings (name, type, icon, color, theme, pin state). */
export const updateProfile = command(updateProfileSchema, async (data) => {
  const { db, userId } = getDbAndUser();

  const updates: Partial<typeof userProfiles.$inferInsert> = { updated: new Date().toISOString() };
  if (data.profileName !== undefined) updates.profileName = data.profileName;
  if (data.profileType !== undefined) updates.profileType = data.profileType;
  if (data.profileIcon !== undefined) updates.profileIcon = data.profileIcon;
  if (data.profileColor !== undefined) updates.profileColor = data.profileColor;
  if (data.themePreset !== undefined) updates.themePreset = data.themePreset;
  if (data.themeMode !== undefined) updates.themeMode = data.themeMode;
  if (data.isPinned !== undefined) updates.isPinned = data.isPinned;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;

  const [record] = await db
    .update(userProfiles)
    .set(updates)
    .where(and(eq(userProfiles.id, data.profileId), eq(userProfiles.user, userId)))
    .returning();

  return toProfileRecord(record);
});

const duplicateProfileSchema = z.object({
  sourceProfileId: z.string().min(1),
  profileName: z.string().min(1).max(100)
});

/** Duplicate a profile — copies dashboard layout + all widget instances. */
export const duplicateProfile = command(duplicateProfileSchema, async (data) => {
  const { db, userId } = getDbAndUser();
  const now = new Date().toISOString();

  const [source] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, data.sourceProfileId))
    .limit(1);

  if (!source) throw error(404, 'Source profile not found');

  const [profile] = await db
    .insert(userProfiles)
    .values({
      id: generateId(),
      user: userId,
      profileName: data.profileName,
      profileType: source.profileType,
      profileIcon: source.profileIcon,
      profileColor: source.profileColor,
      themePreset: source.themePreset ?? 'slate',
      themeMode: source.themeMode ?? 'dark',
      isDefault: false,
      isActive: false,
      lastAccessed: now,
      accessCount: '0',
      created: now,
      updated: now
    })
    .returning();

  const [layout] = await db
    .insert(userDashboardLayouts)
    .values({
      id: generateId(),
      user: userId,
      profile: profile.id,
      layoutName: 'Default',
      gridConfig: null,
      isActive: true,
      created: now,
      updated: now
    })
    .returning();

  try {
    const [sourceLayout] = await db
      .select()
      .from(userDashboardLayouts)
      .where(
        and(
          eq(userDashboardLayouts.profile, data.sourceProfileId),
          eq(userDashboardLayouts.isActive, true)
        )
      )
      .limit(1);

    if (sourceLayout) {
      const sourceWidgets = await db
        .select()
        .from(userWidgetInstances)
        .where(eq(userWidgetInstances.dashboard, sourceLayout.id));

      if (sourceWidgets.length > 0) {
        await db.insert(userWidgetInstances).values(
          sourceWidgets.map((w) => ({
            id: generateId(),
            dashboard: layout.id,
            user: userId,
            widgetType: w.widgetType,
            widgetTitle: w.widgetTitle,
            position: w.position,
            customConfig: w.customConfig,
            visualConfig: w.visualConfig,
            isVisible: w.isVisible,
            createdByAi: false,
            created: now,
            updated: now
          }))
        );
      }
    }
  } catch {
    // Source has no layout/widgets — new profile starts empty
  }

  return toProfileRecord(profile);
});

const deleteProfileSchema = z.object({
  profileId: z.string().min(1)
});

/** Delete a profile. Cannot delete the last remaining profile. */
export const deleteProfile = command(deleteProfileSchema, async (data) => {
  const { db, userId } = getDbAndUser();

  const allProfiles = await db.select().from(userProfiles).where(eq(userProfiles.user, userId));

  if (allProfiles.length <= 1) {
    throw error(400, 'Cannot delete your only profile');
  }

  const target = allProfiles.find((p) => p.id === data.profileId);
  if (!target) throw error(404, 'Profile not found');

  await db.delete(userProfiles).where(eq(userProfiles.id, data.profileId));

  if (target.isActive) {
    const remaining = allProfiles.find((p) => p.id !== data.profileId);
    if (remaining) {
      await db
        .update(userProfiles)
        .set({ isActive: true, updated: new Date().toISOString() })
        .where(eq(userProfiles.id, remaining.id));
    }
  }
});

/**
 * Ensure default profile + dashboard exist for the user.
 * Returns all profiles + active profile in a single query.
 * This is the sole data source for +layout.server.ts.
 */
export const ensureDefaultProfile = query(async () => {
  const { locals } = getRequestEvent();
  if (!locals.db || !locals.user)
    return { profiles: [] as UserProfileRecord[], activeProfile: null };

  const db = locals.db;
  const userId = locals.user.id;

  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.user, userId))
    .orderBy(desc(userProfiles.isDefault), desc(userProfiles.lastAccessed));

  if (existing.length > 0) {
    const profiles = existing.map(toProfileRecord);
    let activeProfile = profiles.find((p) => p.is_active) ?? profiles[0];

    if (!profiles.some((p) => p.is_active) && activeProfile) {
      await db
        .update(userProfiles)
        .set({ isActive: true, updated: new Date().toISOString() })
        .where(and(eq(userProfiles.id, activeProfile.id), eq(userProfiles.user, userId)));
      activeProfile = { ...activeProfile, is_active: true };
    }

    return { profiles, activeProfile };
  }

  // First-time user — create default profile, layout, and starter widgets
  const now = new Date().toISOString();

  const [profile] = await db
    .insert(userProfiles)
    .values({
      id: generateId(),
      user: userId,
      profileName: 'My Dashboard',
      profileType: 'personal',
      profileIcon: 'User',
      profileColor: 'oklch(0.7 0.15 250)',
      themePreset: 'slate',
      themeMode: 'dark',
      isDefault: true,
      isActive: true,
      isPinned: true,
      sortOrder: 0,
      lastAccessed: now,
      accessCount: '1',
      created: now,
      updated: now
    })
    .returning();

  const [layout] = await db
    .insert(userDashboardLayouts)
    .values({
      id: generateId(),
      user: userId,
      profile: profile.id,
      layoutName: 'Default',
      gridConfig: null,
      isActive: true,
      created: now,
      updated: now
    })
    .returning();

  const defaultWidgets = [
    { widget_type: 'todo', widget_title: 'Todo List', position: { order: 0, size: 'md' } },
    { widget_type: 'calendar', widget_title: 'Calendar', position: { order: 1, size: 'sm' } },
    { widget_type: 'reminders', widget_title: 'Reminders', position: { order: 2, size: 'md' } },
    {
      widget_type: 'quick-actions',
      widget_title: 'Quick Actions',
      position: { order: 3, size: 'md' }
    },
    {
      widget_type: 'profile-summary',
      widget_title: 'Profile Summary',
      position: { order: 4, size: 'md' }
    },
    { widget_type: 'news', widget_title: 'News Feed', position: { order: 5, size: 'md' } },
    { widget_type: 'note', widget_title: 'Quick Notes', position: { order: 6, size: 'lg' } },
    {
      widget_type: 'bank-accounts',
      widget_title: 'Bank Accounts',
      position: { order: 7, size: 'md' }
    }
  ];

  await db.insert(userWidgetInstances).values(
    defaultWidgets.map((w) => ({
      id: generateId(),
      dashboard: layout.id,
      user: userId,
      widgetType: w.widget_type,
      widgetTitle: w.widget_title,
      position: w.position,
      customConfig: {},
      visualConfig: null,
      isVisible: true,
      createdByAi: false,
      created: now,
      updated: now
    }))
  );

  const newProfile = toProfileRecord(profile);
  return { profiles: [newProfile], activeProfile: newProfile };
});

// ── User display name (on users table, NOT profile) ─────────────────────────

const updateDisplayNameSchema = z.object({
  name: z.string().min(1).max(100)
});

/** Update the user's account-level display name (users.name). */
export const updateUserDisplayName = command(updateDisplayNameSchema, async (data) => {
  const { db, userId } = getDbAndUser();
  await db.update(users).set({ name: data.name }).where(eq(users.id, userId));
  return { success: true };
});
