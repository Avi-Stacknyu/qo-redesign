/**
 * Flow Compiler
 * Compiles visual flow (nodes/edges) into CompiledFlowConfig for runtime execution
 *
 * Canonical location (Phase 4): cf-worker
 * Called via RPC from admin when saving flow versions
 */

import type { Node, Edge } from '@xyflow/svelte';
import type {
	FlowNodeType,
	CompiledFlowConfig,
	CompiledNode,
	CompilationContext,
	ContextManagementConfig
} from '@repo/shared/types';
import { buildOutgoingEdgeMap } from './validator';

// ============================================================================
// Types for node data (matches what we store in editor)
// ============================================================================

interface StartNodeData {
	label: string;
	system_prompt?: string;
	file_enricher_template?: string;
	knowledge_base?: string[];
	rag_enabled?: boolean;
	context_management?: ContextManagementConfig;
}

interface EndNodeData {
	label: string;
	end_type?: 'success' | 'error' | 'handoff';
	response_template?: string;
	error_message?: string;
	handoff_target?: string;
}

interface LLMNodeData {
	label: string;
	model_id?: string;
	model_name?: string;
	system_prompt?: string;
	tools?: string[];
	tool_params?: Record<string, Record<string, unknown>>;
	parameters?: {
		temperature?: number;
		max_tokens?: number;
		top_p?: number;
		frequency_penalty?: number;
		presence_penalty?: number;
		stop?: string[];
	};
	provider_options?: Record<string, unknown>;
	retry?: {
		max_attempts: number;
		initial_delay_ms: number;
		backoff_strategy: 'linear' | 'exponential';
	};
	search_config?: {
		enabled: boolean;
		max_results?: number;
		similarity_threshold?: number;
		file_scope?: 'chat' | 'global' | 'all';
	};
	output_schema?: Record<string, unknown>;
	system_files?: string[];
}

interface ClassifierNodeData {
	label: string;
	classifier_type?: 'llm' | 'keyword' | 'regex';
	model_id?: string;
	model_name?: string;
	classification_prompt?: string;
	match_field?: string;
	categories?: Array<{
		id: string;
		label: string;
		description?: string;
		keywords?: string[];
		pattern?: string;
	}>;
	default_category?: string;
	confidence_threshold?: number;
}

// ============================================================================
// Main Compilation Function
// ============================================================================

export function compileFlow(
	flowData: { nodes: Node[]; edges: Edge[] },
	context: CompilationContext
): CompiledFlowConfig {
	const { nodes, edges } = flowData;

	// Build lookup maps
	const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
	const outgoingEdges = buildOutgoingEdgeMap(edges);

	// Find start node
	const startNode = nodes.find((n) => n.type === 'start');
	if (!startNode) {
		throw new Error('Cannot compile flow without a start node');
	}

	// Extract global config from start node
	const startData = startNode.data as unknown as StartNodeData;
	const globalConfig = extractGlobalConfig(startData);

	// Collect all referenced models and tools
	const referencedModelIds = new Set<string>();
	const referencedToolIds = new Set<string>();

	// Compile each node
	const compiledNodes: Record<string, CompiledNode> = {};
	const nodeTypeCounts: Record<FlowNodeType, number> = {
		start: 0,
		end: 0,
		llm: 0,
		classifier: 0
	};

	let hasClassifier = false;
	let maxDepth = 0;

	for (const node of nodes) {
		const nodeType = node.type as FlowNodeType;
		nodeTypeCounts[nodeType]++;

		if (nodeType === 'classifier') {
			hasClassifier = true;
		}

		// Track references
		const data = node.data as unknown as LLMNodeData | ClassifierNodeData;
		if ('model_id' in data && data.model_id) {
			referencedModelIds.add(data.model_id);
		}
		if ('tools' in data && data.tools) {
			data.tools.forEach((t) => referencedToolIds.add(t));
		}

		// Compile the node
		compiledNodes[node.id] = compileNode(node, outgoingEdges);
	}

	// Calculate max depth
	maxDepth = calculateMaxDepth(startNode.id, outgoingEdges);

	// Detect implicit parallelism (any node with multiple unique outgoing targets)
	let hasImplicitParallel = false;
	for (const [, edges] of outgoingEdges) {
		// Deduplicate by target to get actual unique branches
		const uniqueTargets = new Set(edges.map((e) => e.target));
		if (uniqueTargets.size > 1) {
			hasImplicitParallel = true;
			break;
		}
	}

	// If context management uses a model, track it
	if (startData.context_management?.summarization?.model_id) {
		referencedModelIds.add(startData.context_management.summarization.model_id);
	}

	// Resolve models
	const resolvedModels = resolveModels(referencedModelIds, context);

	// Resolve tools
	const resolvedTools = resolveTools(referencedToolIds, context);

	// Build the compiled config
	const config: CompiledFlowConfig = {
		version: '2.0',
		start_node_id: startNode.id,
		nodes: compiledNodes,
		global_config: globalConfig,
		resolved: {
			models: resolvedModels,
			tools: resolvedTools
		},
		metadata: {
			total_nodes: nodes.length,
			has_classifier: hasClassifier,
			has_implicit_parallel: hasImplicitParallel,
			max_depth: maxDepth,
			node_type_counts: nodeTypeCounts
		}
	};

	return config;
}

// ============================================================================
// Extract Global Config from Start Node
// ============================================================================

function extractGlobalConfig(startData: StartNodeData): CompiledFlowConfig['global_config'] {
	return {
		system_prompt: startData.system_prompt,
		file_enricher_template: startData.file_enricher_template,
		knowledge_base: startData.knowledge_base ?? [],
		default_timeout_ms: 30000, // Default 30 seconds
		rag_enabled: startData.rag_enabled,
		context_management: startData.context_management
	};
}

// ============================================================================
// Compile Individual Node
// ============================================================================

function compileNode(node: Node, outgoingEdges: Map<string, Edge[]>): CompiledNode {
	const nodeType = node.type as FlowNodeType;
	const edges = outgoingEdges.get(node.id) ?? [];

	// Base compiled node
	const compiled: CompiledNode = {
		id: node.id,
		type: nodeType,
		label: (node.data as { label?: string }).label ?? nodeType,
		config: cleanNodeConfig(node.data as Record<string, unknown>, nodeType),
		next: []
	};

	// Build next array and next_mapping based on node type
	switch (nodeType) {
		case 'start':
		case 'llm':
			// Simple single output - get unique target nodes (deduplicate duplicate edges)
			compiled.next = [...new Set(edges.map((e) => e.target))];
			break;

		case 'classifier': {
			// Classifier has category-based routing
			// sourceHandle is the category id directly (e.g., "cat_1", "cat_2")
			const data = node.data as unknown as ClassifierNodeData;
			const nextMapping: Record<string, string> = {};
			const nextTargets = new Set<string>();

			for (const edge of edges) {
				// sourceHandle is the category.id (e.g., "cat_1")
				if (edge.sourceHandle) {
					const categoryId = edge.sourceHandle;
					nextMapping[categoryId] = edge.target;
					nextTargets.add(edge.target);
				}
			}

			compiled.next = [...nextTargets];

			// Handle default category
			if (data.default_category) {
				nextMapping['__default__'] = nextMapping[data.default_category] ?? compiled.next[0];
			}

			compiled.next_mapping = nextMapping;
			break;
		}

		case 'end':
			// End nodes have no outgoing connections
			compiled.next = [];
			break;
	}

	return compiled;
}

// ============================================================================
// Clean Node Config (remove UI-only fields)
// ============================================================================

function cleanNodeConfig(
	data: Record<string, unknown>,
	nodeType: FlowNodeType
): Record<string, unknown> {
	// Create a shallow copy
	const config = { ...data };

	// Remove the label (it's in the CompiledNode directly)
	delete config.label;

	// Remove model_name (UI display only, we use model_id)
	delete config.model_name;

	// Type-specific cleaning
	switch (nodeType) {
		case 'start':
			// Start node config goes to global_config, but we still keep it here
			// for reference. The executor should use global_config.
			break;

		case 'llm':
			// Clean up empty/default values
			if (!config.system_prompt) delete config.system_prompt;
			if (!config.tools || (config.tools as string[]).length === 0) delete config.tools;
			if (!config.tool_params || Object.keys(config.tool_params as object).length === 0) {
				delete config.tool_params;
			}
			// Dead configs — remove if present from old saved flows
			delete config.retry;
			delete config.search_config;
			if (!config.output_schema) delete config.output_schema;
			if (!config.system_files || (config.system_files as string[]).length === 0) {
				delete config.system_files;
			}
			// Backward-compat shim: if node has legacy `parameters` but no `provider_options`,
			// copy parameters into provider_options so the mapper handles them uniformly
			if (
				config.parameters &&
				Object.keys(config.parameters as object).length > 0 &&
				(!config.provider_options || Object.keys(config.provider_options as object).length === 0)
			) {
				config.provider_options = { ...(config.parameters as object) };
			}
			// Remove legacy field — runtime should only use provider_options
			delete config.parameters;
			// Clean empty provider_options
			if (!config.provider_options || Object.keys(config.provider_options as object).length === 0) {
				delete config.provider_options;
			}
			break;

		case 'classifier':
			// Clean up empty values
			if (!config.classification_prompt) delete config.classification_prompt;
			if (!config.match_field) delete config.match_field;
			break;

		case 'end':
			// Set defaults
			if (!config.end_type) config.end_type = 'success';
			if (!config.response_template) delete config.response_template;
			if (!config.error_message) delete config.error_message;
			if (!config.handoff_target) delete config.handoff_target;
			break;
	}

	return config;
}

// ============================================================================
// Resolve Models
// ============================================================================

function resolveModels(
	modelIds: Set<string>,
	context: CompilationContext
): CompiledFlowConfig['resolved']['models'] {
	const resolved: CompiledFlowConfig['resolved']['models'] = {};

	for (const modelId of modelIds) {
		const model = context.models.find((m) => m.id === modelId);
		if (model) {
			resolved[modelId] = {
				id: model.id,
				model_id: model.model_id, // The actual model identifier (e.g., "gpt-4o")
				display_name: model.display_name,
				provider_id: model.provider?.id ?? '',
				provider_key: model.provider?.provider_key ?? 'unknown',
				pricing_id: model.current_pricing,
				// Include model config for runtime
				context_window: model.context_window,
				max_output_tokens: model.max_output_tokens,
				default_options: model.default_options,
				capabilities: model.capabilities
			};
		}
	}

	return resolved;
}

// ============================================================================
// Resolve Tools
// ============================================================================

function resolveTools(
	toolIds: Set<string>,
	context: CompilationContext
): CompiledFlowConfig['resolved']['tools'] {
	const resolved: CompiledFlowConfig['resolved']['tools'] = {};

	for (const toolId of toolIds) {
		const tool = context.tools.find((t) => t.id === toolId);
		if (tool) {
			resolved[toolId] = {
				id: tool.id,
				tool_key: tool.tool_key,
				display_name: tool.display_name,
				description: tool.description,
				tool_type: tool.tool_type,
				sdk_tool_name: tool.sdk_tool_name,
				execution_config: tool.default_config,
				// Include provider_key for SDK tools (needed to look up the correct tool factory)
				provider_key: tool.provider?.provider_key
			};
		}
	}

	return resolved;
}

// ============================================================================
// Calculate Max Depth
// ============================================================================

function calculateMaxDepth(startNodeId: string, outgoingEdges: Map<string, Edge[]>): number {
	const visited = new Set<string>();

	function dfs(nodeId: string, depth: number): number {
		if (visited.has(nodeId)) {
			return depth; // Cycle detected
		}

		visited.add(nodeId);
		let maxDepth = depth;

		const edges = outgoingEdges.get(nodeId) ?? [];
		for (const edge of edges) {
			const childDepth = dfs(edge.target, depth + 1);
			maxDepth = Math.max(maxDepth, childDepth);
		}

		visited.delete(nodeId);
		return maxDepth;
	}

	return dfs(startNodeId, 0);
}
