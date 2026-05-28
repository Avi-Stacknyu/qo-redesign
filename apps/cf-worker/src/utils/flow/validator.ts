/**
 * Flow Validator
 * Validates flow structure, connections, and node configurations
 *
 * Canonical location (Phase 4): cf-worker
 * Called via RPC from admin when saving flow versions
 */

import type { Node, Edge } from '@xyflow/svelte';
import type {
	FlowNodeType,
	ValidationError,
	ValidationResult,
	ValidationContext,
	FlowData
} from '@repo/shared/types';

// ============================================================================
// Constants
// ============================================================================

const MAX_NODES = 50;
const MAX_DEPTH = 20;

// Valid connection rules: [sourceType, targetType]
const VALID_CONNECTIONS: [FlowNodeType, FlowNodeType][] = [
	['start', 'end'],
	['start', 'llm'],
	['start', 'classifier'],
	['llm', 'end'],
	['llm', 'llm'],
	['llm', 'classifier'],
	['classifier', 'end'],
	['classifier', 'llm'],
	['classifier', 'classifier']
];

// ============================================================================
// Main Validation Function
// ============================================================================

export function validateFlow(
	flowData: { nodes: Node[]; edges: Edge[] },
	context: ValidationContext
): ValidationResult {
	const errors: ValidationError[] = [];
	const { nodes, edges } = flowData;

	// Build lookup maps
	const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
	const outgoingEdges = buildOutgoingEdgeMap(edges);

	// Structure validations
	validateStartNode(nodes, errors);
	validateEndNode(nodes, errors);
	validateNodeCount(nodes, errors);

	// Connection validations
	validateConnections(nodes, edges, nodeMap, errors);
	validateNoSelfLoops(edges, errors);
	validateClassifierConnections(nodes, edges, outgoingEdges, errors);

	// Reachability validations
	const startNode = nodes.find((n) => n.type === 'start');
	if (startNode) {
		validateReachability(startNode.id, nodes, outgoingEdges, errors);
		validateNoDeadEnds(nodes, outgoingEdges, errors);
		validateMaxDepth(startNode.id, outgoingEdges, errors);
	}

	// Parallel branch validation
	validateParallelBranches(nodes, outgoingEdges, errors);

	// Configuration validations
	validateNodeConfigurations(nodes, context, errors);

	// Determine overall status
	const hasErrors = errors.some((e) => e.severity === 'error');
	const hasWarnings = errors.some((e) => e.severity === 'warning');

	return {
		status: hasErrors ? 'invalid' : hasWarnings ? 'warning' : 'valid',
		errors
	};
}

// ============================================================================
// Helper: Build Edge Maps
// ============================================================================

export function buildOutgoingEdgeMap(edges: Edge[]): Map<string, Edge[]> {
	const map = new Map<string, Edge[]>();
	for (const edge of edges) {
		const existing = map.get(edge.source) ?? [];
		existing.push(edge);
		map.set(edge.source, existing);
	}
	return map;
}

export function buildIncomingEdgeMap(edges: Edge[]): Map<string, Edge[]> {
	const map = new Map<string, Edge[]>();
	for (const edge of edges) {
		const existing = map.get(edge.target) ?? [];
		existing.push(edge);
		map.set(edge.target, existing);
	}
	return map;
}

// ============================================================================
// Structure Validations
// ============================================================================

function validateStartNode(nodes: Node[], errors: ValidationError[]): void {
	const startNodes = nodes.filter((n) => n.type === 'start');

	if (startNodes.length === 0) {
		errors.push({
			code: 'NO_START_NODE',
			message: 'Flow must have exactly one Start node',
			severity: 'error'
		});
	} else if (startNodes.length > 1) {
		errors.push({
			code: 'MULTIPLE_START_NODES',
			message: `Flow has ${startNodes.length} Start nodes, but only one is allowed`,
			severity: 'error',
			nodeId: startNodes[1].id
		});
	}
}

function validateEndNode(nodes: Node[], errors: ValidationError[]): void {
	const endNodes = nodes.filter((n) => n.type === 'end');

	if (endNodes.length === 0) {
		errors.push({
			code: 'NO_END_NODE',
			message: 'Flow must have at least one End node',
			severity: 'error'
		});
	}
}

function validateNodeCount(nodes: Node[], errors: ValidationError[]): void {
	if (nodes.length > MAX_NODES) {
		errors.push({
			code: 'MAX_NODES_EXCEEDED',
			message: `Flow has ${nodes.length} nodes, maximum allowed is ${MAX_NODES}`,
			severity: 'error'
		});
	}
}

// ============================================================================
// Connection Validations
// ============================================================================

function validateConnections(
	nodes: Node[],
	edges: Edge[],
	nodeMap: Map<string, Node>,
	errors: ValidationError[]
): void {
	for (const edge of edges) {
		const sourceNode = nodeMap.get(edge.source);
		const targetNode = nodeMap.get(edge.target);

		if (!sourceNode || !targetNode) {
			continue; // Skip edges with missing nodes
		}

		const sourceType = sourceNode.type as FlowNodeType;
		const targetType = targetNode.type as FlowNodeType;

		const isValid = VALID_CONNECTIONS.some(
			([validSource, validTarget]) => validSource === sourceType && validTarget === targetType
		);

		if (!isValid) {
			errors.push({
				code: 'INVALID_CONNECTION',
				message: `Invalid connection: ${sourceType} cannot connect to ${targetType}`,
				severity: 'error',
				nodeId: edge.source
			});
		}
	}
}

function validateNoSelfLoops(edges: Edge[], errors: ValidationError[]): void {
	for (const edge of edges) {
		if (edge.source === edge.target) {
			errors.push({
				code: 'SELF_LOOP',
				message: 'Node cannot connect to itself',
				severity: 'error',
				nodeId: edge.source
			});
		}
	}
}

function validateClassifierConnections(
	nodes: Node[],
	edges: Edge[],
	outgoingEdges: Map<string, Edge[]>,
	errors: ValidationError[]
): void {
	const classifierNodes = nodes.filter((n) => n.type === 'classifier');

	for (const classifier of classifierNodes) {
		const data = classifier.data as { categories?: Array<{ id: string; label: string }> };
		const categories = data?.categories ?? [];

		if (categories.length === 0) {
			continue; // Will be caught by config validation
		}

		const outgoing = outgoingEdges.get(classifier.id) ?? [];
		const connectedHandles = new Set(outgoing.map((e) => e.sourceHandle));

		// Check each category has an outgoing connection
		// The handle ID is the category.id directly (e.g., "cat_1")
		for (const category of categories) {
			if (!connectedHandles.has(category.id)) {
				errors.push({
					code: 'CLASSIFIER_INCOMPLETE',
					message: `Classifier category "${category.label}" has no outgoing connection`,
					severity: 'error',
					nodeId: classifier.id,
					field: `category.${category.id}`
				});
			}
		}
	}
}

// ============================================================================
// Reachability Validations
// ============================================================================

function validateReachability(
	startNodeId: string,
	nodes: Node[],
	outgoingEdges: Map<string, Edge[]>,
	errors: ValidationError[]
): void {
	const reachable = new Set<string>();
	const queue = [startNodeId];

	while (queue.length > 0) {
		const nodeId = queue.shift()!;
		if (reachable.has(nodeId)) continue;
		reachable.add(nodeId);

		const edges = outgoingEdges.get(nodeId) ?? [];
		for (const edge of edges) {
			if (!reachable.has(edge.target)) {
				queue.push(edge.target);
			}
		}
	}

	// Check for unreachable nodes
	for (const node of nodes) {
		if (!reachable.has(node.id)) {
			errors.push({
				code: 'UNREACHABLE_NODE',
				message: `Node "${(node.data as { label?: string }).label ?? node.id}" is not reachable from Start`,
				severity: 'error',
				nodeId: node.id
			});
		}
	}
}

function validateNoDeadEnds(
	nodes: Node[],
	outgoingEdges: Map<string, Edge[]>,
	errors: ValidationError[]
): void {
	for (const node of nodes) {
		// End nodes are allowed to have no outgoing connections
		if (node.type === 'end') continue;

		const outgoing = outgoingEdges.get(node.id) ?? [];
		if (outgoing.length === 0) {
			errors.push({
				code: 'DEAD_END_NODE',
				message: `Node "${(node.data as { label?: string }).label ?? node.id}" has no outgoing connections`,
				severity: 'error',
				nodeId: node.id
			});
		}
	}
}

function validateMaxDepth(
	startNodeId: string,
	outgoingEdges: Map<string, Edge[]>,
	errors: ValidationError[]
): void {
	const visited = new Set<string>();

	function dfs(nodeId: string, depth: number): number {
		if (depth > MAX_DEPTH) {
			return depth;
		}
		if (visited.has(nodeId)) {
			return depth; // Cycle detected, stop here
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

	const depth = dfs(startNodeId, 0);
	if (depth > MAX_DEPTH) {
		errors.push({
			code: 'MAX_DEPTH_EXCEEDED',
			message: `Flow depth (${depth}) exceeds maximum allowed (${MAX_DEPTH})`,
			severity: 'error'
		});
	}
}

// ============================================================================
// Parallel Branch Validations
// ============================================================================

function validateParallelBranches(
	nodes: Node[],
	outgoingEdges: Map<string, Edge[]>,
	errors: ValidationError[]
): void {
	// Find nodes with multiple outgoing edges (implicit parallelism)
	for (const node of nodes) {
		if (node.type === 'end' || node.type === 'classifier') continue;

		const outgoing = outgoingEdges.get(node.id) ?? [];
		if (outgoing.length <= 1) continue;

		// This node has parallel branches — check that exactly 1 success-type end node exists
		const endNodes = nodes.filter(
			(n) => n.type === 'end' && (n.data as { end_type?: string }).end_type === 'success'
		);

		if (endNodes.length === 0) {
			errors.push({
				code: 'PARALLEL_NO_SUCCESS_END',
				message: `Flow has parallel branches (from "${(node.data as { label?: string }).label ?? node.id}") but no success-type end node`,
				severity: 'error',
				nodeId: node.id
			});
		} else if (endNodes.length > 1) {
			errors.push({
				code: 'PARALLEL_MULTIPLE_SUCCESS_ENDS',
				message: `Flow has parallel branches but ${endNodes.length} success-type end nodes — parallel branches should converge to exactly 1`,
				severity: 'warning',
				nodeId: node.id
			});
		}

		// Only need to check once (if any node has parallel branches)
		break;
	}
}

// ============================================================================
// Configuration Validations
// ============================================================================

function validateNodeConfigurations(
	nodes: Node[],
	context: ValidationContext,
	errors: ValidationError[]
): void {
	for (const node of nodes) {
		switch (node.type) {
			case 'start':
				validateStartNodeConfig(node, errors);
				break;
			case 'llm':
				validateLLMNode(node, context, errors);
				break;
			case 'classifier':
				validateClassifierNode(node, context, errors);
				break;
		}
	}
}

function validateStartNodeConfig(node: Node, errors: ValidationError[]): void {
	const data = node.data as {
		context_management?: {
			enabled?: boolean;
			strategy?: string;
			summarization?: { model_id?: string; prompt_key?: string };
		};
	};

	const ctx = data?.context_management;
	if (ctx?.enabled && ctx.strategy === 'hybrid') {
		if (!ctx.summarization?.model_id || !ctx.summarization?.prompt_key) {
			errors.push({
				code: 'HYBRID_MISSING_SUMMARIZATION',
				message:
					'Hybrid context strategy requires a summarization model and prompt. It will fall back to sliding window at runtime.',
				severity: 'warning',
				nodeId: node.id,
				field: 'context_management.summarization'
			});
		}
	}
}

function validateLLMNode(node: Node, context: ValidationContext, errors: ValidationError[]): void {
	const data = node.data as {
		model_id?: string;
		tools?: string[];
	};

	// Model is optional — when absent, the user's selected model is used at runtime
	if (data.model_id && !context.availableModelIds.includes(data.model_id)) {
		errors.push({
			code: 'INVALID_MODEL_ID',
			message: `Model "${data.model_id}" not found in available models`,
			severity: 'error',
			nodeId: node.id,
			field: 'model_id'
		});
	}

	// Validate tools exist
	if (data.tools && data.tools.length > 0) {
		for (const toolId of data.tools) {
			if (!context.availableToolIds.includes(toolId)) {
				errors.push({
					code: 'INVALID_TOOL_ID',
					message: `Tool "${toolId}" not found in available tools`,
					severity: 'warning',
					nodeId: node.id,
					field: 'tools'
				});
			}
		}
	}
}

function validateClassifierNode(
	node: Node,
	context: ValidationContext,
	errors: ValidationError[]
): void {
	const data = node.data as {
		classifier_type?: string;
		model_id?: string;
		categories?: Array<{ id: string; label: string }>;
	};

	// Categories are required
	if (!data.categories || data.categories.length === 0) {
		errors.push({
			code: 'CLASSIFIER_NO_CATEGORIES',
			message: 'Classifier must have at least one category',
			severity: 'error',
			nodeId: node.id,
			field: 'categories'
		});
	} else {
		// Check for empty category labels
		for (const category of data.categories) {
			if (!category.label?.trim()) {
				errors.push({
					code: 'CLASSIFIER_EMPTY_CATEGORY',
					message: 'Classifier category must have a label',
					severity: 'error',
					nodeId: node.id,
					field: `category.${category.id}`
				});
			}
		}
	}

	// If LLM classifier, model should be selected (warning only since it can use default)
	if (data.classifier_type === 'llm' && data.model_id) {
		if (!context.availableModelIds.includes(data.model_id)) {
			errors.push({
				code: 'INVALID_MODEL_ID',
				message: `Model "${data.model_id}" not found in available models`,
				severity: 'error',
				nodeId: node.id,
				field: 'model_id'
			});
		}
	}
}
