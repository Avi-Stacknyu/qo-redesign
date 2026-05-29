<script lang="ts">
	import type { Note } from '$lib/remote/knowledge.remote';
	import { toggleNotePin, getNotes } from '$lib/remote/knowledge.remote';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { Loader2, Pin, PinOff } from '@lucide/svelte';

	let {
		note,
		onclick,
		onpin
	}: {
		note: Note;
		onclick: () => void;
		onpin?: (pinned: boolean) => void;
	} = $props();

	function cleanMarkdown(value: string, length = 140) {
		return value
			.replace(/<[^>]*>/g, '')
			.replace(/^#{1,6}\s+/gm, '')
			.replace(/\*\*(.+?)\*\*/g, '$1')
			.replace(/\*(.+?)\*/g, '$1')
			.replace(/~~(.+?)~~/g, '$1')
			.replace(/`{1,3}[^`]*`{1,3}/g, '')
			.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/^[\s]*[-*+>]\s+/gm, '')
			.replace(/^\d+\.\s+/gm, '')
			.replace(/---+/g, '')
			.replace(/\n+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, length);
	}

	let preview = $derived(cleanMarkdown(note.content, 100));
	let title = $derived(cleanMarkdown(note.title, 60) || 'Untitled');
	let pinned = $state(false);
	let pinning = $state(false);
	let dateBadge = $derived.by(() => {
		const date = new Date(note.updated || note.created);
		if (Number.isNaN(date.getTime())) return '';
		const day = String(date.getDate()).padStart(2, '0');
		const month = date.toLocaleString('en', { month: 'short' }).toUpperCase();
		return `${day} ${month}`;
	});

	$effect(() => {
		pinned = note.pinned;
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		onclick();
	}

	async function handleTogglePin(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (pinning) return;

		const next = !pinned;
		pinned = next;
		pinning = true;

		try {
			await toggleNotePin({ noteId: note.id, pinned: next }).updates(getNotes());
			onpin?.(next);
		} catch {
			pinned = !next;
		} finally {
			pinning = false;
		}
	}
</script>

<Card
	role="button"
	tabindex={0}
	{onclick}
	onkeydown={handleKeydown}
	class="group/note cursor-pointer border-0 bg-white p-0 shadow-none ring-[#F6F6F6] transition-colors hover:bg-[#FAFAFA] focus-visible:ring-3 focus-visible:ring-violet-400/25 focus-visible:outline-none"
>
	<CardContent class="flex items-start gap-3 px-4 py-3">
		<div class="min-w-0 flex-1">
			<h2 class="line-clamp-1 text-sm font-semibold text-[#83899F] font-Inter">{title}</h2>
			<p class="font-Inter mt-1 line-clamp-2 text-xs leading-5 text-[#83899F]/70">
				{preview || 'No note content yet.'}
			</p>
		</div>

	<div class="flex min-w-[72px] shrink-0 flex-col items-end justify-between self-stretch">
	<button
		type="button"
		onclick={handleTogglePin}
		class={pinned
			? 'flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600 transition-colors hover:bg-amber-200'
			: 'flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'}
		aria-label={pinned ? 'Unpin note' : 'Pin note'}
		aria-pressed={pinned}
		title={pinned ? 'Unpin' : 'Pin'}
		disabled={pinning}
	>
		{#if pinning}
			<Loader2 class="size-3.5 animate-spin" />
		{:else if pinned}
			<PinOff class="size-3.5" />
		{:else}
			<Pin class="size-3.5 rotate-45" />
		{/if}
	</button>

	<div class="flex flex-col items-end gap-1">
		{#if dateBadge}
			<span class="text-[11px] font-medium text-muted-foreground">
				{dateBadge}
			</span>
		{/if}

		<div class="min-h-[20px] flex items-center">
			{#if note.category}
				<span
					class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground font-Inter"
				>
					{note.category}
				</span>
			{/if}
		</div>
	</div>
</div>
	</CardContent>
</Card>
