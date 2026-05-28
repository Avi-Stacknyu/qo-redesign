/**
 * Widget data remote — queries for widgets that don't have their own remote file.
 * Covers: recent chats, profile summary, resolved data sources.
 * Todos, reminders, bookmarks, and news have dedicated remote files.
 */

import { query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { chats, aiAgents, userProfileSummaries } from '@repo/db/schema';
import { and, eq, ne, desc } from 'drizzle-orm';
import z from 'zod/v4';
import type { DataSourceRef, DataSourceCatalogItem, ResolvedData } from '@repo/shared/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

// ── Recent Chats Data ────────────────────────────────────────────────────────

export const loadRecentChats = query(async () => {
	const { db, userId } = getDbAndUser();

	const rows = await db
		.select({
			id: chats.id,
			title: chats.title,
			source: chats.source,
			created: chats.created,
			updated: chats.updated,
			agentId: chats.agent,
			agentName: aiAgents.name,
			agentAvatar: aiAgents.avatar
		})
		.from(chats)
		.leftJoin(aiAgents, eq(chats.agent, aiAgents.id))
		.where(
			and(eq(chats.user, userId), ne(chats.source, 'admin_test'), ne(chats.source, 'discovery'))
		)
		.orderBy(desc(chats.updated))
		.limit(10);

	return rows;
});

// ── Profile Summary Data ────────────────────────────────────────────────────

export const loadProfileSummary = query(async () => {
	const { db, userId } = getDbAndUser();

	const [record] = await db
		.select()
		.from(userProfileSummaries)
		.where(eq(userProfileSummaries.user, userId))
		.orderBy(desc(userProfileSummaries.updated))
		.limit(1);

	return record ?? null;
});

// ── Widget Data Resolver ─────────────────────────────────────────────────────

const dataSourceRefSchema = z.object({
	type: z.string(),
	source_id: z.string(),
	params: z.record(z.string(), z.unknown()).optional()
});

/** Resolve a DataSourceRef to tabular data via worker RPC. */
export const loadWidgetData = query(dataSourceRefSchema, async (ref) => {
	const { locals, platform } = getRequestEvent();
	if (!locals.user) throw error(401, 'Unauthorized');

	const worker = platform?.env?.CF_WORKER;
	if (!worker) return null;

	const result = await worker.resolveWidgetData({
		userId: locals.user.id,
		dataSourceRef: ref
	});
	return result.data as ResolvedData | null;
});

// ── Data Sources Catalog ─────────────────────────────────────────────────────

/** Fetch all data sources the current user can reference (admin + user-owned). */
export const loadDataSourcesCatalog = query(async () => {
	const { locals, platform } = getRequestEvent();
	if (!locals.user) throw error(401, 'Unauthorized');

	const worker = platform?.env?.CF_WORKER;
	if (!worker) return [] as DataSourceCatalogItem[];

	const result = await worker.getAvailableDataSources({ userId: locals.user.id });
	return result.sources as DataSourceCatalogItem[];
});
