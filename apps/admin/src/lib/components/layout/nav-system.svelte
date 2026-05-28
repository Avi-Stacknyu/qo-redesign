<script lang="ts">
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import type { Component } from 'svelte';

	let { items }: { items: { name: string; url: string; icon: Component }[] } = $props();
</script>

<Sidebar.Group class="group-data-[collapsible=icon]:hidden">
	<Sidebar.GroupLabel>System Internal Configuration</Sidebar.GroupLabel>
	<Sidebar.Menu>
		{#each items as item (item.name)}
			<Sidebar.MenuItem>
				<Sidebar.MenuButton>
					{#snippet child({ props })}
						<a {...props} href={item.url}>
							<item.icon />
							<span>{item.name}</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		{/each}
	</Sidebar.Menu>
</Sidebar.Group>
