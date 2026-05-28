<script lang="ts">
	import { useDnD, type NodeType } from './dnd-provider.svelte';
	import { Play, CircleStop, Bot, GitBranch } from '@lucide/svelte';

	let {
		agentId
	}: {
		agentId: string;
	} = $props();

	const dnd = useDnD();

	interface NodeTypeInfo {
		type: NodeType;
		label: string;
		description: string;
		icon: typeof Play;
		color: string;
	}

	const nodeTypes: NodeTypeInfo[] = [
		{
			type: 'start',
			label: 'Start',
			description: 'Entry point of the flow',
			icon: Play,
			color: 'bg-green-500/10 border-green-500/30 text-green-600'
		},
		{
			type: 'end',
			label: 'End',
			description: 'Exit point of the flow',
			icon: CircleStop,
			color: 'bg-red-500/10 border-red-500/30 text-red-600'
		},
		{
			type: 'llm',
			label: 'LLM Call',
			description: 'Execute an LLM request',
			icon: Bot,
			color: 'bg-blue-500/10 border-blue-500/30 text-blue-600'
		},
		{
			type: 'classifier',
			label: 'Classifier',
			description: 'Route based on intent',
			icon: GitBranch,
			color: 'bg-purple-500/10 border-purple-500/30 text-purple-600'
		}
	];

	function onDragStart(event: DragEvent, nodeType: NodeType) {
		if (!event.dataTransfer) return;

		dnd.current = nodeType;
		event.dataTransfer.effectAllowed = 'move';
	}
</script>

<aside class="flex h-full w-64 flex-col border-r bg-muted/30">
	<div class="border-b px-4 py-3">
		<h3 class="text-sm font-semibold text-foreground">Node Palette</h3>
		<p class="text-xs text-muted-foreground">Drag nodes to the canvas</p>
	</div>

	<div class="flex-1 space-y-2 overflow-y-auto p-3">
		{#each nodeTypes as node (node.type)}
			<div
				class="group flex cursor-grab items-center gap-3 rounded-lg border bg-background p-3 transition-all hover:shadow-sm active:cursor-grabbing {node.color}"
				draggable="true"
				ondragstart={(e) => onDragStart(e, node.type)}
				role="button"
				tabindex="0"
			>
				<div class="flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-sm">
					<node.icon class="h-4 w-4" />
				</div>
				<div class="flex-1 overflow-hidden">
					<p class="text-sm font-medium text-foreground">{node.label}</p>
					<p class="truncate text-xs text-muted-foreground">{node.description}</p>
				</div>
			</div>
		{/each}
	</div>
</aside>
