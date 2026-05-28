<script lang="ts">
	import * as Sheet from '$lib/components/shadcn/sheet';
	import { ScrollArea } from '$lib/components/shadcn/scroll-area';
	import { Skeleton } from '$lib/components/shadcn/skeleton';
	import { Badge } from '$lib/components/shadcn/badge';
	import type { ChatMessageRow } from '@repo/db/types';

	let {
		open = $bindable(false),
		messagesPromise,
		title
	} = $props<{
		open: boolean;
		messagesPromise: Promise<ChatMessageRow[]>;
		title: string;
	}>();
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="w-[400px] sm:w-[540px]">
		<Sheet.Header>
			<Sheet.Title>Chat History: {title}</Sheet.Title>
			<Sheet.Description>View the conversation history for this session.</Sheet.Description>
		</Sheet.Header>
		<div class="mt-4 h-[calc(100vh-120px)]">
			<ScrollArea class="h-full pr-4">
				{#await messagesPromise}
					<div class="space-y-4">
						<Skeleton class="h-12 w-3/4" />
						<Skeleton class="h-12 w-1/2" />
						<Skeleton class="h-12 w-5/6" />
					</div>
				{:then messages}
					{#if messages.length === 0}
						<div class="py-8 text-center text-muted-foreground">
							No messages found in this chat.
						</div>
					{:else}
						<div class="space-y-4">
							{#each messages as msg}
								<div
									class="flex flex-col gap-1 rounded-lg border p-3 {msg.role === 'user'
										? 'bg-muted/50'
										: 'bg-background'}"
								>
									<div class="flex items-center justify-between">
										<Badge variant={msg.role === 'user' ? 'default' : 'outline'} class="capitalize">
											{msg.role}
										</Badge>
										<span class="text-xs text-muted-foreground">
											{new Date(msg.created).toLocaleString()}
										</span>
									</div>
									<div class="prose mt-2 text-sm dark:prose-invert">
										{@html msg.message}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{:catch error}
					<div class="text-destructive">
						Error loading messages: {error.message}
					</div>
				{/await}
			</ScrollArea>
		</div>
	</Sheet.Content>
</Sheet.Root>
