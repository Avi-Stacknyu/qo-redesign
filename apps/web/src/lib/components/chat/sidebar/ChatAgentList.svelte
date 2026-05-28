<script lang="ts">
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import type { Agent } from '$lib/remote/agents.remote';

	let {
		agents,
		isLoading = false,
		activeAgentId = null
	}: {
		agents: Agent[];
		isLoading?: boolean;
		activeAgentId?: string | null;
	} = $props();

	function handleAgentClick(agentId: string) {
		goto(`/chat?agent=${agentId}`);
	}
</script>

<div class="group-data-[collapsible=icon]:hidden">
	{#if agents.length === 0 && !isLoading}
		<div class="px-3 py-4 text-center text-xs text-muted-foreground/50">No agents available.</div>
	{:else}
		<div class="flex flex-col gap-0.5">
			{#each agents as agent (agent.id)}
				{@const isActive = activeAgentId === agent.id}
				<button
					type="button"
					onclick={() => handleAgentClick(agent.id)}
					class={cn(
						'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-all',
						isActive ? 'bg-sidebar-accent ring-1 ring-primary/20' : 'hover:bg-sidebar-accent/60'
					)}
				>
					<AgentAvatar {agent} size="sm" />
					<span class="truncate text-[13px] font-medium text-sidebar-foreground">
						{agent.name}
					</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
