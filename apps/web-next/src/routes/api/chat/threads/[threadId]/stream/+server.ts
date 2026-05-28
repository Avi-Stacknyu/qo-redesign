/**
 * Chat Stream Endpoint (Auth Gateway + Pass-through Proxy)
 *
 * Validates user auth, then calls the QuantPMAgent DO directly via RPC.
 * All message persistence (user + assistant messages) is handled by the DO.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface RequestBody {
	message?: string;
	agentId: string;
	attachments?: Array<{
		id: string;
		name: string;
		type: string;
		size: number;
	}>;
	/** Tool results from HIL tools (sent by sendAutomaticallyWhen after addToolOutput) */
	toolResults?: Array<{
		toolCallId: string;
		toolName: string;
		args: unknown;
		output: unknown;
	}>;
	/** The assistant message text before tool calls (for tool result resends) */
	assistantText?: string;
	/** The client-side assistant message ID to reuse for tool result resend responses */
	respondMessageId?: string;
	/** Per-chat model override (PB record ID from ai_agent_models) */
	modelOverrideId?: string;
}

export const POST: RequestHandler = async ({ request, params, locals, platform }) => {
	const chatId = params.threadId;
	if (!chatId) throw error(400, 'Missing threadId');

	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const {
		message,
		agentId,
		attachments = [],
		toolResults,
		assistantText,
		respondMessageId,
		modelOverrideId
	}: RequestBody = await request.json();

	// Either a user message or tool results must be provided
	if (!message?.trim() && (!toolResults || toolResults.length === 0)) {
		throw error(400, 'Message or toolResults is required');
	}
	if (!agentId) throw error(400, 'agentId is required');

	const quantAgent = platform?.env?.QUANT_AGENT;
	if (!quantAgent) {
		console.warn('[Chat Stream] QUANT_AGENT DO binding not available');
		throw error(503, 'Agent service unavailable');
	}

	// Extract CF headers for attribute resolution (geo, language, etc.)
	const cfHeaders: Record<string, string> = {};
	for (const [key, value] of request.headers.entries()) {
		const lowerKey = key.toLowerCase();
		if (lowerKey.startsWith('cf-') || lowerKey === 'accept-language') {
			cfHeaders[lowerKey] = value;
		}
	}

	try {
		// Call QuantPMAgent DO directly via RPC (no worker middleman)
		const id = quantAgent.idFromName(chatId);
		const stub = quantAgent.get(id);
		const doResponse = await stub.chat({
			message: (message ?? '').trim(),
			userId,
			chatId,
			agentId,
			attachedFiles: attachments.map((f) => ({
				id: f.id,
				name: f.name,
				type: f.type,
				size: f.size
			})),
			cfHeaders,
			toolResults,
			assistantText,
			respondMessageId,
			modelOverrideId
		});

		if (!doResponse.body) {
			throw error(502, 'Empty response from agent');
		}

		// Pass through the native AI SDK UI Message Stream
		return new Response(doResponse.body, {
			headers: Object.fromEntries(doResponse.headers)
		});
	} catch (err) {
		console.error('[Chat Stream] Error:', err);
		if (err instanceof Error && 'status' in err) throw err;
		throw error(500, 'Failed to process message');
	}
};
