import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userUploads } from '@repo/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Admin file download endpoint
 * Allows admins to download any user's files for debugging/support purposes
 */
export const GET: RequestHandler = async ({ params, locals, platform, url }) => {
	const { db, user } = locals;

	// Verify admin is authenticated
	if (!user || !db) {
		throw error(401, 'Unauthorized');
	}

	const fileId = params.fileId;
	if (!fileId) {
		throw error(400, 'File ID is required');
	}

	// Check if viewing inline or downloading
	const inline = url.searchParams.get('view') === 'true';

	try {
		// Get file record - admins can access any file
		const fileRecord = await db
			.select()
			.from(userUploads)
			.where(eq(userUploads.id, fileId))
			.then((rows) => rows[0]);

		if (!fileRecord) {
			throw error(404, 'File not found');
		}

		// Check if path exists
		if (!fileRecord.path) {
			throw error(404, 'File path not set in database');
		}

		// Get file from R2 bucket
		const bucket = platform?.env?.DOCUMENTS_BUCKET;
		if (!bucket) {
			throw error(500, 'Storage not available');
		}

		// The path field contains the R2 key (e.g., uploads/userId/fileId_filename.ext)
		const r2Key = fileRecord.path;
		const r2Object = await bucket.get(r2Key);

		if (!r2Object) {
			// File exists in database but not in R2 storage
			console.warn(`[AdminFileDownload] File not found in R2: ${r2Key}`);
			throw error(404, 'File no longer exists in storage');
		}

		const contentType =
			r2Object.httpMetadata?.contentType || fileRecord.type || 'application/octet-stream';
		const fileName = fileRecord.name || 'file';

		// Content-Disposition: attachment for download, inline for viewing
		const disposition = inline
			? 'inline'
			: `attachment; filename="${encodeURIComponent(fileName)}"`;

		// Return file response
		return new Response(r2Object.body, {
			headers: {
				'Content-Type': contentType,
				'Content-Disposition': disposition,
				'Content-Length': String(r2Object.size),
				'Cache-Control': 'private, max-age=3600'
			}
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Error downloading file:', err);
		throw error(500, 'Failed to download file');
	}
};
