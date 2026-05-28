/**
 * Dashboard templates remote — load admin-managed templates + create dashboards from them.
 * Uses worker RPC for tag-gated visibility filtering.
 */

import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import {
	dashboardTemplates,
	userProfiles,
	userDashboardLayouts,
	userWidgetInstances
} from '@repo/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import z from 'zod/v4';

import type { TagRule } from '@repo/shared/types';
import type { UserProfileRecord } from '$lib/types/widgets';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardTemplate {
	id: string;
	name: string;
	description: string;
	icon: string;
	category: string;
	default_widgets: TemplateWidget[];
	is_active: boolean;
	preview_image: string;
	created: string;
	updated: string;
}

interface TemplateWidget {
	widget_type: string;
	widget_title: string;
	position: { order: number; size: string };
	default_config?: Record<string, unknown>;
	visual_config?: { tint?: string } | null;
	tag_rule?: TagRule | null;
}

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Load dashboard templates visible to the current user (tag-gated via worker RPC). */
export const loadTemplates = query(async () => {
	const { locals, platform } = getRequestEvent();
	if (!locals.user) return [];

	const worker = platform?.env?.CF_WORKER;
	if (worker) {
		const result = await worker.getVisibleTemplates({ userId: locals.user.id });
		return result.templates as unknown as DashboardTemplate[];
	}

	// Fallback: direct DB query (no tag filtering)
	if (!locals.db) return [];
	const rows = await locals.db
		.select()
		.from(dashboardTemplates)
		.where(eq(dashboardTemplates.isActive, true))
		.orderBy(asc(dashboardTemplates.category), asc(dashboardTemplates.name));

	return rows.map((r) => ({
		id: r.id,
		name: r.name ?? '',
		description: r.description ?? '',
		icon: r.icon ?? '',
		category: r.category ?? '',
		default_widgets: (r.defaultWidgets ?? []) as TemplateWidget[],
		is_active: r.isActive ?? false,
		preview_image: r.previewImage ?? '',
		created: r.created ?? '',
		updated: r.updated ?? ''
	})) satisfies DashboardTemplate[];
});

// ── Commands ─────────────────────────────────────────────────────────────────

const addFromTemplateSchema = z.object({
	templateId: z.string().min(1),
	dashboardName: z.string().min(1).max(100).optional()
});

/**
 * Create a new dashboard (profile) from a template.
 * Clones the template's default widgets into a fresh layout.
 * Widget-level tag_rules are evaluated: only qualifying widgets are instantiated.
 */
export const addDashboardFromTemplate = command(addFromTemplateSchema, async (data) => {
	const { db, userId } = getDbAndUser();
	const { platform } = getRequestEvent();

	// Fetch template via worker RPC (admin auth) to bypass collection read rules
	const worker = platform?.env?.CF_WORKER;
	let template: DashboardTemplate;
	if (worker) {
		const { template: t } = await worker.getTemplateById({ templateId: data.templateId });
		if (!t) throw error(404, 'Dashboard template not found or no longer available');
		template = t as unknown as DashboardTemplate;
	} else {
		// Fallback: direct DB query (dev without worker binding)
		const [row] = await db
			.select()
			.from(dashboardTemplates)
			.where(eq(dashboardTemplates.id, data.templateId))
			.limit(1);
		if (!row) throw error(404, 'Dashboard template not found or no longer available');
		template = {
			id: row.id,
			name: row.name ?? '',
			description: row.description ?? '',
			icon: row.icon ?? '',
			category: row.category ?? '',
			default_widgets: (row.defaultWidgets ?? []) as TemplateWidget[],
			is_active: row.isActive ?? false,
			preview_image: row.previewImage ?? '',
			created: row.created ?? '',
			updated: row.updated ?? ''
		};
	}

	// Filter widgets by tag_rule via worker RPC (widget-level scoping)
	let widgets = template.default_widgets ?? [];
	if (worker && widgets.some((w) => w.tag_rule?.groups?.length)) {
		const { filteredWidgets } = await worker.filterTemplateWidgets({
			userId,
			widgets: widgets as unknown[]
		});
		widgets = filteredWidgets as TemplateWidget[];
	}

	const profileCount = await db
		.select({ id: userProfiles.id })
		.from(userProfiles)
		.where(eq(userProfiles.user, userId));

	const now = new Date().toISOString();
	const profileId = generateId();

	const [profile] = await db
		.insert(userProfiles)
		.values({
			id: profileId,
			user: userId,
			profileName: data.dashboardName ?? template.name,
			profileType: 'custom',
			profileIcon: template.icon || 'LayoutDashboard',
			profileColor: 'oklch(0.7 0.15 250)',
			themePreset: 'slate',
			themeMode: 'dark',
			isDefault: false,
			isActive: false,
			isPinned: true,
			sortOrder: profileCount.length,
			templateId: template.id,
			lastAccessed: now,
			accessCount: '0',
			created: now,
			updated: now
		})
		.returning();

	const layoutId = generateId();
	await db.insert(userDashboardLayouts).values({
		id: layoutId,
		user: userId,
		profile: profileId,
		layoutName: 'Default',
		gridConfig: null,
		isActive: true,
		created: now,
		updated: now
	});

	if (widgets.length > 0) {
		await db.insert(userWidgetInstances).values(
			widgets.map((w) => ({
				id: generateId(),
				dashboard: layoutId,
				user: userId,
				widgetType: w.widget_type,
				widgetTitle: w.widget_title,
				position: w.position,
				customConfig: w.default_config ?? {},
				visualConfig: w.visual_config ?? null,
				isVisible: true,
				createdByAi: false,
				created: now,
				updated: now
			}))
		);
	}

	// Return PB-shaped record for consumer compatibility
	return {
		id: profile.id,
		created: profile.created,
		updated: profile.updated,
		user: profile.user,
		profile_name: profile.profileName,
		profile_type: profile.profileType,
		profile_icon: profile.profileIcon,
		profile_color: profile.profileColor,
		theme_preset: profile.themePreset,
		theme_mode: profile.themeMode,
		is_default: profile.isDefault,
		is_active: profile.isActive,
		is_pinned: profile.isPinned,
		sort_order: Number(profile.sortOrder ?? 0),
		template_id: profile.templateId,
		last_accessed: profile.lastAccessed,
		access_count: Number(profile.accessCount ?? 0)
	} as unknown as UserProfileRecord;
});
