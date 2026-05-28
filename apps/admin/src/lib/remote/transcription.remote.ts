import { command, getRequestEvent } from '$app/server';
import { z } from 'zod';

/**
 * Transcribe audio to text using Cloudflare Whisper via CF Worker RPC
 * Supports audio recorded from browser MediaRecorder (webm/opus)
 */
export const transcribeAudio = command(
	z.object({
		/** Base64 encoded audio data */
		audioBase64: z.string(),
		/** Audio duration in milliseconds (for accurate cost calculation) */
		audioDurationMs: z.number().optional()
	}),
	async ({ audioBase64, audioDurationMs }): Promise<{ text: string; vtt?: string }> => {
		const { locals, platform } = getRequestEvent();
		const userId = locals.user?.id;

		if (!userId) {
			throw new Error('Not authenticated');
		}

		const worker = platform?.env?.CF_WORKER;
		if (!worker) {
			throw new Error('Transcription service not available');
		}

		try {
			const result = await worker.transcribeAudio({
				userId,
				audioBase64,
				audioDurationMs
			});

			return {
				text: result.text,
				vtt: result.vtt
			};
		} catch (error) {
			throw new Error(error instanceof Error ? error.message : 'Failed to transcribe audio');
		}
	}
);
