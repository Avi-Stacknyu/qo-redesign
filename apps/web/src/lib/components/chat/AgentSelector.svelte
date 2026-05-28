<script lang="ts">
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import * as Popover from '$lib/components/shadcn/popover/index.js';
	import { cn } from '$lib/utils';
	import type { AgentSummary } from '$lib/utils/agents';
	import { Check, Star } from '@lucide/svelte';

	let {
		agents,
		selectedAgentId = null,
		onSelectAgent,
		shelfAgentIds = [] as string[]
	}: {
		agents: AgentSummary[];
		selectedAgentId?: string | null;
		onSelectAgent?: (agentId: string) => void;
		shelfAgentIds?: string[];
	} = $props();

	let popoverOpen = $state(false);

	const selectedAgent = $derived(agents.find((a) => a.id === selectedAgentId));
	const shelfAgents = $derived(agents.filter((a) => shelfAgentIds.includes(a.id)));
	const otherAgents = $derived(agents.filter((a) => !shelfAgentIds.includes(a.id)));

	function handleAgentSelect(agentId: string) {
		onSelectAgent?.(agentId);
		popoverOpen = false;
	}
</script>

<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger
		class="group flex h-8 items-center justify-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 text-sm font-medium shadow-sm backdrop-blur-md transition-all hover:border-primary/40 hover:bg-card/90 hover:shadow-md"
	>
		{#if selectedAgent}
			<div class="-ml-0.5 flex items-center justify-center">
				<AgentAvatar agent={selectedAgent} size="sm" />
			</div>
			<span class="max-w-24 truncate text-foreground sm:max-w-none">{selectedAgent.name}</span>
		{:else}
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				class="text-muted-foreground transition-colors group-hover:text-primary"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polygon points="12 2 2 7 12 12 22 7 12 2" />
				<polyline points="2 17 12 22 22 17" />
				<polyline points="2 12 12 17 22 12" />
			</svg>
			<span>Select Agent</span>
		{/if}
	</Popover.Trigger>
	<Popover.Content
		align="start"
		class="z-50 flex max-h-[min(60vh,24rem)] w-64 flex-col rounded-xl border border-border/60 bg-card/95 p-2 shadow-lg backdrop-blur sm:w-72"
	>
		{#if shelfAgents.length > 0}
			<p
				class="flex items-center gap-1.5 px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase"
			>
				<Star class="size-3" />Suggested
			</p>
			<div class="flex flex-col gap-0.5">
				{#each shelfAgents as agent (agent.id)}
					<button
						type="button"
						onclick={() => handleAgentSelect(agent.id)}
						class={cn(
							'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-muted/50',
							agent.id === selectedAgentId && 'bg-primary/10'
						)}
					>
						<AgentAvatar {agent} size="sm" />
						<span class="flex-1 truncate text-sm text-foreground">{agent.name}</span>
						{#if agent.id === selectedAgentId}
							<Check class="size-3.5 shrink-0 text-primary" />
						{/if}
					</button>
				{/each}
			</div>
			{#if otherAgents.length > 0}
				<div class="mx-2 my-1.5 border-t border-border/40"></div>
			{/if}
		{/if}

		{#if otherAgents.length > 0}
			{#if shelfAgents.length > 0}
				<p
					class="px-2 pt-0.5 pb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase"
				>
					All Agents
				</p>
			{/if}
			<div class="flex min-h-0 flex-col gap-0.5 overflow-y-auto [scrollbar-width:thin]">
				{#each otherAgents as agent (agent.id)}
					<button
						type="button"
						onclick={() => handleAgentSelect(agent.id)}
						class={cn(
							'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-muted/50',
							agent.id === selectedAgentId && 'bg-primary/10'
						)}
					>
						<AgentAvatar {agent} size="sm" />
						<span class="flex-1 truncate text-sm text-foreground">{agent.name}</span>
						{#if agent.id === selectedAgentId}
							<Check class="size-3.5 shrink-0 text-primary" />
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		{#if agents.length === 0}
			<p class="px-2 py-3 text-center text-xs text-muted-foreground/50">No agents available</p>
		{/if}
	</Popover.Content>
</Popover.Root>
