<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import { createThread, getThreadList } from '$lib/remote/chat-threads.remote';
	import LandingRecents from '$lib/components/chat/dashboard/LandingRecents.svelte';
	import AgentSelector from '$lib/components/chat/AgentSelector.svelte';
	import CreditGate from '$lib/components/chat/CreditGate.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const threadListQuery = browser ? getThreadList() : null;

	let isCreating = $state(false);
	let manualAgentId = $state<string | null>(null);

	const validAgents = $derived(data.agents ? data.agents.filter((a) => !!a.id) : []);
	const shelfAgentIds = $derived(data.shelfAgentIds ?? []);
	const urlAgentId = $derived($page.url.searchParams.get('agent'));
	const selectedAgentId = $derived(manualAgentId ?? urlAgentId);
	const selectedAgent = $derived(validAgents.find((a) => a.id === selectedAgentId));
	const recentChats = $derived((threadListQuery?.current ?? []).slice(0, 5));
	const creditsBlocked = $derived(data.tierContext.creditBalance <= 0);

	function handleAgentSelect(agentId: string) {
		manualAgentId = agentId;
		const url = new URL($page.url);
		url.searchParams.set('agent', agentId);
		goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
	}

	async function createNewChat(message: string): Promise<boolean> {
		if (!selectedAgentId || isCreating || !message.trim() || creditsBlocked) return false;

		const msg = message.trim();
		isCreating = true;
		try {
			const result = await createThread({
				agent_id: selectedAgentId,
				title: 'New Chat'
			}).updates(getThreadList());
			goto(`/chat/${result.id}`, { state: { initialMessage: msg } });
			return true;
		} catch (err) {
			console.error('Failed to create chat:', err);
			return false;
		} finally {
			isCreating = false;
		}
	}
</script>

<div class="flex min-h-dvh w-full items-center justify-center px-4 py-10 md:px-6 md:py-12">
	<div class="flex w-full max-w-5xl flex-col items-center gap-12 md:gap-20">
		<div class="w-full max-w-4xl text-center">
			<h2
				class="pb-2 text-4xl leading-[1.1] font-medium md:text-6xl lg:text-7xl"
				style="background: linear-gradient(90deg, #A259FF 0%, #C89FFD 49.04%, #44187C 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
			>
				Chat with your tabs
			</h2>
		</div>

		{#if creditsBlocked}
			<CreditGate
				creditBalance={data.tierContext.creditBalance}
				hasSubscription={data.tierContext.hasSubscription}
			/>
		{/if}

		<div class="flex w-full max-w-4xl flex-col gap-6 md:gap-8">
			<ChatInput
				placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : 'Search'}
				onSubmit={createNewChat}
				submitDisabled={!selectedAgentId || creditsBlocked || isCreating}
				isSubmitting={isCreating}
			>
				{#snippet children()}
					<div class="flex flex-wrap items-center gap-2">
						<AgentSelector
							agents={validAgents}
							{selectedAgentId}
							{shelfAgentIds}
							onSelectAgent={handleAgentSelect}
						/>
						<p class="text-sm font-normal text-muted-foreground md:text-base">
							{recentChats.length > 0
								? 'Open a previous conversation or start a new thread.'
								: 'Press Enter to open a new thread with your first message.'}
						</p>
					</div>
				{/snippet}
			</ChatInput>

			{#if recentChats.length > 0}
				<LandingRecents
					chats={recentChats}
					agents={validAgents}
					onChatClick={(id) => goto(`/chat/${id}`)}
				/>
			{/if}
		</div>
	</div>
</div>
