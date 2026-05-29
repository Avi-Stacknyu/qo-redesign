<script lang="ts">
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import ChatSidebar from './ChatSidebar.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tooltip from '$lib/components/shadcn/tooltip/index.js';
	import { cn } from '$lib/utils';
	import { PanelLeft } from '@lucide/svelte';

	let {
		visible = $bindable(true)
	}: {
		visible?: boolean;
	} = $props();

	function handleSidebarToggle() {
		visible = !visible;
	}
</script>

<!-- Show sidebar button (visible only when sidebar is hidden) -->
{#if !visible}
	<Tooltip.Provider delayDuration={150}>
		<div class="absolute top-4 left-4 z-30">
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

	<Sidebar.Provider
		open={visible}
		onOpenChange={(nextVisible) => (visible = nextVisible)}
		class="pointer-events-none absolute inset-0 z-30 hidden min-h-0! w-0! bg-transparent! md:block"
	>
		<main
		class={cn(
			'pointer-events-auto absolute top-4 bottom-4 left-4 z-30 transition-all duration-300 ease-out',
			visible
				? 'translate-x-0 opacity-100'
				: '-translate-x-[calc(var(--sidebar-width)+1.5rem)] opacity-0 pointer-events-none'
		)}
		aria-hidden={!visible}
	>
		<Card.Root
			class="relative h-full overflow-hidden ring-transparent"
		>
			<Card.Content class="h-full p-0">
				<ChatSidebar
					collapsible="none"
					class="h-full rounded-[28px] border border-white/40  shadow-none backdrop-blur-3xl"
				/>
			</Card.Content>
		</Card.Root>
		</main>
	</Sidebar.Provider>
