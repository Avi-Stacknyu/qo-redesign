<script module lang="ts">
	import type { Node } from '@xyflow/svelte';

	/**
	 * Classifier Node Data - matches AGENT_FLOW_SPECIFICATION.md
	 * Routes execution based on LLM classification
	 */
	export type ClassifierNodeData = {
		label: string;
		// How to classify
		classifier_type: 'llm' | 'keyword' | 'regex';
		// For LLM classification - model to use
		model_id?: string;
		// Model display name (for showing in node)
		model_name?: string;
		// Classification prompt template
		classification_prompt?: string;
		// For keyword/regex classification - which field to match
		match_field?: string;
		// Categories (each becomes an output handle)
		categories: Array<{
			id: string;
			label: string;
			description?: string;
			// For keyword matching
			keywords?: string[];
			// For regex matching
			pattern?: string;
		}>;
		// Default category if no match
		default_category?: string;
		// Confidence threshold for LLM classification (0.0 - 1.0)
		confidence_threshold?: number;
	};

	export type ClassifierNodeType = Node<ClassifierNodeData, 'classifier'>;
</script>

<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import GitBranch from '@lucide/svelte/icons/git-branch';
	import Bot from '@lucide/svelte/icons/bot';
	import NodeWrapper from './node-wrapper.svelte';
	import { Badge } from '$lib/components/shadcn/badge';

	let { data, selected }: NodeProps<ClassifierNodeType> = $props();

	const categories = $derived(data.categories ?? []);
	const isLLMClassifier = $derived(data.classifier_type === 'llm');
</script>

<NodeWrapper
	label={data.label || 'Classifier'}
	icon={GitBranch}
	colorClass="border-purple-500/30"
	{selected}
>
	<Handle type="target" position={Position.Top} class="h-3! w-3! bg-purple-500!" />

	<div class="space-y-2">
		<!-- Classifier type and model badge -->
		<div class="flex flex-wrap gap-1">
			<Badge variant="secondary" class="text-[10px]">
				{data.classifier_type ?? 'llm'}
			</Badge>
			{#if isLLMClassifier && data.model_id}
				<Badge variant="outline" class="gap-1 text-[10px]">
					<Bot class="h-2.5 w-2.5" />
					{data.model_name ?? data.model_id}
				</Badge>
			{:else if isLLMClassifier && !data.model_id}
				<Badge variant="outline" class="text-[10px] text-yellow-500">⚠ No model</Badge>
			{/if}
		</div>

		<!-- Categories with output handles -->
		{#if categories.length > 0}
			<div class="space-y-1">
				{#each categories as category}
					<div
						class="relative flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs"
					>
						<span class="truncate">{category.label}</span>
						<Handle
							type="source"
							position={Position.Right}
							id={category.id}
							class="-right-2! h-2.5! w-2.5! bg-purple-500!"
						/>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-xs text-muted-foreground italic">No categories defined</div>
			<Handle type="source" position={Position.Bottom} class="h-3! w-3! bg-purple-500!" />
		{/if}
	</div>
</NodeWrapper>
