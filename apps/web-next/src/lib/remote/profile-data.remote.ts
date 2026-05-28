/**
 * Profile data remote — structured profile sections, field CRUD, and markdown download.
 * Reads from PROFILE_SECTION graph nodes (profiler system).
 * Merges global profile schema to show empty placeholder fields.
 */

import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { findProfileField, sameProfileField, type ProfileSections } from '@repo/shared/utils';
import z from 'zod/v4';

import type { ProfileData, ProfileField, ProfileSection } from '$lib/data/profile-types';
import { MemoryGraphService } from '@repo/db/graph';
import type { ProfileSchemaSection } from '@repo/db/graph/types';
import { userProfileSummaries } from '@repo/db/schema';
import { eq, desc } from 'drizzle-orm';

type ProfileNode = Awaited<ReturnType<MemoryGraphService['getProfile']>>[number];
type GraphFieldValue = {
	value: string | number | boolean | string[];
	label: string;
	confidence: number;
	source: 'onboarding' | 'chat' | 'user_edit';
	isSchema: boolean;
	updatedAt: string;
};
type GraphSectionData = {
	label: string;
	icon: string;
	order: number;
	fields: Record<string, GraphFieldValue>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireAuth() {
	const { platform, locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.db) throw error(503, 'Database unavailable');
	return {
		platform,
		userId: locals.user.id,
		graph: new MemoryGraphService(locals.db, locals.user.id),
		db: locals.db
	};
}

/**
 * Load the active profile schema visible to the current user via worker RPC.
 */
async function loadMergedSchema(
	platform: App.Platform,
	userId: string
): Promise<ProfileSchemaSection[]> {
	try {
		const worker = platform.env.CF_WORKER;
		if (!worker) return [];
		const { sections } = await worker.getProfilerSchemas({ userId });
		return sections;
	} catch {
		return [];
	}
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Fetch PROFILE_SECTION nodes merged with profiler schemas for complete view. */
export const loadStructuredProfile = query(async (): Promise<ProfileData> => {
	const { platform, locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Unauthorized');

	const empty: ProfileData = {
		sections: [],
		overallCompletion: 0,
		totalFields: 0,
		filledFields: 0,
		lastUpdated: null
	};
	if (!locals.db) return empty;

	const graph = new MemoryGraphService(locals.db, locals.user.id);

	// Load graph nodes and profiler schemas in parallel
	const [nodes, mergedSchema] = await Promise.all([
		graph.getProfile(),
		loadMergedSchema(platform!, locals.user.id)
	]);

	// Build a map of graph section data keyed by sectionId
	const graphMap = new Map<string, GraphSectionData>();
	const profileSections: ProfileSections = {};

	for (const node of nodes as ProfileNode[]) {
		const sectionId = (node.id as string).split('::').pop()!;
		const sectionData = node.data as GraphSectionData;
		graphMap.set(sectionId, sectionData);
		profileSections[sectionId] = { fields: sectionData.fields ?? {} };
	}

	let totalSchemaFields = 0;
	let filledSchemaFields = 0;
	let totalFilledFields = 0;
	let latestUpdate: string | null = null;
	let totalFieldCount = 0;

	// Track which sectionIds we've already processed (to avoid duplicates)
	const processedSections = new Set<string>();

	const sections: ProfileSection[] = [];

	// 1. Process schema sections first (ensures they show even when empty)
	const consumedFields = new Set<string>();
	for (const schemaSection of mergedSchema) {
		processedSections.add(schemaSection.section_id);
		const graphData = graphMap.get(schemaSection.section_id);
		const graphFields = graphData?.fields ?? {};

		const fields: ProfileField[] = [];

		// Add schema fields (with placeholders for empty ones)
		for (const sf of schemaSection.fields) {
			const existingMatch = findProfileField(profileSections, schemaSection.section_id, sf.key);
			if (existingMatch) {
				const existing = existingMatch.field as GraphFieldValue;
				consumedFields.add(`${existingMatch.sectionId}:${existingMatch.key}`);
				if (existing.updatedAt && (!latestUpdate || existing.updatedAt > latestUpdate)) {
					latestUpdate = existing.updatedAt;
				}
				fields.push({
					key: sf.key,
					...existing,
					value: String(existing.value ?? ''),
					isSchema: true
				});
			} else {
				// Empty placeholder for unfilled schema field
				fields.push({
					key: sf.key,
					value: '',
					label: sf.label,
					confidence: 0,
					source: 'chat',
					isSchema: true,
					updatedAt: ''
				});
			}
		}

		// Add discovered fields (in graph but not in schema)
		for (const [key, fv] of Object.entries(graphFields)) {
			if (consumedFields.has(`${schemaSection.section_id}:${key}`)) continue;
			if (schemaSection.fields.some((field) => sameProfileField(field.key, key))) continue;
			if (fv.updatedAt && (!latestUpdate || fv.updatedAt > latestUpdate)) {
				latestUpdate = fv.updatedAt;
			}
			fields.push({ key, ...fv, value: String(fv.value ?? ''), isSchema: false });
		}

		totalFieldCount += fields.length;
		totalFilledFields += fields.filter((f) => f.value.trim() !== '').length;
		const schemaFields = fields.filter((f) => f.isSchema);
		const schemaFilled = schemaFields.filter((f) => f.value.trim() !== '');
		totalSchemaFields += schemaFields.length;
		filledSchemaFields += schemaFilled.length;

		sections.push({
			sectionId: schemaSection.section_id,
			label: graphData?.label || schemaSection.label,
			icon: graphData?.icon || schemaSection.icon,
			order: graphData?.order ?? schemaSection.order,
			fields,
			schemaFieldCount: schemaFields.length,
			filledSchemaCount: schemaFilled.length,
			completionPct:
				schemaFields.length > 0
					? Math.round((schemaFilled.length / schemaFields.length) * 100)
					: 100
		});
	}

	// 2. Add discovered sections (in graph but not in any schema)
	for (const [sectionId, data] of graphMap) {
		if (processedSections.has(sectionId)) continue;
		if (!sectionId || sectionId === 'undefined') continue;

		const fields: ProfileField[] = Object.entries(data.fields ?? {})
			.filter(([key]) => !consumedFields.has(`${sectionId}:${key}`))
			.map(([key, fv]) => {
				if (fv.updatedAt && (!latestUpdate || fv.updatedAt > latestUpdate)) {
					latestUpdate = fv.updatedAt;
				}
				return { key, ...fv, value: String(fv.value ?? '') };
			});
		if (fields.length === 0) continue;

		fields.sort((a, b) => a.label.localeCompare(b.label));
		totalFieldCount += fields.length;
		totalFilledFields += fields.filter((f) => f.value.trim() !== '').length;

		sections.push({
			sectionId,
			label: data.label || sectionId,
			icon: data.icon || 'layers',
			order: data.order ?? 99,
			fields,
			schemaFieldCount: 0,
			filledSchemaCount: 0,
			completionPct: 100
		});
	}

	sections.sort((a, b) => a.order - b.order || a.sectionId.localeCompare(b.sectionId));

	return {
		sections,
		overallCompletion:
			totalFieldCount > 0 ? Math.round((totalFilledFields / totalFieldCount) * 100) : 0,
		totalFields: totalFieldCount,
		filledFields: totalFilledFields,
		lastUpdated: latestUpdate
	};
});

/** Compile profile into downloadable markdown (includes schema placeholders). */
export const downloadProfileMarkdown = query(async (): Promise<string> => {
	const { platform, graph, userId } = requireAuth();
	const mergedSchema = await loadMergedSchema(platform!, userId);
	return graph.compileProfileMarkdown(mergedSchema.length > 0 ? mergedSchema : undefined);
});

/** AI-generated profile summary (same as admin sees). Read from DB cache. */
export const loadProfileSummary = query(async () => {
	const { db, userId } = requireAuth();
	const [row] = await db
		.select()
		.from(userProfileSummaries)
		.where(eq(userProfileSummaries.user, userId))
		.orderBy(desc(userProfileSummaries.generatedAt))
		.limit(1);

	if (row?.summaryText) {
		return {
			summary: row.summaryText,
			generatedAt: row.generatedAt ?? new Date().toISOString(),
			fromCache: true
		};
	}
	return {
		summary: 'No profile summary generated yet. Chat with the assistant to build your profile.',
		generatedAt: new Date().toISOString(),
		fromCache: false
	};
});

// ── Commands ─────────────────────────────────────────────────────────────────

/** Update a single profile field value. */
export const updateProfileField = command(
	z.object({
		sectionId: z.string().min(1),
		fieldKey: z.string().min(1),
		value: z.string().max(2000)
	}),
	async ({ sectionId, fieldKey, value }) => {
		const { graph, userId } = requireAuth();

		// Read existing field to preserve metadata (isSchema, label)
		const nodes = await graph.getProfile();
		const sectionNode = nodes.find((n: ProfileNode) => n.id === `profile::${userId}::${sectionId}`);
		const existingFields = (sectionNode?.data as { fields?: Record<string, any> })?.fields ?? {};
		const existing = existingFields[fieldKey];

		await graph.upsertProfileField(userId, sectionId, fieldKey, {
			value,
			label: existing?.label ?? fieldKey,
			confidence: 1,
			source: 'user_edit',
			isSchema: existing?.isSchema ?? false,
			updatedAt: new Date().toISOString()
		});

		loadStructuredProfile().refresh();
	}
);

/** Delete a single profile field. */
export const deleteProfileField = command(
	z.object({
		sectionId: z.string().min(1),
		fieldKey: z.string().min(1)
	}),
	async ({ sectionId, fieldKey }) => {
		const { graph } = requireAuth();
		await graph.deleteProfileField(sectionId, fieldKey);

		loadStructuredProfile().refresh();
	}
);
