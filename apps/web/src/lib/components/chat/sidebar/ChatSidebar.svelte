<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import * as Progress from '$lib/components/shadcn/progress/index.js';
	import { Plus, CreditCard, Settings } from '@lucide/svelte';
	import SidebarLogo from '$lib/components/SidebarLogo.svelte';
	import {
		getThreadList,
		getUserCreditBalance,
		toggleThreadFavorite,
		deleteThread
	} from '$lib/remote/chat-threads.remote';
	import { deleteThreadWithContext } from '$lib/remote/chat-context.remote';
	import { getAgents } from '$lib/remote/agents.remote';

	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import ChatNavChats from './ChatNavChats.svelte';
	import DeleteChatDialog from './DeleteChatDialog.svelte';
	import AiSettingsDialog from './AiSettingsDialog.svelte';
	import type { ComponentProps } from 'svelte';

	let { collapsible = 'icon', ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	const threadListQuery = getThreadList();
	const agentsQuery = getAgents();
	const creditsQuery = getUserCreditBalance();

	const allChats = $derived(threadListQuery.current ?? []);
	const agents = $derived(agentsQuery.current ?? []);

	// Auto-derive active agent from URL context:
	// - /chat?agent=<id>  → that agent
	// - /chat/<threadId>  → that thread's agent
	// - /chat             → no agent
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

	// Reset "show all" when navigating to a different context
	$effect(() => {
		if (contextAgentId !== undefined) {
			showAll = false;
		}
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

	const credits = $derived(
		creditsQuery.current ?? { balance: 0, lifetime_purchased: 0, lifetime_spent: 0 }
	);
	const safeBalance = $derived(Number(credits.balance) || 0);
	const safeSpent = $derived(Number(credits.lifetime_spent) || 0);
	const totalCredits = $derived(safeBalance + safeSpent);
	const creditPercent = $derived(
		totalCredits > 0 ? Math.round((safeBalance / totalCredits) * 100) : 0
	);
	const isLoading = $derived(threadListQuery.loading);

	let deleteDialogOpen = $state(false);
	let deleteTargetId = $state('');
	let deleteTargetTitle = $state('');
	let aiSettingsOpen = $state(false);

	function handleNewChat() {
		if (activeFilterId) {
			goto(resolve(`/chat?agent=${activeFilterId}`));
		} else {
			goto(resolve('/chat'));
		}
	}

	async function handleToggleFavorite(chatId: string) {
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
		const currentThreadId = $page.params.threadId;
		if (currentThreadId === chatId) await goto(resolve('/chat'));
		await deleteThread(chatId).updates(
			threadListQuery.withOverride((chats) => chats.filter((c) => c.id !== chatId))
		);
	}

	async function handleDeleteWithContext(chatId: string) {
		const currentThreadId = $page.params.threadId;
		if (currentThreadId === chatId) await goto(resolve('/chat'));
		await deleteThreadWithContext({ chatId, deleteContext: true });
		threadListQuery.refresh();
	}
</script>

<Sidebar.Root
	{collapsible}
	{...restProps}
	class="group/sidebar border-r border-border/10 bg-background/60 backdrop-blur-3xl transition-all duration-500 ease-in-out"
>
	<Sidebar.Header class="px-3 py-3">
		<SidebarLogo />
	</Sidebar.Header>

	<Sidebar.Content>
		<!-- New Chat action -->
		<Sidebar.Group>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						onclick={handleNewChat}
						tooltipContent={filterAgent ? `New Chat with ${filterAgent.name}` : 'New Chat'}
					>
						<Plus />
						<span>{filterAgent ? `New Chat with ${filterAgent.name}` : 'New Chat'}</span>
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Group>

		<!-- Agent icons: visible in both expanded and collapsed state -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>Agents</Sidebar.GroupLabel>
			<Sidebar.Menu>
				{#each agents as agent (agent.id)}
					{@const isActive = contextAgentId === agent.id}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton {isActive} tooltipContent={agent.name}>
							{#snippet child({ props })}
								<a href={resolve(`/chat?agent=${agent.id}`)} {...props}>
									<AgentAvatar {agent} size="xs" />
									<span>{agent.name}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>

		<!-- Active filter indicator -->
		{#if filterAgent}
			<div
				class="flex items-center justify-between px-4 py-1.5 group-data-[collapsible=icon]:hidden"
			>
				<span class="flex items-center gap-1.5 text-[10px] font-medium text-primary/80">
					<AgentAvatar agent={filterAgent} size="sm" />
					Showing {filterAgent.name}
				</span>
				<button
					onclick={() => (showAll = true)}
					class="text-[10px] font-medium text-muted-foreground/60 transition-colors hover:text-foreground"
				>
					Show all
				</button>
			</div>
		{/if}

		{#if favorites.length > 0}
			<Sidebar.Group class="group-data-[collapsible=icon]:hidden">
				<Sidebar.GroupLabel>Favorites</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<ChatNavChats
						chats={favorites.map((c) => ({
							id: c.id,
							name: c.title,
							url: `/chat/${c.id}`,
							emoji: c.icon,
							favorite: true,
							isActive: $page.url.pathname === `/chat/${c.id}`,
							agent: agentFor(c.agentId)
						}))}
						onToggleFavorite={handleToggleFavorite}
						onDelete={handleDeleteClick}
					/>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/if}

		<Sidebar.Group class="group-data-[collapsible=icon]:hidden">
			<Sidebar.GroupLabel>Recents</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<ChatNavChats
					chats={recents.map((c) => ({
						id: c.id,
						name: c.title,
						url: `/chat/${c.id}`,
						emoji: c.icon,
						favorite: false,
						isActive: $page.url.pathname === `/chat/${c.id}`,
						agent: agentFor(c.agentId)
					}))}
					{isLoading}
					onToggleFavorite={handleToggleFavorite}
					onDelete={handleDeleteClick}
				/>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<!-- Credits Card -->
		<div
			class="mx-3 mb-2 flex flex-col gap-2 rounded-lg border bg-sidebar-accent/50 p-3 group-data-[collapsible=icon]:hidden"
		>
			<div class="flex items-center justify-between text-xs font-medium text-muted-foreground/80">
				<span class="flex items-center gap-1.5">
					<CreditCard class="size-3.5" />
					Credits
				</span>
				<span>{creditPercent}%</span>
			</div>
			<Progress.Root value={creditPercent} class="h-1.5 bg-sidebar-border/60" />
			<div class="flex justify-between font-mono text-[10px] text-muted-foreground/60">
				<span>{safeBalance.toLocaleString()} remaining</span>
				<span>of {totalCredits.toLocaleString()}</span>
			</div>
		</div>

		<Sidebar.Menu class="group-data-[collapsible=icon]:items-center">
			<Sidebar.MenuItem>
				<Sidebar.MenuButton tooltipContent="Preferences" onclick={() => (aiSettingsOpen = true)}>
					<Settings />
					<span>Preferences</span>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>

<DeleteChatDialog
	bind:open={deleteDialogOpen}
	chatId={deleteTargetId}
	chatTitle={deleteTargetTitle}
	onDeleteChatOnly={handleDeleteChatOnly}
	onDeleteWithContext={handleDeleteWithContext}
/>

<AiSettingsDialog bind:open={aiSettingsOpen} />
