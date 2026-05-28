// Export all node components
export { default as StartNode } from './start-node.svelte';
export { default as EndNode } from './end-node.svelte';
export { default as LLMNode } from './llm-node.svelte';
export { default as ClassifierNode } from './classifier-node.svelte';

// Re-export types from svelte module blocks
export type { StartNodeData, StartNodeType } from './start-node.svelte';
export type { EndNodeData, EndNodeType } from './end-node.svelte';
export type { LLMNodeData, LLMNodeType } from './llm-node.svelte';
export type { ClassifierNodeData, ClassifierNodeType } from './classifier-node.svelte';

// Import types for union
import type { StartNodeData } from './start-node.svelte';
import type { EndNodeData } from './end-node.svelte';
import type { LLMNodeData } from './llm-node.svelte';
import type { ClassifierNodeData } from './classifier-node.svelte';

// Union type for all node data types
export type AllNodeData = StartNodeData | EndNodeData | LLMNodeData | ClassifierNodeData;

// Node types registry for SvelteFlow
import StartNode from './start-node.svelte';
import EndNode from './end-node.svelte';
import LLMNode from './llm-node.svelte';
import ClassifierNode from './classifier-node.svelte';

export const nodeTypes = {
	start: StartNode,
	end: EndNode,
	llm: LLMNode,
	classifier: ClassifierNode
} as const;
