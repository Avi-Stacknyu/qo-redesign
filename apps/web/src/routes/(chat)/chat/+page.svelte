<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { cn } from '$lib/utils';
	import { onMount, tick } from 'svelte';
	import { createThread, getThreadList } from '$lib/remote/chat-threads.remote';
	import { getAgentSuggestions } from '$lib/remote/chat-context.remote';
	import LandingSuggestions from '$lib/components/chat/dashboard/LandingSuggestions.svelte';
	import LandingRecents from '$lib/components/chat/dashboard/LandingRecents.svelte';
	import AgentSelector from '$lib/components/chat/AgentSelector.svelte';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import CreditGate from '$lib/components/chat/CreditGate.svelte';
	import { ArrowUp } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const threadListQuery = getThreadList();

	let message = $state('');
	let textarea: HTMLTextAreaElement | undefined = $state();
	let isCreating = $state(false);
	let manualAgentId = $state<string | null>(null);

	let suggestions = $state<{ title: string; prompt: string }[]>([]);
	let isLoadingSuggestions = $state(true);

	let displayedGreeting = $state('');
	let isTypingComplete = $state(false);

	const validAgents = $derived(data.agents ? data.agents.filter((a) => !!a.id) : []);
	const shelfAgentIds = $derived(data.shelfAgentIds ?? []);

	const urlAgentId = $derived($page.url.searchParams.get('agent'));
	const selectedAgentId = $derived(manualAgentId ?? urlAgentId);
	const selectedAgent = $derived(validAgents.find((a) => a.id === selectedAgentId));

	function handleAgentSelect(agentId: string) {
		manualAgentId = agentId;
		const url = new URL($page.url);
		url.searchParams.set('agent', agentId);
		goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
	}

	const recentChats = $derived((threadListQuery.current ?? []).slice(0, 5));

	function getGreeting(): string {
		const hour = new Date().getHours();
		if (hour >= 5 && hour < 12) return 'Good morning';
		if (hour >= 12 && hour < 17) return 'Good afternoon';
		if (hour >= 17 && hour < 22) return 'Good evening';
		return 'Hello';
	}

	function typeText(text: string, onUpdate: (text: string) => void, speed = 40): Promise<void> {
		return new Promise((resolve) => {
			let i = 0;
			const interval = setInterval(() => {
				if (i <= text.length) {
					onUpdate(text.slice(0, i));
					i++;
				} else {
					clearInterval(interval);
					resolve();
				}
			}, speed);
		});
	}

	onMount(() => {
		const greeting = `${getGreeting()}, ${data.user?.name?.split(' ')[0] ?? 'there'}`;
		typeText(greeting, (t) => (displayedGreeting = t), 50).then(() => (isTypingComplete = true));
	});

	$effect(() => {
		if (selectedAgentId) {
			loadSuggestions(selectedAgentId);
		} else {
			isLoadingSuggestions = false;
			suggestions = [
				{
					title: 'Financial Analysis',
					prompt: "Analyze this quarter's financial performance and provide key insights"
				},
				{
					title: 'Tax Planning',
					prompt: 'Create a comprehensive tax optimization strategy'
				},
				{
					title: 'Market Research',
					prompt: 'Research the latest trends in sustainable investing'
				},
				{
					title: 'Portfolio Review',
					prompt: 'Review my investment portfolio and suggest rebalancing'
				}
			];
		}
	});

	async function loadSuggestions(agentId: string) {
		isLoadingSuggestions = true;
		try {
			const agent = validAgents.find((a) => a.id === agentId);
			const result = await getAgentSuggestions({
				agentId,
				agentName: agent?.name ?? undefined,
				agentDescription: agent?.description ?? undefined
			});
			suggestions = result.suggestions
				.slice(0, 4)
				.map((s: { title: string; prompt: string }) => ({ title: s.title, prompt: s.prompt }));
		} catch {
			suggestions = [];
		} finally {
			isLoadingSuggestions = false;
		}
	}

	function handleSuggestionClick(prompt: string) {
		message = prompt;
		if (textarea) {
			textarea.focus();
			tick().then(() => autoResize({ target: textarea } as unknown as Event));
		}
	}

	const creditsBlocked = $derived(data.tierContext.creditBalance <= 0);

	async function createNewChat() {
		if (!selectedAgentId || isCreating || !message.trim() || creditsBlocked) return;
		const msg = message.trim();
		isCreating = true;
		try {
			const result = await createThread({
				agent_id: selectedAgentId,
				title: 'New Chat'
			}).updates(getThreadList());
			goto(`/chat/${result.id}`, { state: { initialMessage: msg } });
		} catch (err) {
			console.error('Failed to create chat:', err);
		} finally {
			isCreating = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			createNewChat();
		}
	}

	function autoResize(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		target.style.height = 'auto';
		target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
	}
</script>

<div
	class="flex h-dvh w-full flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-12 md:py-20"
>
	<div class="flex min-h-0 w-full max-w-3xl flex-col items-center gap-5 sm:gap-8 md:gap-10">
		<!-- Greeting -->
		<div
			class="flex animate-in flex-col items-center gap-2 text-center duration-700 fade-in slide-in-from-bottom-4 sm:gap-3"
		>
			<h1
				class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl"
			>
				{displayedGreeting}{#if !isTypingComplete}<span class="animate-pulse text-primary">|</span
					>{/if}
			</h1>

			{#if selectedAgent}
				<div
					class="mt-1 flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur-sm sm:mt-2 sm:gap-3 sm:px-5 sm:py-2.5 sm:text-base"
				>
					<div class="relative flex shrink-0 items-center justify-center">
						<AgentAvatar agent={selectedAgent} size="sm" />
						<div
							class="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-background bg-emerald-500 sm:size-2.5"
						></div>
					</div>
					<p class="text-muted-foreground/80">
						<span class="hidden sm:inline">What would you like to explore today with </span>
						<span class="sm:hidden">Chatting with </span>
						<span class="text-foreground">{selectedAgent.name}</span><span class="hidden sm:inline"
							>?</span
						>
					</p>
				</div>
			{:else}
				<p class="mt-1 text-sm text-muted-foreground/70 sm:mt-2 sm:text-base md:text-lg">
					What would you like to explore today?
				</p>
			{/if}
		</div>

		<!-- Credit Gate -->
		{#if creditsBlocked}
			<CreditGate
				creditBalance={data.tierContext.creditBalance}
				hasSubscription={data.tierContext.hasSubscription}
			/>
		{/if}

		<!-- Suggestions -->
		<LandingSuggestions
			{suggestions}
			isLoading={isLoadingSuggestions}
			onSelect={handleSuggestionClick}
		/>

		<!-- Input Box -->
		<div class="w-full animate-in delay-200 duration-700 fade-in slide-in-from-bottom-6">
			<div
				class={cn(
					'relative flex flex-col rounded-4xl border border-border/70 bg-background/80 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all duration-300',
					'focus-within:border-primary/30 focus-within:bg-card/90 focus-within:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] focus-within:ring-1 focus-within:ring-primary/20'
				)}
			>
				<div class="px-5 pt-5 pb-3 sm:px-6">
					<textarea
						bind:this={textarea}
						bind:value={message}
						onkeydown={handleKeydown}
						oninput={autoResize}
						rows="2"
						class="flex min-h-16 w-full resize-none border-none bg-transparent text-base leading-relaxed placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:outline-none sm:text-[1.1rem]"
						placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : 'Ask anything...'}
					></textarea>
				</div>

				<div class="flex items-center justify-between px-3 pb-3 sm:px-4">
					<AgentSelector
						agents={validAgents}
						{selectedAgentId}
						{shelfAgentIds}
						onSelectAgent={handleAgentSelect}
					/>
					<button
						onclick={createNewChat}
						disabled={!selectedAgentId || isCreating || !message.trim()}
						aria-label="Send message"
						class={cn(
							'inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
							message.trim() && selectedAgentId && !isCreating
								? 'bg-primary text-primary-foreground shadow-md hover:scale-[1.02] active:scale-[0.98]'
								: 'bg-muted/40 text-muted-foreground/30'
						)}
					>
						{#if isCreating}
							<div
								class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							></div>
						{:else}
							<ArrowUp class="size-4" />
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Recent Chats -->
		{#if recentChats.length > 0}
			<div class="flex min-h-0 w-full shrink flex-col">
				<LandingRecents
					chats={recentChats}
					agents={validAgents}
					onChatClick={(id) => goto(`/chat/${id}`)}
				/>
			</div>
		{/if}

		<p
			class="text-center text-[9px] tracking-wider text-muted-foreground/25 uppercase md:text-[10px]"
		>
			AI can make mistakes. Verify important information.
		</p>
	</div>
</div>
