<script lang="ts">
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import { ArrowRight } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';
	import type { AgentSummary } from '$lib/utils/agents';

	let {
		chats,
		agents,
		onChatClick
	}: {
		chats: {
			id: string;
			title: string;
			agentId: string | null;
			updated: string;
			created_at: string;
		}[];
		agents: AgentSummary[];
		onChatClick: (chatId: string) => void;
	} = $props();

	function getAgent(agentId?: string) {
		return agents.find((a) => a.id === agentId);
	}

	function formatTime(dateStr?: string) {
		if (!dateStr) return 'Just now';
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return 'Just now';
		return formatDistanceToNow(date, { addSuffix: true });
	}
</script>

<div
	class="flex min-h-0 w-full animate-in flex-col delay-300 duration-700 fade-in slide-in-from-bottom-8"
>
	<p
		class="mb-3 shrink-0 text-[11px] font-medium tracking-widest text-muted-foreground/40 uppercase"
	>
		Continue a conversation
	</p>
	<div class="flex flex-col overflow-y-auto">
		{#each chats as chat (chat.id)}
			{@const agent = getAgent(chat.agentId ?? undefined)}
			<button
				onclick={() => onChatClick(chat.id)}
				class="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-all hover:bg-muted/30"
			>
				{#if agent}
					<AgentAvatar {agent} size="sm" />
				{/if}
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="truncate text-sm font-medium text-foreground/70 group-hover:text-foreground">
						{chat.title}
					</span>
					<span class="text-[11px] text-muted-foreground/40">
						{agent?.name ?? 'Agent'} · {formatTime(chat.updated)}
					</span>
				</div>
				<ArrowRight
					class="size-3.5 shrink-0 -translate-x-1 text-transparent transition-all group-hover:translate-x-0 group-hover:text-muted-foreground/50"
				/>
			</button>
		{/each}
	</div>
</div>
