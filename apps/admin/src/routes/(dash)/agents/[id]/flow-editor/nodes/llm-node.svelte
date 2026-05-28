<script module lang="ts">
	import type { Node } from '@xyflow/svelte';

	/**
	 * LLM Node Data - matches AGENT_FLOW_SPECIFICATION.md
	 * Executes an AI model with optional tools
	 */
	export type LLMNodeData = {
		label: string;
		// Model to use (from ai_agent_models collection - the record ID)
		model_id?: string;
		// Model display name (for showing in node)
		model_name?: string;
		// Override system prompt (otherwise inherits from start or previous)
		system_prompt?: string;
		// Tools available to this model (from ai_tools collection - record IDs)
		tools?: string[];
		// Per-tool configuration overrides (keyed by tool_id)
		tool_params?: Record<string, Record<string, unknown>>;
		/**
		 * @deprecated Use `provider_options` instead. Kept for backward compat.
		 */
		parameters?: {
			temperature?: number;
			max_tokens?: number;
			top_p?: number;
			frequency_penalty?: number;
			presence_penalty?: number;
			stop?: string[];
		};
		// Model-specific provider options (from options_schema) — canonical field
		provider_options?: Record<string, unknown>;
		// Force structured output (JSON mode)
		output_schema?: Record<string, unknown>;
		// Files always included in context (from ai_system_uploads)
		system_files?: string[];
	};

	export type LLMNodeType = Node<LLMNodeData, 'llm'>;
</script>

<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Bot from '@lucide/svelte/icons/bot';
	import Wrench from '@lucide/svelte/icons/wrench';
	import NodeWrapper from './node-wrapper.svelte';
	import { Badge } from '$lib/components/shadcn/badge';

	let { data, selected }: NodeProps<LLMNodeType> = $props();

	const toolCount = $derived(data.tools?.length ?? 0);
	const hasSystemPrompt = $derived(!!data.system_prompt?.trim());
</script>

<NodeWrapper label={data.label || 'LLM Call'} icon={Bot} colorClass="border-blue-500/30" {selected}>
	<Handle type="target" position={Position.Top} class="h-3! w-3! bg-blue-500!" />

	<div class="space-y-2">
		{#if data.model_id}
			<Badge variant="secondary" class="text-xs">{data.model_name ?? data.model_id}</Badge>
		{:else}
			<Badge variant="outline" class="text-xs">User Selected Model</Badge>
		{/if}

		<div class="flex flex-wrap gap-1">
			{#if hasSystemPrompt}
				<Badge variant="outline" class="text-[10px]">Prompt override</Badge>
			{/if}
			{#if toolCount > 0}
				<Badge variant="outline" class="gap-1 text-[10px]">
					<Wrench class="h-2.5 w-2.5" />
					{toolCount} tool{toolCount > 1 ? 's' : ''}
				</Badge>
			{/if}
		</div>
	</div>

	<Handle type="source" position={Position.Bottom} class="h-3! w-3! bg-blue-500!" />
</NodeWrapper>
