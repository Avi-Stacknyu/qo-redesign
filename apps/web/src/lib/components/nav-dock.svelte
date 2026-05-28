<script lang="ts">
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';
	import { page } from '$app/stores';

	let {
		items,
		class: className,
		...restProps
	}: {
		items: {
			title: string;
			url: string;
			icon?: any;
			isActive?: boolean;
		}[];
		class?: string;
	} & ComponentProps<typeof Sidebar.Group> = $props();

	// Function to check active state based on current URL
	function isItemActive(url: string, manualActive?: boolean) {
		if (manualActive !== undefined) return manualActive;
		// Should rely on page store which is reactive
		const pathname = $page.url.pathname;
		if (url === '/' && pathname === '/') return true;
		if (url !== '/' && pathname.startsWith(url)) return true;
		return false;
	}
</script>

<Sidebar.Group class={cn('group-data-[collapsible=icon]:items-center', className)} {...restProps}>
	<Sidebar.Menu class="gap-1.5 px-3 group-data-[collapsible=icon]:px-0">
		{#each items as item (item.title)}
			{@const active = isItemActive(item.url, item.isActive)}
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					tooltipContent={item.title}
					isActive={active}
					class={cn(
						'relative h-10 w-full overflow-hidden rounded-xl transition-all duration-300 ease-out',
						// Hover state
						'hover:bg-muted/50 hover:text-foreground',
						// Active state
						active
							? 'bg-primary/10 font-semibold text-primary shadow-inner shadow-primary/5'
							: 'text-muted-foreground/80',
						// Collapsed state override
						'group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:rounded-xl! group-data-[collapsible=icon]:p-0!'
					)}
				>
					{#snippet child({ props })}
						<a
							href={item.url}
							{...props}
							class={cn(
								props.class as string,
								'flex w-full items-center gap-3 px-3 group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:px-0!'
							)}
						>
							{#if active}
								<!-- Active Indicator: Glow Pill (Desktop) -->
								<div
									class="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)] transition-all duration-300 group-data-[collapsible=icon]:top-auto group-data-[collapsible=icon]:bottom-1 group-data-[collapsible=icon]:left-1/2 group-data-[collapsible=icon]:h-1.5 group-data-[collapsible=icon]:w-1.5 group-data-[collapsible=icon]:translate-y-0 group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:bg-primary"
								></div>
							{/if}

							{#if item.icon}
								<item.icon
									class={cn(
										'size-4.5 shrink-0 transition-transform duration-300',
										active && 'scale-110 text-primary'
									)}
								/>
							{/if}

							<span
								class="truncate text-sm transition-all duration-300 group-data-[collapsible=icon]:hidden"
								>{item.title}</span
							>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		{/each}
	</Sidebar.Menu>
</Sidebar.Group>
