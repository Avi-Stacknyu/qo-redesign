<script lang="ts">
	import type { Note } from '$lib/remote/knowledge.remote';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Pin, Bot, MessageSquare, Pencil } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';

	let {
		note,
		onclick
	}: {
		note: Note;
		onclick: () => void;
	} = $props();

	/** Strip markdown syntax for clean preview text */
	let preview = $derived(
		note.content
			.replace(/<[^>]*>/g, '') // strip any residual HTML
			.replace(/^#{1,6}\s+/gm, '') // headings
			.replace(/\*\*(.+?)\*\*/g, '$1') // bold
			.replace(/\*(.+?)\*/g, '$1') // italic
			.replace(/~~(.+?)~~/g, '$1') // strikethrough
			.replace(/`{1,3}[^`]*`{1,3}/g, '') // inline/block code
			.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links/images
			.replace(/^[\s]*[-*+>]\s+/gm, '') // list items, blockquotes
			.replace(/^\d+\.\s+/gm, '') // ordered list items
			.replace(/---+/g, '') // horizontal rules
			.replace(/\n+/g, ' ') // newlines to spaces
			.replace(/\s+/g, ' ') // collapse whitespace
			.trim()
			.slice(0, 120)
	);

	let timeAgo = $derived(formatDistanceToNow(new Date(note.updated), { addSuffix: true }));
</script>

<button
	type="button"
	{onclick}
	class="group flex w-full items-start gap-3 border-b border-border/15 px-4 py-3 text-left
		transition-colors duration-150 hover:bg-accent/40 active:bg-accent/60"
>
	<!-- Pin indicator -->
	<div class="mt-0.5 w-4 shrink-0">
		{#if note.pinned}
			<Pin class="size-3.5 rotate-45 text-amber-500/80" />
		{/if}
	</div>

	<!-- Content -->
	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<h3 class="truncate text-sm font-medium text-foreground">
				{note.title
					.replace(/^#{1,6}\s+/gm, '')
					.replace(/\*\*(.+?)\*\*/g, '$1')
					.replace(/\*(.+?)\*/g, '$1')
					.replace(/`([^`]+)`/g, '$1')
					.trim()}
			</h3>
			{#if note.tags.length > 0}
				<div class="hidden items-center gap-1 sm:flex">
					{#each note.tags.slice(0, 2) as tag}
						<Badge variant="secondary" class="px-1 py-0 text-[9px] font-normal">{tag}</Badge>
					{/each}
				</div>
			{/if}
		</div>
		{#if preview}
			<p class="mt-0.5 truncate text-xs text-muted-foreground/60">{preview}</p>
		{/if}
	</div>

	<!-- Meta -->
	<div class="flex shrink-0 flex-col items-end gap-1 pt-0.5">
		<span class="text-[10px] text-muted-foreground/50">{timeAgo}</span>
		<div class="flex items-center gap-1.5">
			{#if note.category}
				<Badge variant="outline" class="px-1 py-0 text-[9px] font-normal">{note.category}</Badge>
			{/if}
			{#if note.source === 'user_chat_save'}
				<MessageSquare class="size-3 text-muted-foreground/40" />
			{:else if note.source === 'agent_tool'}
				<Bot class="size-3 text-muted-foreground/40" />
			{:else}
				<Pencil class="size-3 text-muted-foreground/40" />
			{/if}
		</div>
	</div>
</button>
