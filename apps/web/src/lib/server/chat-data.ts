/**
 * Shared chat page data loading — agent visibility, models, tier context.
 *
 * Consolidates the duplicated logic between chat/+page.server.ts and
 * chat/[threadId]/+page.server.ts into a single module.
 */

import { mapAgentRecord, type AgentRecord } from '$lib/utils/agents';
import {
	extractCfHeaders,
	getVisibleAgentsFromWorker,
	type VisibleAgent
} from '$lib/utils/agent-visibility';
import { getAvailableModels, type AvailableModel } from '$lib/remote/models.remote';
import { getUserCreditBalance } from '$lib/remote/chat-threads.remote';
import { eq, asc } from 'drizzle-orm';
import { aiAgents, aiAgentFlows, planPackages, planPackagesAllowedModels } from '@repo/db/schema';
import type { Database } from '@repo/db/client';
import type { PinnedModelInfo } from '@repo/shared/utils';

// ── Types ────────────────────────────────────────────────────────────────────

/** Agent shape returned to chat page components. */
export type ChatAgent = {
	id: string;
	name: string;
	description: string | null;
	avatar_url: string | null;
	pinnedModelInfo: PinnedModelInfo | null;
	system_prompt: string;
	model: string;
	temperature: number;
	max_tokens: number;
	active: boolean;
	created_at: string;
	updated_at: string;
};

export type TierContext = {
	allowedModelIds: string[];
	hasSubscription: boolean;
	creditBalance: number;
	planTitle?: string | null;
};

export type ChatPageData = {
	agents: ChatAgent[] | ReturnType<typeof mapAgentRecord>[];
	shelfAgentIds: string[];
	hasShelf: boolean;
	availableModels: AvailableModel[];
	tierContext: TierContext;
};

// ── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load agents, models, and tier context for any chat page.
 * Single call replaces the duplicated fetch logic in both chat page servers.
 */
export async function loadChatPageData(
	db: Database,
	userId: string,
	userPlan: string | null | undefined,
	platform: App.Platform | undefined,
	request: Request
): Promise<ChatPageData> {
	const cfHeaders = extractCfHeaders(request);

	const [visibilityResult, availableModels, creditData] = await Promise.all([
		getVisibleAgentsFromWorker(platform, userId, cfHeaders),
		getAvailableModels(),
		getUserCreditBalance()
	]);

	// Tier / plan data
	let allowedModelIds: string[] = [];
	let hasSubscription = false;
	let planTitle: string | null = null;
	if (userPlan) {
		const [plan, modelRows] = await Promise.all([
			db
				.select()
				.from(planPackages)
				.where(eq(planPackages.id, userPlan))
				.limit(1)
				.then((r) => r[0] ?? null),
			db
				.select({ targetId: planPackagesAllowedModels.targetId })
				.from(planPackagesAllowedModels)
				.where(eq(planPackagesAllowedModels.sourceId, userPlan))
		]);
		hasSubscription = plan?.isSubscription ?? false;
		planTitle = plan?.title ?? null;
		allowedModelIds = modelRows.map((r) => r.targetId);
	}

	const tierContext: TierContext = {
		allowedModelIds,
		hasSubscription,
		creditBalance: creditData.balance,
		planTitle
	};

	// Agent mapping
	const workerAvailable =
		visibilityResult.agents.length > 0 ||
		visibilityResult.hasShelf ||
		platform?.env?.CF_WORKER !== undefined;

	if (workerAvailable) {
		const agents: ChatAgent[] = visibilityResult.agents.map((a: VisibleAgent) => ({
			id: a.id,
			name: a.name,
			description: a.description,
			avatar_url: a.avatar_url ?? null,
			pinnedModelInfo: a.pinnedModelInfo,
			system_prompt: '',
			model: '',
			temperature: 0,
			max_tokens: 0,
			active: a.status === 'active',
			created_at: '',
			updated_at: ''
		}));

		return {
			agents,
			shelfAgentIds: visibilityResult.shelfAgentIds,
			hasShelf: visibilityResult.hasShelf,
			availableModels,
			tierContext
		};
	}

	// Fallback: direct Drizzle load (no visibility filtering, local dev)
	const rows = await db
		.select()
		.from(aiAgents)
		.leftJoin(aiAgentFlows, eq(aiAgents.currentFlow, aiAgentFlows.id))
		.where(eq(aiAgents.status, 'active'))
		.orderBy(asc(aiAgents.name));

	const agentRecords: AgentRecord[] = rows.map((r) => {
		const agent = r.ai_agents;
		const flow = r.ai_agent_flows;
		return {
			id: agent.id,
			name: agent.name ?? '',
			description: agent.description ?? '',
			avatar: agent.avatar ?? undefined,
			status: agent.status ?? 'inactive',
			created: agent.created ?? '',
			updated: agent.updated ?? '',
			current_flow: agent.currentFlow ?? undefined,
			expand: flow
				? {
						current_flow: {
							id: flow.id,
							description: flow.changeLog ?? undefined,
							system_promt: undefined,
							compiled_config: flow.compiledConfig as AgentRecord['expand'] extends {
								current_flow?: infer F;
							}
								? F extends { compiled_config?: infer C }
									? C
									: null
								: null,
							flow_data: flow.flowData as AgentRecord['expand'] extends {
								current_flow?: infer F;
							}
								? F extends { flow_data?: infer D }
									? D
									: null
								: null
						}
					}
				: undefined
		};
	});

	return {
		agents: agentRecords.map((r) => mapAgentRecord(r)),
		shelfAgentIds: [],
		hasShelf: false,
		availableModels,
		tierContext
	};
}
