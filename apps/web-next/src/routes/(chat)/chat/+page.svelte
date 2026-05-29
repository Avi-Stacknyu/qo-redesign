<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import LandingSuggestions from '$lib/components/chat/dashboard/LandingSuggestions.svelte';
	import LandingSelectedAgent from '$lib/components/chat/dashboard/LandingSelectedAgent.svelte';
	import { createThread, getThreadList } from '$lib/remote/chat-threads.remote';
	import { getAgentSuggestions } from '$lib/remote/chat-context.remote';
	import LandingRecents from '$lib/components/chat/dashboard/LandingRecents.svelte';
	import AgentSelector from '$lib/components/chat/AgentSelector.svelte';
	import CreditGate from '$lib/components/chat/CreditGate.svelte';
	import {
		DEFAULT_LANDING_SUGGESTIONS,
		normalizeLandingSuggestions
	} from '$lib/components/chat/dashboard/landing-suggestions-data';
	import { getGreetingText } from './landing-greeting';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const threadListQuery = browser ? getThreadList() : null;

	let message = $state('');
	let isCreating = $state(false);
	let manualAgentId = $state<string | null>(null);
	let displayedGreeting = $state('');
	let isTypingComplete = $state(false);
	let suggestions = $state(DEFAULT_LANDING_SUGGESTIONS);
	let isLoadingSuggestions = $state(false);

	const validAgents = $derived(data.agents ? data.agents.filter((a) => !!a.id) : []);
	const shelfAgentIds = $derived(data.shelfAgentIds ?? []);
	const urlAgentId = $derived($page.url.searchParams.get('agent'));
	const selectedAgentId = $derived(manualAgentId ?? urlAgentId);
	const selectedAgent = $derived(validAgents.find((a) => a.id === selectedAgentId));
	const recentChats = $derived((threadListQuery?.current ?? []).slice(0, 5));
	const creditsBlocked = $derived(data.tierContext.creditBalance <= 0);

	function typeText(text: string, onUpdate: (text: string) => void, speed = 40): Promise<void> {
		return new Promise((resolve) => {
			let index = 0;
			const interval = window.setInterval(() => {
				if (index <= text.length) {
					onUpdate(text.slice(0, index));
					index += 1;
					return;
				}

				window.clearInterval(interval);
				resolve();
			}, speed);
		});
	}

	onMount(() => {
		const greeting = getGreetingText(new Date(), $page.data.user?.name);
		return () => {
			displayedGreeting = greeting;
		};
	});

	$effect(() => {
		if (!browser) return;

		const greeting = getGreetingText(new Date(), $page.data.user?.name);
		displayedGreeting = '';
		isTypingComplete = false;

		let cancelled = false;
		void typeText(greeting, (text) => {
			if (!cancelled) displayedGreeting = text;
		}, 50).then(() => {
			if (!cancelled) isTypingComplete = true;
		});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!browser) return;

		if (!selectedAgentId) {
			suggestions = DEFAULT_LANDING_SUGGESTIONS;
			isLoadingSuggestions = false;
			return;
		}

		let cancelled = false;
		isLoadingSuggestions = true;

		void (async () => {
			try {
				const agent = validAgents.find((candidate) => candidate.id === selectedAgentId);
				const result = await getAgentSuggestions({
					agentId: selectedAgentId,
					agentName: agent?.name ?? undefined,
					agentDescription: agent?.description ?? undefined
				});

				if (!cancelled) {
					suggestions = normalizeLandingSuggestions(result.suggestions);
				}
			} catch {
				if (!cancelled) {
					suggestions = [];
				}
			} finally {
				if (!cancelled) {
					isLoadingSuggestions = false;
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	function handleAgentSelect(agentId: string) {
		manualAgentId = agentId;
		const url = new URL($page.url);
		url.searchParams.set('agent', agentId);
		goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function handleSuggestionSelect(prompt: string) {
		message = prompt;
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
			<h1
				class="pb-2 text-4xl leading-[1.1] font-medium md:text-6xl lg:text-7xl"
				style="background: linear-gradient(90deg, #A259FF 0%, #C89FFD 49.04%, #44187C 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
			>
				{displayedGreeting}{#if !isTypingComplete}<span class="animate-pulse text-[#A259FF]">|</span>{/if}
			</h1>

			{#if selectedAgent}
				<LandingSelectedAgent agent={selectedAgent} />
			{/if}
		</div>

		{#if creditsBlocked}
			<CreditGate
				creditBalance={data.tierContext.creditBalance}
				hasSubscription={data.tierContext.hasSubscription}
			/>
		{/if}

		<div class="flex w-full max-w-4xl flex-col gap-6 md:gap-8">
				<LandingSuggestions
					{suggestions}
					isLoading={isLoadingSuggestions}
					onSelect={handleSuggestionSelect}
				/>

			<ChatInput
					bind:value={message}
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
