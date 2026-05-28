<script module lang="ts">
	import type { Node } from '@xyflow/svelte';

	/**
	 * Start Node Data - matches AGENT_FLOW_SPECIFICATION.md
	 * Entry point for every flow with system prompt and knowledge base
	 */
	export type StartNodeData = {
		label: string;
		// System prompt applied to first LLM node (if not overridden)
		system_prompt?: string;
		// Template for processing uploaded files
		file_enricher_template?: string;
		// Knowledge base files (from ai_system_uploads)
		knowledge_base?: string[]; // File IDs
		// Enable knowledge base / RAG search
		rag_enabled?: boolean;
		// Input validation schema
		input_schema?: {
			required_fields?: string[];
			max_message_length?: number;
			allowed_file_types?: string[];
		};
		// Context management for long conversations
		context_management?: {
			enabled: boolean;
			strategy: 'sliding_window' | 'hybrid';
			sliding_window_size: number;
			summarization?: {
				trigger_threshold: number;
				model_id: string;
				prompt_key: string;
				max_tokens?: number;
			};
		};
	};

	export type StartNodeType = Node<StartNodeData, 'start'>;
</script>

<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Play from '@lucide/svelte/icons/play';
	import FileText from '@lucide/svelte/icons/file-text';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import NodeWrapper from './node-wrapper.svelte';
	import { Badge } from '$lib/components/shadcn/badge';

	let { data, selected }: NodeProps<StartNodeType> = $props();

	const hasSystemPrompt = $derived(!!data.system_prompt?.trim());
	const kbCount = $derived(data.knowledge_base?.length ?? 0);
	const hasContextMgmt = $derived(!!data.context_management?.enabled);
</script>

<NodeWrapper label={data.label || 'Start'} icon={Play} colorClass="border-green-500/30" {selected}>
	<div class="space-y-1.5">
		<div class="text-xs text-muted-foreground">Entry point of the agent flow</div>
		<div class="flex flex-wrap gap-1">
			{#if hasSystemPrompt}
				<Badge variant="outline" class="gap-1 text-[10px]">System prompt</Badge>
			{/if}
			{#if kbCount > 0}
				<Badge variant="outline" class="gap-1 text-[10px]">
					<FileText class="h-2.5 w-2.5" />
					{kbCount} file{kbCount > 1 ? 's' : ''}
				</Badge>
			{/if}
			{#if hasContextMgmt}
				<Badge variant="outline" class="gap-1 text-[10px]">
					<MessageSquare class="h-2.5 w-2.5" />
					{data.context_management?.strategy}
				</Badge>
			{/if}
		</div>
	</div>
	<Handle type="source" position={Position.Bottom} class="h-3! w-3! bg-green-500!" />
</NodeWrapper>
