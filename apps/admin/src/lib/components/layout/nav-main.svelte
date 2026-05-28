<script lang="ts">
	import DashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import MailIcon from '@lucide/svelte/icons/mail';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import type { Component } from 'svelte';
	import { goto } from '$app/navigation';

	let { items }: { items: { title: string; url: string; icon?: Component }[] } = $props();
</script>

<Sidebar.Group>
	<Sidebar.GroupContent class="flex flex-col gap-2">
		<Sidebar.Menu>
			<Sidebar.MenuItem class="flex items-center gap-2">
				<Sidebar.MenuButton
					onclick={() => goto('/')}
					class="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
					tooltipContent="Dashboard"
				>
					<a href="/" class="flex items-center gap-2">
						<DashboardIcon />
						<span>Dashboard</span>
					</a>
				</Sidebar.MenuButton>
				<Button
					size="icon"
					class="size-8 group-data-[collapsible=icon]:opacity-0"
					variant="outline"
				>
					<MailIcon />
					<span class="sr-only">Inbox</span>
				</Button>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
		<Sidebar.Menu>
			{#each items as item (item.title)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent={item.title}>
						{#snippet child({ props })}
							<a {...props} href={item.url}>
								{#if item.icon}
									<item.icon />
								{/if}
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
