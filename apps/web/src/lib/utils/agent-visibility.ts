/**
 * Agent Visibility — resolves which agents a user can see via CF Worker RPC.
 * Falls back to empty result when worker is unavailable (local dev).
 */

import type { PinnedModelInfo } from '@repo/shared/utils';

export type VisibleAgent = {
	id: string;
	name: string;
	display_name: string | null;
	description: string | null;
	icon: string | null;
	avatar_url: string | null;
	status: string;
	is_universal: boolean;
	pinnedModelInfo: PinnedModelInfo | null;
};

export type GetVisibleAgentsResult = {
	agents: VisibleAgent[];
	shelfAgentIds: string[];
	hasShelf: boolean;
};

const EMPTY_RESULT: GetVisibleAgentsResult = {
	agents: [],
	shelfAgentIds: [],
	hasShelf: false
};

/** Call CF_WORKER.getVisibleAgents RPC to get filtered agent list. */
export async function getVisibleAgentsFromWorker(
	platform: App.Platform | undefined,
	userId: string,
	cfHeaders: Record<string, string>
): Promise<GetVisibleAgentsResult> {
	const worker = platform?.env?.CF_WORKER;
	if (!worker) return EMPTY_RESULT;

	try {
		const result = await worker.getVisibleAgents({ userId, cfHeaders });
		return {
			agents: result.agents as VisibleAgent[],
			shelfAgentIds: result.shelfAgentIds,
			hasShelf: result.hasShelf
		};
	} catch (err) {
		console.error('[agent-visibility] RPC failed:', err);
		return EMPTY_RESULT;
	}
}

/** Extract CF-* and Accept-Language headers for geo/timezone resolution. */
export function extractCfHeaders(request: Request): Record<string, string> {
	const headers: Record<string, string> = {};
	for (const [key, value] of request.headers.entries()) {
		const lower = key.toLowerCase();
		if (lower.startsWith('cf-') || lower === 'accept-language') {
			headers[lower] = value;
		}
	}
	return headers;
}