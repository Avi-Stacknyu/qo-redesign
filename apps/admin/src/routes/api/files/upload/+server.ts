import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * File Upload API with SSE Progress
 * Uses the FILE_SERVICE entrypoint directly for file operations
 * Returns Server-Sent Events for real-time progress
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!platform?.env?.FILE_SERVICE) {
		throw error(500, 'File service not available');
	}

	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, 'User not authenticated');
	}

	const contentType = request.headers.get('content-type');
	if (!contentType?.includes('multipart/form-data')) {
		throw error(400, 'Content-Type must be multipart/form-data');
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const chatId = formData.get('chatId') as string | undefined;

	if (!file || typeof file === 'string') {
		throw error(400, 'File is required');
	}

	// Validate file size (10MB limit)
	if (file.size > 10 * 1024 * 1024) {
		throw error(400, 'File too large (max 10MB)');
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const sendEvent = (type: string, data: Record<string, unknown>) => {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type, ...data, ts: Date.now() })}\n\n`)
				);
			};

			try {
				// Step 1: Starting upload
				sendEvent('progress', {
					step: 'uploading',
					message: `Uploading ${file.name}...`,
					progress: 10
				});

				const fileBuffer = await file.arrayBuffer();

				// Step 2: Processing
				sendEvent('progress', {
					step: 'processing',
					message: 'Processing file...',
					progress: 30
				});

				// Call the FILE_SERVICE entrypoint directly
				const result = await platform.env.FILE_SERVICE.uploadFileBuffer({
					fileBuffer,
					fileName: file.name,
					fileType: file.type,
					lastModified: file.lastModified,
					userId,
					chatId: chatId || undefined,
					shareWithAgent: true
				});

				// Step 3: Complete (result is UploadResult with id, name, path, type, size, processingId)
				sendEvent('progress', {
					step: 'indexing',
					message: 'File uploaded, processing in background...',
					progress: 90
				});

				// Step 4: Complete
				sendEvent('complete', {
					file: {
						id: result.id,
						name: result.name,
						path: result.path,
						type: result.type,
						size: result.size,
						processingId: result.processingId
					},
					progress: 100
				});

				controller.close();
			} catch (err) {
				console.error('[File Upload API] Error:', err);
				sendEvent('error', {
					message: err instanceof Error ? err.message : 'Upload failed'
				});
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
