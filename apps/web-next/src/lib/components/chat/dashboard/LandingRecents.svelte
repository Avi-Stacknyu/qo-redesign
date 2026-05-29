<script lang="ts">
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import { tick } from 'svelte';
	import { ArrowRight } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';
	import type { AgentSummary } from '$lib/utils/agents';
	import ScrollJumpButtons from './ScrollJumpButtons.svelte';
	import { getScrollJumpState, type ScrollJumpState } from './scroll-jump-state';

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

	const hasOverflow = $derived(chats.length > 2);
	let scrollContainer: HTMLDivElement | undefined = $state();
	let jumpState = $state<ScrollJumpState>({ canScrollUp: false, canScrollDown: false });

	function getAgent(agentId?: string) {
		return agents.find((a) => a.id === agentId);
	}

	function formatTime(dateStr?: string) {
		if (!dateStr) return 'Just now';
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return 'Just now';
		return formatDistanceToNow(date, { addSuffix: true });
	}

	function updateJumpState() {
		if (!scrollContainer || !hasOverflow) {
			jumpState = { canScrollUp: false, canScrollDown: false };
			return;
		}

		jumpState = getScrollJumpState({
			scrollTop: scrollContainer.scrollTop,
			clientHeight: scrollContainer.clientHeight,
			scrollHeight: scrollContainer.scrollHeight
		});
	}

	function scrollToTop() {
		scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function scrollToBottom() {
		if (!scrollContainer) return;
		scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
	}

	$effect(() => {
		chats.length;
		hasOverflow;
		void tick().then(updateJumpState);
	});
</script>

<div
	class="flex min-h-0 w-full animate-in flex-col delay-150 duration-500 fade-in slide-in-from-bottom-4"
>
	<p
		class="mb-3 shrink-0 text-[11px] font-medium tracking-[0.24em] text-muted-foreground/40 uppercase"
	>
		Continue	 Conversations
	</p>
	<div class="relative">
		<ScrollJumpButtons
			canScrollUp={jumpState.canScrollUp}
			canScrollDown={jumpState.canScrollDown}
			onScrollTop={scrollToTop}
			onScrollBottom={scrollToBottom}
		/>
		<div
			bind:this={scrollContainer}
			onscroll={updateJumpState}
			class={
				'landing-recents-scroll flex flex-col gap-3 ' +
				(hasOverflow
					? 'max-h-41 overflow-y-auto pr-1 md:max-h-43'
					: 'overflow-visible')
			}
		>
			{#each chats as chat (chat.id)}
				{@const agent = getAgent(chat.agentId ?? undefined)}
				<button
					onclick={() => onChatClick(chat.id)}
					class="group min-h-19 w-full rounded-2xl border border-[#E4E9EF] bg-white px-4 py-3 text-left text-sm font-normal text-muted-foreground transition-all hover:border-purple-100 md:min-h-20 md:px-5 md:py-4 md:text-base"
				>
					<div class="flex items-center gap-3">
						{#if agent}
							<AgentAvatar {agent} size="sm" />
						{/if}
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-sm font-medium text-foreground/80 group-hover:text-foreground md:text-base">
								{chat.title}
							</span>
							<span class="text-[11px] text-muted-foreground/40">
								{agent?.name ?? 'Agent'} · {formatTime(chat.updated)}
							</span>
						</div>
						<ArrowRight
							class="size-3.5 shrink-0 -translate-x-1 text-transparent transition-all group-hover:translate-x-0 group-hover:text-muted-foreground/50"
						/>
					</div>
				</button>
			{/each}
		</div>

		{#if hasOverflow}
			<div class="pointer-events-none absolute inset-x-0 top-0 h-6 bg-linear-to-b from-[#f7f4ff] to-transparent"></div>
			<div class="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-[#f7f4ff] to-transparent"></div>
		{/if}
	</div>
</div>

<style>
	:global(.landing-recents-scroll) {
		scrollbar-width: none;
	}

	:global(.landing-recents-scroll::-webkit-scrollbar) {
		display: none;
	}
</style>
