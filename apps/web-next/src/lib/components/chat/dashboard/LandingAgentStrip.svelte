<script lang="ts">
	import * as Tooltip from '$lib/components/shadcn/tooltip/index.js';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import { cn } from '$lib/utils';
	import type { AgentDTO } from '$lib/utils/agents';

	let {
		agents,
		pinnedIds,
		selectedAgentId,
		onSelect
	}: {
		agents: AgentDTO[];
		pinnedIds: string[];
		selectedAgentId: string | null;
		onSelect: (agentId: string) => void;
	} = $props();

	const orderedAgents = $derived([
		...agents.filter((a) => pinnedIds.includes(a.id)),
		...agents.filter((a) => !pinnedIds.includes(a.id))
	]);
	const displayAgents = $derived(orderedAgents.slice(0, 6));
	const selectedAgent = $derived(agents.find((a) => a.id === selectedAgentId));
</script>

<div class="flex items-center gap-2.5">
	<div class="flex items-center gap-1.5" role="radiogroup" aria-label="Select an AI agent">
		{#each displayAgents as agent (agent.id)}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							onclick={() => onSelect(agent.id)}
							role="radio"
							aria-checked={agent.id === selectedAgentId}
							aria-label={agent.name}
							class={cn(
								'rounded-full p-0.5 transition-all duration-200',
								agent.id === selectedAgentId
									? 'scale-110 ring-2 ring-primary ring-offset-1 ring-offset-background'
									: 'opacity-40 hover:scale-105 hover:opacity-70'
							)}
						>
							<AgentAvatar {agent} size="sm" />
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="top" class="text-xs">
					{agent.name}
				</Tooltip.Content>
			</Tooltip.Root>
		{/each}
	</div>
	{#if selectedAgent}
		<span class="hidden text-xs font-medium text-muted-foreground sm:inline">
			{selectedAgent.name}
		</span>
	{/if}
</div>
