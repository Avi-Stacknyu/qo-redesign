<script lang="ts">
	import type { Note } from '$lib/remote/knowledge.remote';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { EllipsisVertical, Pin } from '@lucide/svelte';

	let {
		note,
		onclick
	}: {
		note: Note;
		onclick: () => void;
	} = $props();

	function cleanMarkdown(value: string, length = 140) {
		return value
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
			.slice(0, length);
	}

	let preview = $derived(cleanMarkdown(note.content));
	let title = $derived(cleanMarkdown(note.title, 80) || 'Untitled');
	let dateBadge = $derived.by(() => {
		const date = new Date(note.updated || note.created);
		if (Number.isNaN(date.getTime())) return '';
		const day = String(date.getDate()).padStart(2, '0');
		const month = date.toLocaleString('en', { weekday: 'short' }).toUpperCase();
		return `${day} ${month}`;
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		onclick();
	}
</script>

<Card
	role="button"
	tabindex={0}
	{onclick}
	onkeydown={handleKeydown}
	class="group/note cursor-pointer border-0 bg-white p-0 shadow-none ring-[#F6F6F6] transition-colors hover:bg-[#FAFAFA] focus-visible:ring-3 focus-visible:ring-violet-400/25 focus-visible:outline-none"
>
	<CardContent class="relative flex flex-col gap-4 p-4">
		<div class="flex items-center gap-3 pr-10">
			{#if dateBadge}
				<span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
					{dateBadge}
				</span>
			{/if}

			{#if note.category}
				<span class="rounded-full bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
					{note.category}
				</span>
			{/if}

			{#if note.pinned}
				<Pin class="size-4 shrink-0 rotate-45 text-violet-500" />
			{/if}
		</div>

		<div class="flex flex-col gap-4">
			<h2 class="line-clamp-2 text-lg font-semibold text-[#83899F]">{title}</h2>

			<p class="font-Inter line-clamp-3 text-base leading-6 font-normal text-[#83899F]">
				{preview || 'No note content yet.'}
			</p>
		</div>

		<Button
			size="icon"
			variant="ghost"
			class="absolute top-3 right-3 h-9 w-9 cursor-pointer rounded-full text-muted-foreground hover:bg-gray-100"
			tabindex={-1}
			aria-label="Open note"
		>
			<EllipsisVertical class="h-4 w-4" />
		</Button>
	</CardContent>
</Card>
