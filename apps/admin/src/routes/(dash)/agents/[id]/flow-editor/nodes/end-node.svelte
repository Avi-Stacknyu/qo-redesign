<script module lang="ts">
	import type { Node } from '@xyflow/svelte';

	/**
	 * End Node - Terminates the agent flow
	 * Can specify end type (success, error, handoff) and response template
	 */
	export type EndNodeData = {
		label: string;
		// End type
		end_type?: 'success' | 'error' | 'handoff';
		// Response template using {{variable}} syntax
		response_template?: string;
		// For error type
		error_message?: string;
		// For handoff type
		handoff_target?: string;
		// Metadata
		successMessage?: string; // Legacy
	};

	export type EndNodeType = Node<EndNodeData, 'end'>;
</script>

<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import CircleStop from '@lucide/svelte/icons/circle-stop';
	import NodeWrapper from './node-wrapper.svelte';

	let { data, selected }: NodeProps<EndNodeType> = $props();
</script>

<NodeWrapper
	label={data.label || 'End'}
	icon={CircleStop}
	colorClass="border-red-500/30"
	{selected}
>
	<div class="text-xs text-muted-foreground">Exit point of the agent flow</div>
	<Handle type="target" position={Position.Top} class="h-3! w-3! bg-red-500!" />
</NodeWrapper>
