<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import { getThreadList } from '$lib/remote/chat-threads.remote';
	import ChatNavActions from '$lib/components/chat/sidebar/ChatNavActions.svelte';
	import ChatSidebar from '$lib/components/chat/sidebar/ChatSidebar.svelte';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';

	let { children } = $props();

	let sidebarOpen = $state(true);
	let currentThreadId = $state<string | null>(null);
	let isFavorite = $state(false);

	const threadListQuery = browser ? getThreadList() : null;
	const threads = $derived(threadListQuery?.current ?? []);

	$effect(() => {
		const pathname = $page.url.pathname;
		untrack(() => {
			const segments = pathname.split('/');
			currentThreadId = segments.length > 2 && segments[2] !== '' ? segments[2] : null;
		});
	});

	$effect(() => {
		if (currentThreadId && threads.length > 0) {
			const currentThread = threads.find((t) => t.id === currentThreadId);
			isFavorite = currentThread?.favorite ?? false;
		} else {
			isFavorite = false;
		}
	});
</script>

<div class="fixed inset-0 z-[-1] bg-[#f2f4f5] transition-colors duration-500">
	<div
		class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(162,89,255,0.28),rgba(225,201,255,0.15)_34%,transparent_68%)]"
	></div>
	<div class="absolute inset-x-0 top-0 h-36 bg-white/55 blur-3xl"></div>
</div>

<Sidebar.Provider bind:open={sidebarOpen}>
	<ChatSidebar />
	<Sidebar.Inset class="min-w-0 bg-transparent">
		<header
			class="absolute top-0 right-0 left-0 z-20 flex h-14 shrink-0 items-center justify-between border-transparent bg-transparent"
		>
			<div class="flex items-center gap-2 px-3">
				<Sidebar.Trigger class="ml-1 text-muted-foreground hover:text-foreground md:hidden" />
			</div>
			{#if $page.url.pathname !== '/chat'}
				<div class="flex items-center gap-2 px-3">
					<ChatNavActions threadId={currentThreadId} favorite={isFavorite} />
				</div>
			{/if}
		</header>
		<div class="chat-shell flex h-screen flex-col overflow-hidden" class:sidebarOpen={'md:pl-64'}>
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
