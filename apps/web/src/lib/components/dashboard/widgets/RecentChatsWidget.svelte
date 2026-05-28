<script lang="ts">
	import { MessageSquare, Bot } from '@lucide/svelte';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import WidgetError from '../WidgetError.svelte';
	import { loadRecentChats } from '$lib/remote/widget-data.remote';
	import type { RecentChatsConfig } from '$lib/types/widgets';

	type RecentChat = {
		id: string;
		title: string | null;
		source: string | null;
		created: string | null;
		updated: string | null;
		agentId: string | null;
		agentName: string | null;
		agentAvatar: string | null;
	};

	let { config }: { config: RecentChatsConfig } = $props();

	const chatsQuery = loadRecentChats();

	let chats: RecentChat[] = $derived.by(() => {
		const rows = chatsQuery.current;
		return (Array.isArray(rows) ? rows : []).slice(0, config.limit);
	});

	function relativeTime(dateStr: string): string {
		const diffMs = Date.now() - new Date(dateStr).getTime();
		const mins = Math.round(diffMs / 60000);
		const hrs = Math.round(diffMs / 3600000);
		const days = Math.round(diffMs / 86400000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		if (hrs < 24) return `${hrs}h ago`;
		if (days === 1) return 'yesterday';
		return `${days}d ago`;
	}
</script>

{#if chatsQuery.loading && !chatsQuery.current}
	<WidgetSkeleton lines={3} />
{:else if chatsQuery.error}
	<WidgetError
		message={chatsQuery.error?.message ?? 'Failed to load chats'}
		onRetry={() => loadRecentChats().refresh()}
	/>
{:else if chats.length === 0}
	<div class="flex min-h-24 flex-col items-center justify-center gap-2 p-4">
		<MessageSquare class="size-6 text-muted-foreground/50" />
		<p class="text-sm text-muted-foreground">No recent chats</p>
	</div>
{:else}
	<div class="flex flex-col gap-0.5">
		{#each chats as chat (chat.id)}
			<a
				href="/chat/{chat.id}"
				class="group flex items-start gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted/40"
			>
				<div class="mt-0.5 rounded-full bg-muted/60 p-1.5">
					<MessageSquare class="size-3.5 text-muted-foreground" />
				</div>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="truncate text-sm leading-tight text-foreground">
						{chat.title || 'Untitled Chat'}
					</span>
					<div class="flex items-center gap-1.5">
						{#if config.showAgentName && chat.agentName}
							<Badge variant="secondary" class="h-4 gap-0.5 px-1.5 text-[0.55rem]">
								<Bot class="size-2.5" />
								{chat.agentName}
							</Badge>
							<span class="text-xs text-muted-foreground/40">&middot;</span>
						{/if}
						<span class="text-xs text-muted-foreground"
							>{relativeTime(chat.updated?.toString() ?? '')}</span
						>
					</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
