<script lang="ts">
	import * as Avatar from '$lib/components/shadcn/avatar/index.js';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import { useSidebar } from '$lib/components/shadcn/sidebar/index.js';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { goto } from '$app/navigation';

	let { user }: { user: { name: string; email: string; avatar: string } } = $props();
	const sidebar = useSidebar();
	const resolvedAvatar = $derived(
		!user.avatar
			? null
			: user.avatar.startsWith('/api/avatar')
				? user.avatar
				: user.avatar.startsWith('http')
					? user.avatar
					: '/api/avatar'
	);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Sidebar.MenuButton
				size="lg"
				class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
				{...props}
			>
				<Avatar.Root class="size-8 rounded-lg">
					<Avatar.Image src={resolvedAvatar} alt={user.name} />
					<Avatar.Fallback class="rounded-lg">CN</Avatar.Fallback>
				</Avatar.Root>
				<div
					class="grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden"
				>
					<span class="truncate font-medium">{user.name}</span>
					<span class="truncate text-xs">{user.email}</span>
				</div>
				<ChevronsUpDownIcon class="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
			</Sidebar.MenuButton>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content
		class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
		side={sidebar.isMobile ? 'bottom' : 'right'}
		align="end"
		sideOffset={4}
	>
		<DropdownMenu.Label class="p-0 font-normal">
			<div class="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
				<Avatar.Root class="size-8 rounded-lg">
					<Avatar.Image src={resolvedAvatar} alt={user.name} />
					<Avatar.Fallback class="rounded-lg">CN</Avatar.Fallback>
				</Avatar.Root>
				<div class="grid flex-1 text-start text-sm leading-tight">
					<span class="truncate font-medium">{user.name}</span>
					<span class="truncate text-xs">{user.email}</span>
				</div>
			</div>
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		<DropdownMenu.Item onclick={() => (window.location.href = '/preferences/billing')}>
			<CreditCardIcon />
			Billing
		</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item onclick={() => goto('/logout')}>
			<LogOutIcon />
			Log out
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
