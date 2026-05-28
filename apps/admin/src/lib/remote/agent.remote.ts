import { query, command, getRequestEvent } from '$app/server';
import { z } from 'zod';
import type { Node, Edge } from '@xyflow/svelte';
import type { ValidateAndCompileResult } from '@repo/shared/types';
import {
	aiAgents,
	aiAgentFlows,
	aiAgentModels,
	aiAgentModelsSupportedTools,
	aiProviders,
	aiTools,
	aiSystemUploads,
	aiPrompts,
	configDynamicAttributes,
	chats,
	chatMessages,
	chatMessagesDebug,
	aiAgentFlowsKnowledgeFiles
} from '@repo/db/schema';
import { generateId } from '@repo/db/id';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface FlowData {
	nodes: Node[];
	edges: Edge[];
}

export interface FlowVersion {
	id: string;
	agent: string;
	version: number;
	isActive: boolean;
	changeLog: string;
	flowData: FlowData;
	validationStatus: 'valid' | 'invalid' | 'warning';
	validationErrors: ValidationError[];
	knowledgeFiles: string[];
	created: string;
	updated: string;
}

export interface ValidationError {
	nodeId?: string;
	field?: string;
	message: string;
	severity: 'error' | 'warning';
}

export interface PlaygroundThread {
	id: string;
	name: string;
	agentId: string;
	messageCount: number;
	lastMessage?: string;
	created: string;
	updated: string;
}

export interface PlaygroundMessage {
	id: string;
	chatId: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	created: string;
	tokens?: { input: number; output: number };
	costUsd?: number;
	latencyMs?: number;
	model?: string;
	toolCalls?: Array<{ tool: string; durationMs: number; success: boolean }>;
	attachments?: Array<{
		id: string;
		name: string;
		type: string;
		size: number;
		url?: string;
	}>;
	// Generative UI parts
	parts?: Array<{
		type:
			| 'text'
			| 'tool-display_chart'
			| 'tool-display_table'
			| 'tool-ask_confirmation'
			| 'tool-request_input';
		state?: 'input-available' | 'output-available';
		toolCallId?: string;
		text?: string;
		output?: unknown;
	}>;
}

export interface DebugEvent {
	id: string;
	chatId: string;
	messageId?: string;
	eventType: string;
	eventCategory: 'context' | 'llm' | 'tool' | 'extraction' | 'error' | 'cost';
	data: Record<string, unknown>;
	timestamp: string;
	durationMs?: number;
	sequenceNumber: number;
}

export type AgentWithFlow = typeof aiAgents.$inferSelect & {
	expand?: {
		current_flow?: (typeof aiAgentFlows.$inferSelect)[];
	};
};

// Model with provider expanded + supported tool IDs from junction table
export type ModelWithProvider = typeof aiAgentModels.$inferSelect & {
	supportedTools: string[];
	expand?: {
		provider?: typeof aiProviders.$inferSelect;
	};
};

// Tool type alias
export type Tool = typeof aiTools.$inferSelect;

// Prompt type alias
export type Prompt = typeof aiPrompts.$inferSelect;

// Injectable attribute (for prompt {{placeholder}} UI)
export interface InjectableAttribute {
	id: string;
	attribute_key: string;
	display_name: string;
	description?: string;
	category: 'identity' | 'preference' | 'contextual' | 'derived';
	data_type: 'string' | 'number' | 'boolean' | 'array' | 'date';
	source_type: 'cf_header' | 'user_fact' | 'client_provided' | 'explicit' | 'derived';
}

// ============================================================================
// Agent Queries
// ============================================================================

/**
 * Get agent details with current flow expanded
 */
export const getAgent = query(async () => {
	const { locals, params } = getRequestEvent();
	const agentId = params.id;
	if (!agentId) throw new Error('Agent ID is required');
	const db = locals.db;

	const rows = await db
		.select({ agent: aiAgents, flow: aiAgentFlows })
		.from(aiAgents)
		.leftJoin(aiAgentFlows, eq(aiAgents.currentFlow, aiAgentFlows.id))
		.where(eq(aiAgents.id, agentId));

	if (!rows.length) throw new Error('Agent not found');
	const { agent, flow } = rows[0];
	return {
		...agent,
		expand: {
			...(flow ? { current_flow: [flow] } : {})
		}
	} as AgentWithFlow;
});

/**
 * Update agent basic settings (name, description, status)
 */
export const updateAgent = command(
	z.object({
		agentId: z.string(),
		name: z.string().optional(),
		description: z.string().optional(),
		status: z.enum(['active', 'inactive', 'development']).optional()
	}),
	async ({ agentId, ...data }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const updateData: Record<string, unknown> = { updated: new Date().toISOString() };
		if (data.name !== undefined) updateData.name = data.name;
		if (data.description !== undefined) updateData.description = data.description;
		if (data.status !== undefined) updateData.status = data.status;

		await db.update(aiAgents).set(updateData).where(eq(aiAgents.id, agentId));
		return { success: true };
	}
);

// ============================================================================
// Model & Tool Queries (for Flow Editor)
// ============================================================================

/**
 * Get available AI models for flow editor
 * Returns models with provider info and options_schema for dynamic form generation
 */
export const getAvailableModels = query(async (): Promise<ModelWithProvider[]> => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const rows = await db
		.select({ model: aiAgentModels, provider: aiProviders })
		.from(aiAgentModels)
		.leftJoin(aiProviders, eq(aiAgentModels.provider, aiProviders.id))
		.where(
			and(
				eq(aiAgentModels.isActive, true),
				eq(aiAgentModels.isEnabled, true),
				eq(aiAgentModels.configKey, '')
			)
		)
		.orderBy(aiAgentModels.displayName);

	// Batch-fetch supported tool IDs from the junction table
	const modelIds = rows.map((r) => r.model.id);
	const supportedToolRows = modelIds.length
		? await db
				.select({
					sourceId: aiAgentModelsSupportedTools.sourceId,
					targetId: aiAgentModelsSupportedTools.targetId
				})
				.from(aiAgentModelsSupportedTools)
				.where(inArray(aiAgentModelsSupportedTools.sourceId, modelIds))
		: [];
	const toolsByModel = new Map<string, string[]>();
	for (const row of supportedToolRows) {
		const arr = toolsByModel.get(row.sourceId) ?? [];
		arr.push(row.targetId);
		toolsByModel.set(row.sourceId, arr);
	}

	return rows.map((r) => ({
		...r.model,
		supportedTools: toolsByModel.get(r.model.id) ?? [],
		expand: { ...(r.provider ? { provider: r.provider } : {}) }
	})) as ModelWithProvider[];
});

/**
 * Get available tools for flow editor
 * Returns tools with config_schema for dynamic configuration
 */
export const getAvailableTools = query(async (): Promise<Tool[]> => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	return await db
		.select()
		.from(aiTools)
		.where(and(eq(aiTools.isActive, true), eq(aiTools.isEnabled, true)))
		.orderBy(aiTools.category, aiTools.displayName);
});

// System upload type for knowledge base files
export interface SystemUpload {
	id: string;
	name: string;
	type: string;
	size: number;
	status: 'processing' | 'ready' | 'error';
	created: string;
}

/**
 * Get system uploads for knowledge base selection
 * Returns files that can be used as knowledge base in agents
 */
export const getSystemUploads = query(async (): Promise<SystemUpload[]> => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const records = await db
		.select({
			id: aiSystemUploads.id,
			name: aiSystemUploads.name,
			type: aiSystemUploads.type,
			size: aiSystemUploads.size,
			created: aiSystemUploads.created
		})
		.from(aiSystemUploads)
		.where(sql`${aiSystemUploads.vectors} is not null and ${aiSystemUploads.vectors}::text != '{}'`)
		.orderBy(desc(aiSystemUploads.created));

	return records.map((r) => ({
		id: r.id,
		name: r.name ?? '',
		type: r.type ?? '',
		size: Number(r.size) || 0,
		status: 'ready' as const,
		created: r.created ?? ''
	}));
});

/**
 * Get available prompts for context management summarization
 * Returns prompts that can be used for summarization
 */
export const getAvailablePrompts = query(async (): Promise<Prompt[]> => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	return await db
		.select()
		.from(aiPrompts)
		.where(eq(aiPrompts.isActive, true))
		.orderBy(aiPrompts.category, aiPrompts.promptKey);
});

/**
 * Get attributes available for prompt injection ({{attribute_key}} placeholders)
 * Returns only active attributes with 'prompt_injection' in allowed_usages
 */
export const getInjectableAttributes = query(async (): Promise<InjectableAttribute[]> => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const records = await db
		.select()
		.from(configDynamicAttributes)
		.where(eq(configDynamicAttributes.isActive, true))
		.orderBy(configDynamicAttributes.category, configDynamicAttributes.displayName);

	// Filter to only attributes that allow prompt_injection usage
	return records
		.filter((attr) => {
			const usages = attr.allowedUsages as string[] | undefined;
			return usages?.includes('prompt_injection');
		})
		.map((attr) => ({
			id: attr.id,
			attribute_key: attr.attributeKey ?? '',
			display_name: attr.displayName ?? '',
			description: attr.description ?? undefined,
			category: attr.category as InjectableAttribute['category'],
			data_type: attr.dataType as InjectableAttribute['data_type'],
			source_type: attr.sourceType as InjectableAttribute['source_type']
		}));
});

/**
 * Get all flow versions for an agent
 */
export const getFlowVersions = query(async (): Promise<FlowVersion[]> => {
	const { locals, params } = getRequestEvent();
	const agentId = params.id;
	if (!agentId) throw new Error('Agent ID is required');
	const db = locals.db;

	const flows = await db
		.select()
		.from(aiAgentFlows)
		.where(eq(aiAgentFlows.agent, agentId))
		.orderBy(desc(aiAgentFlows.version));

	if (!flows.length) return [];

	const flowIds = flows.map((f) => f.id);
	const junctionRows = await db
		.select()
		.from(aiAgentFlowsKnowledgeFiles)
		.where(inArray(aiAgentFlowsKnowledgeFiles.sourceId, flowIds));

	const kfMap = new Map<string, string[]>();
	for (const row of junctionRows) {
		const arr = kfMap.get(row.sourceId) ?? [];
		arr.push(row.targetId);
		kfMap.set(row.sourceId, arr);
	}

	return flows.map((flow) => ({
		id: flow.id,
		agent: flow.agent ?? '',
		version: Number(flow.version),
		isActive: flow.isActive ?? false,
		changeLog: flow.changeLog ?? '',
		flowData: (flow.flowData as FlowData) ?? { nodes: [], edges: [] },
		validationStatus: (flow.validationStatus ?? 'valid') as FlowVersion['validationStatus'],
		validationErrors: (flow.validationErrors as ValidationError[]) ?? [],
		knowledgeFiles: kfMap.get(flow.id) ?? [],
		created: flow.created ?? '',
		updated: flow.updated ?? ''
	}));
});

/**
 * Get the active flow version for an agent
 */
export const getActiveFlow = query(async (): Promise<FlowVersion | null> => {
	const { locals, params } = getRequestEvent();
	const agentId = params.id;
	if (!agentId) throw new Error('Agent ID is required');
	const db = locals.db;

	const [flow] = await db
		.select()
		.from(aiAgentFlows)
		.where(and(eq(aiAgentFlows.agent, agentId), eq(aiAgentFlows.isActive, true)))
		.limit(1);

	if (!flow) return null;

	const kfRows = await db
		.select({ targetId: aiAgentFlowsKnowledgeFiles.targetId })
		.from(aiAgentFlowsKnowledgeFiles)
		.where(eq(aiAgentFlowsKnowledgeFiles.sourceId, flow.id));

	return {
		id: flow.id,
		agent: flow.agent ?? '',
		version: Number(flow.version),
		isActive: true,
		changeLog: flow.changeLog ?? '',
		flowData: (flow.flowData as FlowData) ?? { nodes: [], edges: [] },
		validationStatus: (flow.validationStatus ?? 'valid') as FlowVersion['validationStatus'],
		validationErrors: (flow.validationErrors as ValidationError[]) ?? [],
		knowledgeFiles: kfRows.map((r) => r.targetId),
		created: flow.created ?? '',
		updated: flow.updated ?? ''
	};
});
// ============================================================================

/**
 * Save a new flow version
 * Calls worker RPC to validate and compile, then saves to database
 */
export const saveFlowVersion = command(
	z.object({
		agentId: z.string(),
		flowData: z.object({
			nodes: z.array(z.any()),
			edges: z.array(z.any())
		}),
		changeLog: z.string().optional()
	}),
	async ({ agentId, flowData, changeLog }): Promise<FlowVersion> => {
		const { locals, platform } = getRequestEvent();
		const db = locals.db;

		// Call worker RPC to validate and compile the flow
		const worker = platform?.env?.CF_WORKER;
		if (!worker) {
			throw new Error('Worker not available - cannot validate flow');
		}

		const result: ValidateAndCompileResult = await worker.validateAndCompileFlow({
			agentId,
			flowData
		});

		// Get current max version
		const [maxRow] = await db
			.select({ maxVersion: sql<string>`coalesce(max(${aiAgentFlows.version}), '0')` })
			.from(aiAgentFlows)
			.where(eq(aiAgentFlows.agent, agentId));

		const nextVersion = (Number(maxRow?.maxVersion) || 0) + 1;
		const now = new Date().toISOString();

		// Create new version with validation status and compiled config
		const [newFlow] = await db
			.insert(aiAgentFlows)
			.values({
				id: generateId(),
				agent: agentId,
				version: String(nextVersion),
				flowData,
				compiledConfig: result.compiledConfig ?? null,
				changeLog: changeLog ?? `Version ${nextVersion}`,
				isActive: false,
				validationStatus: result.validationStatus,
				validationErrors: result.validationErrors,
				created: now,
				updated: now
			})
			.returning();

		// Map validation errors to the expected format
		const mappedErrors: ValidationError[] = result.validationErrors.map((e) => ({
			nodeId: e.nodeId,
			field: e.field,
			message: e.message,
			severity: e.severity
		}));

		return {
			id: newFlow.id,
			agent: newFlow.agent ?? '',
			version: nextVersion,
			isActive: false,
			changeLog: newFlow.changeLog ?? '',
			flowData: flowData,
			validationStatus: result.validationStatus,
			validationErrors: mappedErrors,
			knowledgeFiles: [],
			created: newFlow.created ?? '',
			updated: newFlow.updated ?? ''
		};
	}
);

/**
 * Activate a flow version (deactivates others)
 */
export const activateFlowVersion = command(
	z.object({
		agentId: z.string(),
		flowId: z.string()
	}),
	async ({ agentId, flowId }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const now = new Date().toISOString();

		// Bulk deactivate all active flows for this agent
		await db
			.update(aiAgentFlows)
			.set({ isActive: false, updated: now })
			.where(and(eq(aiAgentFlows.agent, agentId), eq(aiAgentFlows.isActive, true)));

		// Activate the specified flow
		await db
			.update(aiAgentFlows)
			.set({ isActive: true, updated: now })
			.where(eq(aiAgentFlows.id, flowId));

		// Update the agent's current_flow reference
		await db
			.update(aiAgents)
			.set({ currentFlow: flowId, updated: now })
			.where(eq(aiAgents.id, agentId));

		return { success: true };
	}
);

// ============================================================================
// Playground Queries
// ============================================================================

/**
 * Get playground threads (admin_test chats for this agent)
 */
export const getPlaygroundThreads = query(
	z.object({ agentId: z.string() }),
	async ({ agentId }): Promise<PlaygroundThread[]> => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const rows = await db
			.select()
			.from(chats)
			.where(
				and(
					eq(chats.agent, agentId),
					eq(chats.source, 'admin_test'),
					eq(chats.user, locals.user?.id ?? '')
				)
			)
			.orderBy(desc(chats.updated));

		return rows.map((chat) => ({
			id: chat.id,
			name: chat.title ?? 'Untitled Thread',
			agentId: chat.agent ?? '',
			messageCount: 0,
			created: chat.created ?? '',
			updated: chat.updated ?? ''
		}));
	}
);

/**
 * Get messages for a playground thread
 */
export const getThreadMessages = query(
	z.object({ threadId: z.string() }),
	async ({ threadId }): Promise<PlaygroundMessage[]> => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const messages = await db
			.select()
			.from(chatMessages)
			.where(eq(chatMessages.chat, threadId))
			.orderBy(chatMessages.created);

		return messages.map((msg) => {
			const meta = msg.meta as Record<string, unknown> | null;
			return {
				id: msg.id,
				chatId: msg.chat ?? '',
				role: msg.role as 'user' | 'assistant' | 'system',
				content: msg.message ?? '',
				created: msg.created ?? '',
				tokens: meta?.tokens as { input: number; output: number } | undefined,
				costUsd: meta?.cost_usd as number | undefined,
				latencyMs: meta?.latency_ms as number | undefined,
				model: meta?.model as string | undefined,
				toolCalls: meta?.tool_calls as
					| Array<{ tool: string; durationMs: number; success: boolean }>
					| undefined,
				attachments: meta?.attachments as
					| Array<{
							id: string;
							name: string;
							type: string;
							size: number;
							url?: string;
					  }>
					| undefined,
				parts: meta?.parts as
					| Array<{
							type:
								| 'text'
								| 'tool-display_chart'
								| 'tool-display_table'
								| 'tool-ask_confirmation'
								| 'tool-request_input';
							state?: 'input-available' | 'output-available';
							toolCallId?: string;
							text?: string;
							output?: unknown;
					  }>
					| undefined
			};
		});
	}
);

// ============================================================================
// Playground Commands
// ============================================================================

/**
 * Get raw messages for a thread in ServerMessage format (for AI SDK Chat init).
 * Maps chat_messages rows to the shape expected by @repo/shared/utils serverMessagesToUIMessages.
 */
export const getThreadMessagesRaw = query(
	z.object({ threadId: z.string() }),
	async ({ threadId }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const messages = await db
			.select()
			.from(chatMessages)
			.where(eq(chatMessages.chat, threadId))
			.orderBy(chatMessages.created);

		return messages.map((msg) => {
			const meta = msg.meta as Record<string, unknown> | null;
			// Handle both old admin format (meta.attachments) and new worker format (meta.files)
			const files = (meta?.files ?? meta?.attachments) as
				| Array<{
						id: string;
						name: string;
						size: number;
						type: string;
						url?: string;
				  }>
				| undefined;
			return {
				id: msg.id,
				role: msg.role ?? 'user',
				content: msg.message ?? '',
				created_at: msg.created ?? new Date().toISOString(),
				files,
				parts: meta?.parts as unknown[] | undefined
			};
		});
	}
);

/**
 * Create a new playground thread
 */
export const createPlaygroundThread = command(
	z.object({
		agentId: z.string(),
		name: z.string().optional()
	}),
	async ({ agentId, name }): Promise<PlaygroundThread> => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		const now = new Date().toISOString();

		const [chat] = await db
			.insert(chats)
			.values({
				id: generateId(),
				agent: agentId,
				user: locals.user?.id ?? '',
				source: 'admin_test',
				title: name ?? 'New Test Thread',
				created: now,
				updated: now
			})
			.returning();

		return {
			id: chat.id,
			name: chat.title ?? 'Untitled Thread',
			agentId: chat.agent ?? '',
			messageCount: 0,
			created: chat.created ?? '',
			updated: chat.updated ?? ''
		};
	}
);

/**
 * Delete a playground thread
 */
export const deletePlaygroundThread = command(
	z.object({ threadId: z.string() }),
	async ({ threadId }) => {
		const { locals } = getRequestEvent();
		await locals.db.delete(chats).where(eq(chats.id, threadId));
		return { success: true };
	}
);

// ============================================================================
// Debug Queries
// ============================================================================

/**
 * Debug message with full AI input/output
 */
export interface DebugMessage {
	id: string;
	chatId: string;
	userId?: string;
	agentId?: string;
	role: 'user' | 'assistant' | 'system';
	userMessage?: string;
	systemPrompt?: string;
	fullMessagesJson?: Array<{ role: string; content: string }>;
	assistantResponse?: string;
	modelId?: string;
	provider?: string;
	inputTokens?: number;
	outputTokens?: number;
	costUsd?: number;
	latencyMs?: number;
	contextData?: Record<string, unknown>;
	created: string;
}

/**
 * Get debug messages for a chat (new chat_messages_debug collection)
 * This returns the full AI input/output for each message
 */
export const getDebugMessages = query(
	z.object({
		chatId: z.string(),
		limit: z.number().optional()
	}),
	async ({ chatId, limit }): Promise<DebugMessage[]> => {
		const { locals } = getRequestEvent();
		const db = locals.db;
		try {
			const logs = await db
				.select()
				.from(chatMessagesDebug)
				.where(eq(chatMessagesDebug.chat, chatId))
				.orderBy(chatMessagesDebug.created)
				.limit(limit ?? 100);

			return logs.map((log) => ({
				id: log.id,
				chatId: log.chat ?? '',
				userId: log.user ?? undefined,
				agentId: log.agent ?? undefined,
				role: log.role as 'user' | 'assistant' | 'system',
				userMessage: log.userMessage ?? undefined,
				systemPrompt: log.systemPrompt ?? undefined,
				fullMessagesJson: log.fullMessagesJson as
					| Array<{ role: string; content: string }>
					| undefined,
				assistantResponse: log.assistantResponse ?? undefined,
				modelId: log.modelId ?? undefined,
				provider: log.provider ?? undefined,
				inputTokens: log.inputTokens != null ? Number(log.inputTokens) : undefined,
				outputTokens: log.outputTokens != null ? Number(log.outputTokens) : undefined,
				costUsd: log.costUsd != null ? Number(log.costUsd) : undefined,
				latencyMs: log.latencyMs != null ? Number(log.latencyMs) : undefined,
				contextData: log.contextData as Record<string, unknown> | undefined,
				created: log.created ?? ''
			}));
		} catch {
			// Collection might not exist yet
			return [];
		}
	}
);
