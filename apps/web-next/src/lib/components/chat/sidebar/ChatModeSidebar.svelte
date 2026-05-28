<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import {
		getThreadList,
		getUserCreditBalance,
		toggleThreadFavorite,
		deleteThread
	} from '$lib/remote/chat-threads.remote';
	import { deleteThreadWithContext } from '$lib/remote/chat-context.remote';
	import { getAgents } from '$lib/remote/agents.remote';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import DeleteChatDialog from './DeleteChatDialog.svelte';
	import AiSettingsDialog from './AiSettingsDialog.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tooltip from '$lib/components/shadcn/tooltip/index.js';
	import { cn } from '$lib/utils';
	import { PanelLeft, Plus, Settings } from '@lucide/svelte';

	let {
		visible = $bindable(true)
	}: {
		visible?: boolean;
	} = $props();

	const threadListQuery = browser ? getThreadList() : null;
	const agentsQuery = browser ? getAgents() : null;
	const creditsQuery = browser ? getUserCreditBalance() : null;

	const allChats = $derived(threadListQuery?.current ?? []);
	const agents = $derived(agentsQuery?.current ?? []);

	const contextAgentId = $derived.by(() => {
		const agentParam = $page.url.searchParams.get('agent');
		if (agentParam) return agentParam;
		const segments = $page.url.pathname.split('/');
		const threadId = segments.length > 2 && segments[2] !== '' ? segments[2] : null;
		if (threadId) {
			const thread = allChats.find((c) => c.id === threadId);
			return thread?.agentId ?? null;
		}
		return null;
	});

	let showAll = $state(false);
	const activeFilterId = $derived(showAll ? null : contextAgentId);
	const filterAgent = $derived(agents.find((a) => a.id === activeFilterId));

	$effect(() => {
		if (contextAgentId !== undefined) showAll = false;
	});

	function agentFor(agentId?: string | null) {
		const agent = agents.find((a) => a.id === agentId);
		return agent ? { id: agent.id, name: agent.name, avatar_url: agent.avatar_url } : undefined;
	}

	const favorites = $derived(
		allChats
			.filter((c) => c.favorite)
			.filter((c) => !activeFilterId || c.agentId === activeFilterId)
	);
	const recents = $derived(
		allChats
			.filter((c) => !c.favorite)
			.filter((c) => !activeFilterId || c.agentId === activeFilterId)
	);

	let deleteDialogOpen = $state(false);
	let deleteTargetId = $state('');
	let deleteTargetTitle = $state('');
	let aiSettingsOpen = $state(false);

	function handleNewChat() {
		if (activeFilterId) goto(resolve(`/chat?agent=${activeFilterId}`));
		else goto(resolve('/chat'));
	}

	async function handleToggleFavorite(chatId: string) {
		if (!threadListQuery) return;
		const chat = allChats.find((c) => c.id === chatId);
		if (!chat) return;
		await toggleThreadFavorite({ thread_id: chatId, favorite: !chat.favorite }).updates(
			threadListQuery.withOverride((chats) =>
				chats.map((c) => (c.id === chatId ? { ...c, favorite: !c.favorite } : c))
			)
		);
	}

	function handleDeleteClick(chatId: string) {
		const chat = allChats.find((c) => c.id === chatId);
		deleteTargetId = chatId;
		deleteTargetTitle = chat?.title ?? 'this chat';
		deleteDialogOpen = true;
	}

	async function handleDeleteChatOnly(chatId: string) {
		if (!threadListQuery) return;
		const currentThreadId = $page.params.threadId;
		if (currentThreadId === chatId) await goto(resolve('/chat'));
		await deleteThread(chatId).updates(
			threadListQuery.withOverride((chats) => chats.filter((c) => c.id !== chatId))
		);
	}

	async function handleDeleteWithContext(chatId: string) {
		if (!threadListQuery) return;
		const currentThreadId = $page.params.threadId;
		if (currentThreadId === chatId) await goto(resolve('/chat'));
		await deleteThreadWithContext({ chatId, deleteContext: true });
		threadListQuery.refresh();
	}

	function handleSidebarToggle() {
		visible = !visible;
	}
</script>

<!-- Show sidebar button (visible only when sidebar is hidden) -->
{#if !visible}
	<Tooltip.Provider delayDuration={150}>
		<div class="fixed top-[12.5%] left-4 z-30">
			<Tooltip.Root delayDuration={150}>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							onclick={handleSidebarToggle}
							class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-white/85 text-slate-500 shadow-sm backdrop-blur-xl transition-all hover:bg-white hover:text-slate-700"
							aria-label="Show sidebar"
						>
							<PanelLeft class="h-5 w-5" />
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="right">Show Sidebar</Tooltip.Content>
			</Tooltip.Root>
		</div>
	</Tooltip.Provider>
{/if}

<Tooltip.Provider delayDuration={150}>
	<main
		class={cn(
			'fixed top-[7.5%] left-4 z-30 flex w-fit flex-col gap-20 transition-all duration-300',
			visible ? 'translate-x-0 opacity-100' : '-translate-x-24 opacity-0 pointer-events-none'
		)}
		aria-hidden={!visible}
	>
		<!-- Capsule 1: New Chat + Agents -->
		<Card.Root
			class="w-fit rounded-full border-white/80 bg-white/85 p-2 shadow-sm backdrop-blur-xl"
		>
			<Card.Content class="flex flex-col gap-3 overflow-visible p-1">
				<!-- Logo / Home -->
				<Tooltip.Root delayDuration={150}>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								onclick={() => goto('/')}
								class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[#904EFF] text-white shadow-md shadow-violet-500/20 transition-all"
								aria-label="Quant Orion"
							>
								<svg
									viewBox="0 0 24 24"
									class="h-5 w-5"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
								>
									<circle cx="12" cy="12" r="4" />
									<path d="M12 12l4 4" />
								</svg>
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="right">Quant Orion</Tooltip.Content>
				</Tooltip.Root>

				<!-- New Chat -->
				<Tooltip.Root delayDuration={150}>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								onclick={handleNewChat}
								class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
								aria-label={filterAgent ? `New Chat with ${filterAgent.name}` : 'New Chat'}
							>
								<Plus class="h-5 w-5" />
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="right">{filterAgent ? `New Chat with ${filterAgent.name}` : 'New Chat'}</Tooltip.Content>
				</Tooltip.Root>

				<!-- Agents -->
				{#each agents as agent (agent.id)}
					<Tooltip.Root delayDuration={150}>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<a
									{...props}
									href={resolve(`/chat?agent=${agent.id}`)}
									class={cn(
										'inline-flex h-11 w-11 items-center justify-center rounded-full transition-all',
										contextAgentId === agent.id
											? 'bg-violet-50 ring-2 ring-violet-300'
											: 'hover:bg-slate-100'
									)}
								>
									<AgentAvatar {agent} size="sm" />
								</a>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="right">{agent.name}</Tooltip.Content>
					</Tooltip.Root>
				{/each}
			</Card.Content>
		</Card.Root>

		<!-- Capsule 2: Recent Conversations -->
		{#if recents.length > 0 || favorites.length > 0}
			<Card.Root
				class="w-fit rounded-full border-white/80 bg-white/85 p-2 shadow-sm backdrop-blur-xl"
			>
				<Card.Content class="flex flex-col gap-3 overflow-visible p-1">
					{#each [...favorites, ...recents].slice(0, 5) as chat (chat.id)}
						{@const previewAgent = agentFor(chat.agentId)}
						<Tooltip.Root delayDuration={150}>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<a
										{...props}
										href={resolve(`/chat/${chat.id}`)}
										class={cn(
											'inline-flex h-11 w-11 items-center justify-center rounded-full transition-all',
											$page.url.pathname === `/chat/${chat.id}`
												? 'bg-violet-50 ring-2 ring-violet-300'
												: 'hover:bg-slate-100'
										)}
									>
										{#if previewAgent}
											<AgentAvatar agent={previewAgent} size="sm" />
										{:else}
											<span class="text-base">{chat.icon}</span>
										{/if}
									</a>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="right">{chat.title}</Tooltip.Content>
						</Tooltip.Root>
					{/each}
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Capsule 3: Settings + Hide Sidebar -->
		<Card.Root
			class="w-fit rounded-full border-white/80 bg-white/85 p-2 shadow-sm backdrop-blur-xl"
		>
			<Card.Content class="flex flex-col gap-3 overflow-visible p-1">
				<!-- Settings -->
				<Tooltip.Root delayDuration={150}>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								onclick={() => (aiSettingsOpen = true)}
								class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
								aria-label="Preferences"
							>
								<Settings class="h-5 w-5" />
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="right">Preferences</Tooltip.Content>
				</Tooltip.Root>

				<!-- Hide Sidebar -->
				<Tooltip.Root delayDuration={150}>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								onclick={handleSidebarToggle}
								class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
								aria-label="Hide sidebar"
							>
								<PanelLeft class="h-5 w-5" />
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="right">Hide Sidebar</Tooltip.Content>
				</Tooltip.Root>
			</Card.Content>
		</Card.Root>
	</main>
</Tooltip.Provider>

<DeleteChatDialog
	bind:open={deleteDialogOpen}
	chatId={deleteTargetId}
	chatTitle={deleteTargetTitle}
	onDeleteChatOnly={handleDeleteChatOnly}
	onDeleteWithContext={handleDeleteWithContext}
/>

<AiSettingsDialog bind:open={aiSettingsOpen} />
