/**
 * Bookmarks remote — CRUD for bookmarks + server-side URL unfurling.
 * Uses dedicated user_bookmarks table for proper indexing and querying.
 */

import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { generateId } from '@repo/db/id';
import { userBookmarks } from '@repo/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import z from 'zod/v4';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UnfurlResult {
	title: string;
	description: string;
	favicon: string;
	image: string;
	domain: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const loadBookmarks = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) return [];

	return locals.db
		.select()
		.from(userBookmarks)
		.where(eq(userBookmarks.user, locals.user.id))
		.orderBy(desc(userBookmarks.created));
});

/** Server-side URL unfurling — fetches page metadata. */
async function unfurl(url: string): Promise<UnfurlResult> {
	const parsed = new URL(url);
	const domain = parsed.hostname.replace(/^www\./, '');

	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'QuantOrion/2.0 (Link Preview)' },
			signal: AbortSignal.timeout(5000)
		});
		const html = await res.text();

		const getTag = (pattern: RegExp): string => {
			const match = html.match(pattern);
			return match?.[1]?.trim() ?? '';
		};

		const title =
			getTag(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/) ||
			getTag(/<meta[^>]+name="title"[^>]+content="([^"]*)"/) ||
			getTag(/<title[^>]*>([^<]*)<\/title>/);

		const description =
			getTag(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/) ||
			getTag(/<meta[^>]+name="description"[^>]+content="([^"]*)">/);

		let image =
			getTag(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/) ||
			getTag(/<meta[^>]+name="twitter:image"[^>]+content="([^"]*)">/);
		if (image && !image.startsWith('http')) {
			image = new URL(image, url).href;
		}

		let favicon =
			getTag(/<link[^>]+rel="(?:shortcut )?icon"[^>]+href="([^"]*)"/) ||
			getTag(/<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]*)">/);
		if (favicon && !favicon.startsWith('http')) {
			favicon = new URL(favicon, url).href;
		}
		if (!favicon) {
			favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
		}

		return {
			title: title || domain,
			description: description || '',
			favicon,
			image: image || '',
			domain
		} satisfies UnfurlResult;
	} catch {
		return {
			title: domain,
			description: '',
			favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
			image: '',
			domain
		} satisfies UnfurlResult;
	}
}

// ── Commands ─────────────────────────────────────────────────────────────────

const unfurlUrlSchema = z.object({
	url: z.url()
});

/** Client-callable unfurl — used for preview before adding a bookmark. */
export const unfurlUrl = command(unfurlUrlSchema, async (data) => {
	return unfurl(data.url);
});

const addBookmarkSchema = z.object({
	url: z.url(),
	title: z.string().optional(),
	description: z.string().optional(),
	favicon: z.string().optional(),
	image: z.string().optional(),
	domain: z.string().optional(),
	category: z.string().optional()
});

export const addBookmark = command(addBookmarkSchema, async (data) => {
	const { db, userId } = getDbAndUser();
	const now = new Date().toISOString();

	const meta = data.title ? data : { ...data, ...(await unfurl(data.url)) };

	const [result] = await db
		.insert(userBookmarks)
		.values({
			id: generateId(),
			user: userId,
			url: data.url,
			title: meta.title || data.url,
			description: meta.description ?? '',
			favicon: meta.favicon ?? '',
			image: meta.image ?? '',
			domain: meta.domain ?? '',
			category: data.category ?? '',
			created: now,
			updated: now
		})
		.returning();

	loadBookmarks().refresh();
	return result;
});

const removeBookmarkSchema = z.object({
	bookmarkId: z.string().min(1)
});

export const removeBookmark = command(removeBookmarkSchema, async (data) => {
	const { db, userId } = getDbAndUser();

	await db
		.delete(userBookmarks)
		.where(and(eq(userBookmarks.id, data.bookmarkId), eq(userBookmarks.user, userId)));

	loadBookmarks().refresh();
	return { deleted: true };
});
