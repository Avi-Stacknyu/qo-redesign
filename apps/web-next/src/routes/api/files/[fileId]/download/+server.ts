/**
 * File Download Endpoint — verifies ownership, fetches from R2, streams back to client.
 */
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { userUploads } from '@repo/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform, url }) => {
	const { fileId } = params;
	if (!fileId) throw error(400, 'Missing fileId');
	if (!locals.user) throw error(401, 'Unauthorized');

	// Verify the file belongs to the requesting user
	const [fileRecord] = await locals.db
		.select()
		.from(userUploads)
		.where(eq(userUploads.id, fileId))
		.limit(1);
	if (!fileRecord) throw error(404, 'File not found');
	if (fileRecord.user !== locals.user.id) throw error(403, 'Access denied');
	if (!fileRecord.path) throw error(404, 'File path not set');

	const bucket = platform?.env?.DOCUMENTS_BUCKET;
	if (!bucket) throw error(503, 'Storage not available');

	const r2Object = await bucket.get(fileRecord.path);
	if (!r2Object) throw error(404, 'File no longer exists in storage');

	const contentType =
		r2Object.httpMetadata?.contentType || fileRecord.type || 'application/octet-stream';
	const fileName = fileRecord.name || 'file';
	const inline = url.searchParams.get('view') === 'true';
	const disposition = inline ? 'inline' : `attachment; filename="${encodeURIComponent(fileName)}"`;

	return new Response(r2Object.body, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': disposition,
			'Content-Length': String(r2Object.size),
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
