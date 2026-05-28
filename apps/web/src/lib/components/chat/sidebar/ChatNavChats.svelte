<script lang="ts">
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import { useSidebar } from '$lib/components/shadcn/sidebar/index.js';
	import { Ellipsis, Trash2, Star, StarOff } from '@lucide/svelte';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';

	let {
		chats,
		isLoading = false,
		onToggleFavorite,
		onDelete
	}: {
		chats: {
			id: string;
			name: string;
			url: string;
			emoji: string;
			favorite?: boolean;
			isActive?: boolean;
			agent?: { id: string; name: string; avatar_url?: string | null };
		}[];
		isLoading?: boolean;
		onToggleFavorite?: (id: string) => void;
		onDelete?: (id: string) => void;
	} = $props();

	const sidebar = useSidebar();
</script>

<div class="group-data-[collapsible=icon]:hidden">
	<Sidebar.Menu>
		{#if chats.length === 0 && !isLoading}
			<div class="px-3 py-4 text-center text-xs text-muted-foreground/50">No chats yet.</div>
		{:else}
			{#each chats as item (item.id)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						isActive={item.isActive}
						class="transition-colors hover:bg-sidebar-accent/50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
					>
						{#snippet child({ props })}
							<a href={item.url} title={item.name} {...props}>
								{#if item.agent}
									<AgentAvatar agent={item.agent} size="sm" />
								{/if}
								<span class="truncate text-sm font-medium">{item.name}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
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
							class="w-48 rounded-lg"
							side={sidebar.isMobile ? 'bottom' : 'right'}
							align={sidebar.isMobile ? 'end' : 'start'}
						>
							{#if onToggleFavorite}
								<DropdownMenu.Item onclick={() => onToggleFavorite(item.id)}>
									{#if item.favorite}
										<StarOff class="text-muted-foreground" /><span>Remove from Favorites</span>
									{:else}
										<Star class="text-muted-foreground" /><span>Add to Favorites</span>
									{/if}
								</DropdownMenu.Item>
								<DropdownMenu.Separator />
							{/if}
							{#if onDelete}
								<DropdownMenu.Item onclick={() => onDelete(item.id)}>
									<Trash2 class="text-muted-foreground" /><span>Delete</span>
								</DropdownMenu.Item>
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</Sidebar.MenuItem>
			{/each}
		{/if}
	</Sidebar.Menu>
</div>
