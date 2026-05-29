<script lang="ts">
	import { page } from '$app/stores';
	import { SIDEBAR_WIDTH } from '$lib/components/shadcn/sidebar/constants';
	import MainSidebar from '$lib/main-sidebar.svelte';
	import { cn } from '$lib/utils';

	let { children, data } = $props();

	let sidebarOpen = $state(true);
</script>

<div class="fixed inset-0 z-[-1] bg-[#f2f4f5] transition-colors duration-500">
	<div
		class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(162,89,255,0.28),rgba(225,201,255,0.15)_34%,transparent_68%)]"
	></div>
	<div class="absolute inset-x-0 top-0 h-36 bg-white/55 blur-3xl"></div>
</div>


<div class="relative h-screen" style={`--chat-sidebar-width: ${SIDEBAR_WIDTH};`}>
	<MainSidebar mode="chat" features={data.features} user={$page.data.user} bind:visible={sidebarOpen} />

	<div
		class={cn(
			'chat-shell flex h-full flex-col overflow-hidden bg-transparent transition-[padding-left] duration-300',
			sidebarOpen ? 'pl-4 md:pl-[calc(var(--chat-sidebar-width)+1rem)]' : 'pl-14'
		)}
	>
		{@render children()}
	</div>
</div>
