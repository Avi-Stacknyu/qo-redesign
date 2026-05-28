/**
 * Playground Chat Stream Endpoint (Auth Gateway + Pass-through Proxy)
 *
 * Validates admin auth, then calls the QuantPMAgent DO directly via RPC.
 * All message persistence (user + assistant messages) is handled by the DO.
 * Debug data is recorded by the DO and fetched afterwards via database queries.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiAgents } from '@repo/db/schema';
import { eq } from 'drizzle-orm';

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
	/** Optional model override — PB record ID from ai_agent_models */
	modelOverrideId?: string;
}

export const POST: RequestHandler = async ({ request, params, locals, platform }) => {
	const chatId = params.chatId;
	if (!chatId) throw error(400, 'Missing chatId');

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
		console.warn('[Playground Stream] QUANT_AGENT DO binding not available');
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
		// Get agent status for development mode support
		const [agent] = await locals.db.select().from(aiAgents).where(eq(aiAgents.id, agentId));
		const agentStatus =
			agent?.status === 'active' || agent?.status === 'inactive' || agent?.status === 'development'
				? agent.status
				: 'development';

		// Call QuantPMAgent DO directly via RPC (no worker middleman)
		const doId = quantAgent.idFromName(chatId);
		const stub = quantAgent.get(doId);
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
			agentStatus,
			modelOverrideId
		});

		if (!doResponse.body) {
			throw error(502, 'Empty response from agent');
		}

		// Pass through the native AI SDK data stream
		return new Response(doResponse.body, {
			headers: Object.fromEntries(doResponse.headers)
		});
	} catch (err) {
		console.error('[Playground Stream] Error:', err);
		if (err instanceof Error && 'status' in err) throw err;
		throw error(500, 'Failed to process message');
	}
};
