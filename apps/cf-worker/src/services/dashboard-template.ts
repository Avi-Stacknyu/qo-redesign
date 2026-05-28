/**
 * Dashboard Template Service
 *
 * Resolves which dashboard template a user should see based on their tags,
 * then instantiates it into a concrete user dashboard (profile + layout + widget instances).
 *
 * Widget-level gating: widgets in the template whose catalog entry has a tag_rule
 * the user doesn't match are silently skipped during instantiation.
 */

import type { TagRule } from '@repo/shared/types';
import type { Database } from '@repo/db/types';
import {
	dashboardTemplates,
	dashboardWidgets,
	userProfiles,
	userDashboardLayouts,
	userWidgetInstances
} from '@repo/db/schema';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import { evaluateTagRule, resolveVisibility } from '../utils/tag-rule-engine';
import { createLogger } from '../utils/logger';

const log = createLogger('DashboardTemplate');

interface CatalogWidget {
	id: string;
	name: string;
	widgetType: string;
	description?: string;
	defaultConfig?: Record<string, unknown>;
	defaultSize?: string;
	tagRule?: TagRule | null;
	isActive?: boolean;
}

interface TemplateWidget {
	widget_type: string;
	widget_title: string;
	position: { order: number; size: string };
	default_config: Record<string, unknown>;
	visual_config: { tint?: string } | null;
}

interface TemplateRecord {
	id: string;
	name: string | null;
	description?: string | null;
	tagRule?: TagRule | null;
	defaultWidgets?: TemplateWidget[] | null;
	isActive?: boolean | null;
}

/**
 * Resolve the best dashboard template for a user based on their tags.
 *
 * Priority:
 * 1. Templates with a tag_rule that matches the user → first match wins
 * 2. Fallback: a template with no tag_rule (visible to all)
 * 3. null if no templates exist at all
 */
export async function resolveDashboardTemplate(
	db: Database,
	userTags: string[]
): Promise<TemplateRecord | null> {
	const templates = (await db
		.select()
		.from(dashboardTemplates)
		.where(eq(dashboardTemplates.isActive, true))
		.orderBy(desc(dashboardTemplates.created))) as TemplateRecord[];

	if (templates.length === 0) return null;

	// Separate gated templates from ungated (fallback) ones
	const gated = templates.filter((t) => t.tagRule && t.tagRule.groups?.length);
	const ungated = templates.filter((t) => !t.tagRule || !t.tagRule.groups?.length);

	// Try gated templates first — first match wins
	const matched = resolveVisibility(gated, userTags, (t) => t.tagRule ?? null);
	if (matched.length > 0) return matched[0];

	// Fallback to first ungated template
	return ungated[0] ?? null;
}

/**
 * Filter a template's widgets by checking the catalog widget's tag_rule.
 * Widgets whose catalog entry has a tag_rule the user doesn't match are skipped.
 */
export async function filterTemplateWidgets(
	db: Database,
	templateWidgets: TemplateWidget[],
	userTags: string[]
): Promise<TemplateWidget[]> {
	if (templateWidgets.length === 0) return [];

	// Fetch catalog widgets for the types referenced in this template
	const types = [...new Set(templateWidgets.map((w) => w.widget_type))];

	const catalogRecords = await db
		.select({
			widgetType: dashboardWidgets.widgetType,
			tagRule: dashboardWidgets.tagRule
		})
		.from(dashboardWidgets)
		.where(and(eq(dashboardWidgets.isActive, true), inArray(dashboardWidgets.widgetType, types)));

	// Index by widget_type → tag_rule
	const rulesByType = new Map<string, TagRule | null>();
	for (const cw of catalogRecords) {
		if (cw.widgetType) rulesByType.set(cw.widgetType, (cw.tagRule as TagRule) ?? null);
	}

	// Filter: keep widgets whose catalog tag_rule passes (or doesn't exist)
	return templateWidgets.filter((w) => {
		const rule = rulesByType.get(w.widget_type) ?? null;
		return evaluateTagRule(rule, userTags);
	});
}

/**
 * Instantiate a dashboard template for a user:
 * 1. Creates a user_profile (if none exists)
 * 2. Creates a user_dashboard_layout
 * 3. Creates user_widget_instances for each surviving widget
 *
 * Returns the created profile ID and layout ID, or null if the template has no widgets.
 */
export async function instantiateDashboardFromTemplate(
	db: Database,
	userId: string,
	template: TemplateRecord,
	userTags: string[]
): Promise<{ profileId: string; layoutId: string; widgetCount: number } | null> {
	const rawWidgets = Array.isArray(template.defaultWidgets) ? template.defaultWidgets : [];

	// Widget-level tag gating — skip widgets the user shouldn't see
	const widgets = await filterTemplateWidgets(db, rawWidgets, userTags);

	const now = new Date().toISOString();

	// Check if user already has an active profile (don't create duplicates)
	let profileId: string;
	const existingProfile = await db.query.userProfiles.findFirst({
		where: and(eq(userProfiles.user, userId), eq(userProfiles.isActive, true)),
		columns: { id: true }
	});

	if (existingProfile) {
		profileId = existingProfile.id;
	} else {
		// Create default profile
		profileId = generateId();
		await db.insert(userProfiles).values({
			id: profileId,
			user: userId,
			profileName: 'Default',
			profileType: 'personal',
			isActive: true,
			created: now,
			updated: now
		});
	}

	// Check if profile already has an active layout (don't overwrite)
	let layoutId: string;
	let isExistingLayout = false;
	const existingLayout = await db.query.userDashboardLayouts.findFirst({
		where: and(
			eq(userDashboardLayouts.user, userId),
			eq(userDashboardLayouts.profile, profileId),
			eq(userDashboardLayouts.isActive, true)
		),
		columns: { id: true }
	});

	if (existingLayout) {
		layoutId = existingLayout.id;
		isExistingLayout = true;
		log.info('existing_layout_found', { userId, layoutId });
	} else {
		layoutId = generateId();
		await db.insert(userDashboardLayouts).values({
			id: layoutId,
			user: userId,
			profile: profileId,
			layoutName: template.name,
			isActive: true,
			created: now,
			updated: now
		});
	}

	// If layout already has widgets, skip — don't duplicate
	if (isExistingLayout) {
		const existingWidgets = await db
			.select({ id: userWidgetInstances.id })
			.from(userWidgetInstances)
			.where(
				and(eq(userWidgetInstances.dashboard, layoutId), eq(userWidgetInstances.user, userId))
			);
		if (existingWidgets.length > 0) {
			log.info('skipping_widget_creation', {
				userId,
				layoutId,
				existingCount: existingWidgets.length
			});
			return { profileId, layoutId, widgetCount: existingWidgets.length };
		}
	}

	// Create widget instances
	let created = 0;
	for (const w of widgets) {
		await db.insert(userWidgetInstances).values({
			id: generateId(),
			dashboard: layoutId,
			user: userId,
			widgetType: w.widget_type,
			widgetTitle: w.widget_title,
			position: w.position,
			customConfig: w.default_config ?? {},
			visualConfig: w.visual_config,
			isVisible: true,
			createdByAi: false,
			created: now,
			updated: now
		});
		created++;
	}

	log.info('template_instantiated', {
		userId,
		templateId: template.id,
		templateName: template.name,
		profileId,
		layoutId,
		totalWidgets: rawWidgets.length,
		afterGating: created
	});

	return { profileId, layoutId, widgetCount: created };
}

// ============================================================================
// Active Profile + Layout Helper
// ============================================================================

interface ProfileRecord {
	id: string;
	profileName: string | null;
	profileType: string | null;
	themePreset: string | null;
	themeMode: string | null;
	profileColor: string | null;
}

interface LayoutRecord {
	id: string;
	layoutName: string | null;
}

export interface ActiveDashboard {
	profile: ProfileRecord;
	layout: LayoutRecord;
}

/**
 * Fetch the user's active profile and its active layout.
 * Throws if no active profile or layout exists (caller decides how to handle).
 */
export async function getActiveProfileAndLayout(
	db: Database,
	userId: string
): Promise<ActiveDashboard> {
	const profile = await db.query.userProfiles.findFirst({
		where: and(eq(userProfiles.user, userId), eq(userProfiles.isActive, true)),
		columns: {
			id: true,
			profileName: true,
			profileType: true,
			themePreset: true,
			themeMode: true,
			profileColor: true
		}
	});

	if (!profile) throw new Error('No active profile found');

	const layout = await db.query.userDashboardLayouts.findFirst({
		where: and(
			eq(userDashboardLayouts.user, userId),
			eq(userDashboardLayouts.profile, profile.id),
			eq(userDashboardLayouts.isActive, true)
		),
		columns: {
			id: true,
			layoutName: true
		}
	});

	if (!layout) throw new Error('No active layout found');

	return { profile, layout };
}

// ============================================================================
// Widget Instance Types (shared between tools + summary)
// ============================================================================

export interface WidgetInstanceRecord {
	id: string;
	user: string | null;
	widgetType: string | null;
	widgetTitle: string | null;
	position: { order: number; size: string } | null;
	customConfig: Record<string, unknown> | null;
	visualConfig: Record<string, unknown> | null;
	isVisible: boolean | null;
}

export interface CatalogWidgetWithDesc {
	widgetType: string | null;
	name: string | null;
	description: string | null;
}

/**
 * Build a text summary of the user's dashboard for AI context.
 * Includes template info, widget types, titles, and descriptions from catalog.
 */
export async function buildDashboardSummary(db: Database, userId: string): Promise<string> {
	try {
		const { layout } = await getActiveProfileAndLayout(db, userId);

		const widgets = (await db
			.select()
			.from(userWidgetInstances)
			.where(
				and(
					eq(userWidgetInstances.dashboard, layout.id),
					eq(userWidgetInstances.user, userId),
					eq(userWidgetInstances.isVisible, true)
				)
			)
			.orderBy(asc(userWidgetInstances.created))) as WidgetInstanceRecord[];

		if (widgets.length === 0) return 'User has an empty dashboard with no widgets.';

		// Fetch catalog descriptions for these widget types
		const types = [...new Set(widgets.map((w) => w.widgetType).filter(Boolean))] as string[];
		if (types.length === 0) return 'User has an empty dashboard with no widgets.';

		const catalogWidgets = await db
			.select({
				widgetType: dashboardWidgets.widgetType,
				name: dashboardWidgets.name,
				description: dashboardWidgets.description
			})
			.from(dashboardWidgets)
			.where(inArray(dashboardWidgets.widgetType, types));

		const descByType = new Map<string, string>();
		for (const cw of catalogWidgets) {
			if (cw.description && cw.widgetType) descByType.set(cw.widgetType, cw.description);
		}

		const lines = widgets.map((w, i) => {
			const desc = descByType.get(w.widgetType ?? '') || '';
			const title = w.widgetTitle || w.widgetType || 'Unknown';
			return `${i + 1}. ${title} (${w.widgetType})${desc ? ` — ${desc}` : ''}`;
		});

		return [
			`Dashboard: ${layout.layoutName || 'Default'}`,
			`Widgets (${widgets.length}):`,
			...lines
		].join('\n');
	} catch {
		return 'No dashboard configured yet.';
	}
}
