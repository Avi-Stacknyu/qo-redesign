<script lang="ts">
	import { useSidebar } from '$lib/components/shadcn/sidebar/context.svelte.js';
	import { ChevronsRight } from '@lucide/svelte';

	let { href = '/' }: { href?: string } = $props();

	const sidebar = useSidebar();
</script>

<div
	class="group/logo flex items-center gap-2.5 transition-all duration-300 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
>
	<!-- Logo Mark — in collapsed state, hover swaps to expand icon -->
	<button
		type="button"
		aria-label="Toggle Sidebar"
		onclick={(e) => {
			if (sidebar.state === 'collapsed') {
				e.preventDefault();
				sidebar.toggle();
			} else {
				window.location.href = href;
			}
		}}
		class="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 transition-all duration-200"
	>
		<!-- Default logo icon -->
		<svg
			viewBox="0 0 24 24"
			class="size-4.5 text-primary transition-opacity duration-200 group-data-[collapsible=icon]:group-hover/logo:opacity-0"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 12l4 4" />
		</svg>
		<!-- Expand icon — overlaid, visible only on hover in collapsed state -->
		<ChevronsRight
			class="absolute size-4 text-primary opacity-0 transition-opacity duration-200 group-data-[collapsible=icon]:group-hover/logo:opacity-100"
		/>
	</button>

	<!-- Logo Text + Collapse button (expanded state only) -->
	<div
		class="flex flex-1 items-center overflow-hidden transition-all duration-300 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0"
	>
		<a {href} class="flex min-w-0 flex-col">
			<span class="truncate text-sm font-bold tracking-tight text-sidebar-foreground"
				>Quant Orion</span
			>
			<span class="truncate text-[10px] font-medium text-sidebar-foreground/50">Enterprise</span>
		</a>
		<button
			type="button"
			aria-label="Collapse Sidebar"
			onclick={sidebar.toggle}
			class="ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
		>
			<ChevronsRight class="size-4 rotate-180" />
		</button>
	</div>
</div>
