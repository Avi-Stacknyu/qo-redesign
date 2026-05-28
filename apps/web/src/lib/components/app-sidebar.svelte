<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import * as Collapsible from '$lib/components/shadcn/collapsible/index.js';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import { useSidebar } from '$lib/components/shadcn/sidebar/context.svelte.js';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import type { Agent } from '$lib/remote/agents.remote';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import {
		BookOpen,
		ChevronDown,
		Ellipsis,
		FlaskConical,
		LayoutDashboard,
		PinOff,
		Plus,
		Settings,
		Trash2
	} from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import DashboardTemplateCatalog from './dashboard/DashboardTemplateCatalog.svelte';
	import NavUser from './nav-user.svelte';
	import SidebarLogo from './SidebarLogo.svelte';

	let {
		user,
		agents = [],
		features = [],
		collapsible = 'icon',
		...restProps
	}: {
		user: { name: string; email: string; avatar: string } | null;
		agents?: Agent[];
		features?: string[];
	} & ComponentProps<typeof Sidebar.Root> = $props();

	let pinnedDashboards = $derived(
		dashboard.profiles
			.filter((p) => p.is_pinned)
			.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
	);

	const sidebar = useSidebar();
	let catalogOpen = $state(false);
	let agentsExpanded = $state(false);

	const VISIBLE_AGENT_COUNT = 8;
	let visibleAgents = $derived(agents.slice(0, VISIBLE_AGENT_COUNT));
	let collapsedAgents = $derived(agents.slice(VISIBLE_AGENT_COUNT));

	function handleUnpin(id: string) {
		dashboard.unpinDashboard(id);
	}

	function handleDelete(id: string) {
		const wasActive = dashboard.activeProfileId === id;
		dashboard.deleteProfile(id);
		if (wasActive) goto('/');
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
		<!-- Main — Pinned Dashboards + Knowledge -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>Main</Sidebar.GroupLabel>
			<Sidebar.Menu>
				{#each pinnedDashboards as profile (profile.id)}
					{@const dashUrl = profile.is_default ? '/' : `/dashboard/${profile.id}`}
					{@const isActive = profile.is_default
						? $page.url.pathname === '/'
						: $page.url.pathname === `/dashboard/${profile.id}`}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton {isActive} tooltipContent={profile.profile_name}>
							{#snippet child({ props })}
								<a href={dashUrl} {...props}>
									<LayoutDashboard />
									<span>{profile.profile_name}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
						{#if !profile.is_default}
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Sidebar.MenuAction showOnHover {...props}>
											<Ellipsis />
											<span class="sr-only">More</span>
										</Sidebar.MenuAction>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content
									class="w-44 rounded-lg"
									side={sidebar.isMobile ? 'bottom' : 'right'}
									align={sidebar.isMobile ? 'end' : 'start'}
								>
									<DropdownMenu.Item onclick={() => handleUnpin(profile.id)}>
										<PinOff class="text-muted-foreground" />
										<span>Unpin</span>
									</DropdownMenu.Item>
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										class="text-destructive focus:text-destructive"
										onclick={() => handleDelete(profile.id)}
									>
										<Trash2 class="text-destructive/70" />
										<span>Delete</span>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						{/if}
					</Sidebar.MenuItem>
				{/each}
				{#if features.includes('page:knowledge')}
					<Sidebar.MenuItem>
						{@const isActive = $page.url.pathname.startsWith('/knowledge')}
						<Sidebar.MenuButton {isActive} tooltipContent="Knowledge">
							{#snippet child({ props })}
								<a href="/knowledge" {...props}>
									<BookOpen />
									<span>Knowledge</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/if}
				{#if features.includes('page:tools')}
					<Sidebar.MenuItem>
						{@const isActive = $page.url.pathname.startsWith('/tools')}
						<Sidebar.MenuButton {isActive} tooltipContent="Tools">
							{#snippet child({ props })}
								<a href="/tools" {...props}>
									<FlaskConical />
									<span>Tools</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/if}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent="Add Dashboard" onclick={() => (catalogOpen = true)}>
						{#snippet child({ props })}
							<button type="button" {...props}>
								<Plus />
								<span>Add Dashboard</span>
							</button>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Group>

		<!-- AI — Agents -->
		{#if agents.length > 0 && features.includes('page:chat')}
			<Sidebar.Group>
				<Sidebar.GroupLabel>AI</Sidebar.GroupLabel>
				<Sidebar.Menu>
					{#each visibleAgents as agent (agent.id)}
						{@const isActive =
							$page.url.pathname === '/chat' && $page.url.searchParams.get('agent') === agent.id}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton {isActive} tooltipContent={agent.name}>
								{#snippet child({ props })}
									<a href="/chat?agent={agent.id}" {...props}>
										<AgentAvatar {agent} size="xs" />
										<span>{agent.name}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
					{#if collapsedAgents.length > 0}
						<Collapsible.Root bind:open={agentsExpanded}>
							<Collapsible.Content>
								{#each collapsedAgents as agent (agent.id)}
									{@const isActive =
										$page.url.pathname === '/chat' &&
										$page.url.searchParams.get('agent') === agent.id}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton {isActive} tooltipContent={agent.name}>
											{#snippet child({ props })}
												<a href="/chat?agent={agent.id}" {...props}>
													<AgentAvatar {agent} size="xs" />
													<span>{agent.name}</span>
												</a>
											{/snippet}
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								{/each}
							</Collapsible.Content>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									class="text-muted-foreground"
									onclick={() => (agentsExpanded = !agentsExpanded)}
								>
									<ChevronDown
										class="transition-transform duration-200 {agentsExpanded ? 'rotate-180' : ''}"
									/>
									<span>{agentsExpanded ? 'Show less' : `${collapsedAgents.length} more`}</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						</Collapsible.Root>
					{/if}
				</Sidebar.Menu>
			</Sidebar.Group>
		{/if}
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu class="group-data-[collapsible=icon]:items-center">
			{#if features.includes('page:settings')}
				<Sidebar.MenuItem>
					{@const isActive = $page.url.pathname.startsWith('/preferences')}
					<Sidebar.MenuButton {isActive} tooltipContent="Preferences">
						{#snippet child({ props })}
							<a href="/preferences" {...props}>
								<Settings />
								<span>Preferences</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/if}
			{#if user}
				<Sidebar.MenuItem>
					<NavUser {user} />
				</Sidebar.MenuItem>
			{/if}
		</Sidebar.Menu>
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>

<DashboardTemplateCatalog bind:open={catalogOpen} />
