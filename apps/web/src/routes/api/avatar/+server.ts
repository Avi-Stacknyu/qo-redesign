import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { users } from '@repo/db/schema';
import type { RequestHandler } from './$types';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');

	const [row] = await locals.db
		.select({ avatar: users.avatar })
		.from(users)
		.where(eq(users.id, locals.user.id))
		.limit(1);

	if (!row?.avatar) throw error(404, 'Avatar not found');

	if (row.avatar.startsWith('http')) {
		return Response.redirect(row.avatar, 302);
	}

	const bucket = platform?.env?.DOCUMENTS_BUCKET;
	if (!bucket) throw error(503, 'Storage not available');

	const key = row.avatar.startsWith('assets/') ? row.avatar : `avatars/${row.avatar}`;
	const r2Object = await bucket.get(key);
	if (!r2Object) throw error(404, 'Avatar no longer exists in storage');

	return new Response(r2Object.body, {
		headers: {
			'Content-Type': r2Object.httpMetadata?.contentType || 'application/octet-stream',
			'Content-Length': String(r2Object.size),
			'Cache-Control': 'private, max-age=300'
		}
	});
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');

	const formData = await request.formData();
	const file = formData.get('avatar') as File | null;

	if (!file || !(file instanceof File)) throw error(400, 'No file provided');
	if (!ALLOWED_TYPES.includes(file.type)) throw error(400, 'Invalid file type');
	if (file.size > MAX_SIZE) throw error(400, 'File too large (max 5MB)');

	const bucket = platform?.env?.DOCUMENTS_BUCKET;
	if (!bucket) throw error(503, 'Storage not available');

	const ext = file.name.split('.').pop() || 'jpg';
	const r2Key = `assets/avatars/users/${locals.user.id}/avatar.${ext}`;
	const buffer = await file.arrayBuffer();
	await bucket.put(r2Key, buffer, { httpMetadata: { contentType: file.type } });

	const avatarUrl = '/api/avatar';
	await locals.db
		.update(users)
		.set({ avatar: r2Key, updated: new Date().toISOString() })
		.where(eq(users.id, locals.user.id));

	return json({ avatar: avatarUrl });
};

export const DELETE: RequestHandler = async ({ locals, platform }) => {
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');

	// Remove from R2 (best-effort, may not exist)
	const bucket = platform?.env?.DOCUMENTS_BUCKET;
	if (bucket) {
		const [row] = await locals.db
			.select({ avatar: users.avatar })
			.from(users)
			.where(eq(users.id, locals.user.id))
			.limit(1);
		if (row?.avatar) {
			// Full R2 path (new) — use directly
			// HTTP URL (legacy PocketBase) — nothing to delete in R2
			// Plain filename (very old R2) — reconstruct key
			let key: string | null = null;
			if (row.avatar.startsWith('assets/')) {
				key = row.avatar;
			} else if (!row.avatar.startsWith('http')) {
				key = `avatars/${row.avatar}`;
			}
			if (key) await bucket.delete(key).catch(() => {});
		}
	}

	await locals.db
		.update(users)
		.set({ avatar: null, updated: new Date().toISOString() })
		.where(eq(users.id, locals.user.id));
	return json({ avatar: '' });
};
