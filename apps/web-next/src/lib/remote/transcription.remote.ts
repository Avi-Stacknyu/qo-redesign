/**
 * Transcription Remote — audio-to-text via CF Worker Whisper RPC.
 */
import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import z from 'zod/v4';

export const transcribeAudio = command(
	z.object({
		audioBase64: z.string(),
		audioDurationMs: z.number().optional(),
		chatId: z.string().optional()
	}),
	async ({ audioBase64, audioDurationMs, chatId }): Promise<{ text: string; vtt?: string }> => {
		const { locals, platform } = getRequestEvent();
		if (!locals.user) throw error(401, 'Unauthorized');

		const worker = platform?.env?.CF_WORKER;
		if (!worker) throw error(503, 'Transcription service not available');

		const result = await worker.transcribeAudio({
			userId: locals.user.id,
			audioBase64,
			audioDurationMs,
			chatId
		});

		return { text: result.text, vtt: result.vtt };
	}
);
