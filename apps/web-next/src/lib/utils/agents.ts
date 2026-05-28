/**
 * Agent utilities — DTO mapping and helper types for AI agents.
 */

import { getPinnedModelInfo, type PinnedModelInfo } from '@repo/shared/utils';
import type { CompiledFlowConfig, FlowData } from '@repo/shared/types';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-20250514';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 8192;

/** Lightweight agent shape used by UI components (selectors, avatars, lists). */
export type AgentSummary = {
	id: string;
	name: string;
	description: string | null;
	avatar_url: string | null;
	pinnedModelInfo?: PinnedModelInfo | null;
};

export type AgentDTO = AgentSummary & {
	system_prompt: string;
	model: string;
	temperature: number;
	max_tokens: number;
	active: boolean;
	created_at: string;
	updated_at: string;
};

export type AgentRecord = {
	id: string;
	name: string;
	description: string;
	avatar?: string;
	status: string;
	created: string;
	updated: string;
	current_flow?: string;
	expand?: {
		current_flow?: {
			id: string;
			description?: string;
			system_promt?: string;
			compiled_config?: CompiledFlowConfig | null;
			flow_data?: FlowData | null;
		};
	};
};

type AgentParameters = {
	model?: string;
	temperature?: number | string;
	max_tokens?: number | string;
};

function getParameterNumber(value: unknown, fallback: number): number {
	if (typeof value === 'number' && !Number.isNaN(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number(value);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return fallback;
}

/** Map an agent record (with expanded current_flow) to a clean DTO. */
export function mapAgentRecord(agent: AgentRecord): AgentDTO {
	const config = agent.expand?.current_flow;
	const parameters = (config?.flow_data ?? {}) as AgentParameters;

	return {
		id: agent.id,
		name: agent.name ?? 'Untitled agent',
		description: config?.description ?? agent.description ?? null,
		avatar_url: agent.avatar ? `/api/agent-avatar/${agent.id}` : null,
		pinnedModelInfo: getPinnedModelInfo(config?.compiled_config, config?.flow_data),
		system_prompt: config?.system_promt ?? '',
		model: typeof parameters.model === 'string' ? parameters.model : DEFAULT_MODEL,
		temperature: getParameterNumber(parameters.temperature, DEFAULT_TEMPERATURE),
		max_tokens: getParameterNumber(parameters.max_tokens, DEFAULT_MAX_TOKENS),
		active: agent.status === 'active',
		created_at: agent.created ?? new Date().toISOString(),
		updated_at: agent.updated ?? agent.created ?? new Date().toISOString()
	};
}
