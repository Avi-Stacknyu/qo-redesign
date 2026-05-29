<script lang="ts">
	import { Brain, Pin } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import WidgetError from '../WidgetError.svelte';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import { getNotes, type Note } from '$lib/remote/knowledge.remote';
	import type { KnowledgeConfig } from '$lib/types/widgets';

	let { config }: { config: KnowledgeConfig } = $props();

	const notesQuery = getNotes();

	let notes: Note[] = $derived.by(() => {
		let items = Array.isArray(notesQuery.current) ? [...notesQuery.current] : [];

		if (config.category) {
			items = items.filter((note) => note.category === config.category);
		}

		return items.slice(0, config.limit);
	});

	function summarize(value: string, length: number) {
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
			.replace(/\n+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, length);
	}

	function formatDate(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

{#if notesQuery.loading && !notesQuery.current}
	<WidgetSkeleton lines={4} />
{:else if notesQuery.error}
	<WidgetError
		message={notesQuery.error?.message ?? 'Failed to load knowledge notes'}
		onRetry={() => getNotes().refresh()}
	/>
{:else if notes.length === 0}
	<div class="flex min-h-28 flex-col items-center justify-center gap-3 p-4 text-center">
		<div class="rounded-full bg-muted/60 p-3">
			<Brain class="size-6 text-muted-foreground/70" />
		</div>
		<p class="text-sm font-medium text-muted-foreground">No knowledge notes yet</p>
		<p class="max-w-56 text-xs leading-5 text-muted-foreground/80">
			Save notes from chats or create a note in Knowledge to populate this widget.
		</p>
	</div>
{:else if config.viewMode === 'list'}
	<div class="flex flex-col gap-1">
		{#each notes as note (note.id)}
			<a
				href="/knowledge/{note.id}"
				class="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40"
			>
				<div class="mt-0.5 rounded-full bg-muted/60 p-1.5">
					<Brain class="size-3.5 text-muted-foreground" />
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="truncate text-sm font-medium text-foreground">
							{summarize(note.title, 72) || 'Untitled note'}
						</span>
						{#if note.pinned}
							<Pin class="size-3 shrink-0 text-amber-500" />
						{/if}
					</div>
					<p class="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
						{summarize(note.content, 120) || 'No note content yet.'}
					</p>
				</div>
				<span class="shrink-0 text-[11px] text-muted-foreground">
					{formatDate(note.updated || note.created)}
				</span>
			</a>
		{/each}
	</div>
{:else}
	<div class="grid gap-2">
		{#each notes as note (note.id)}
			<a
				href="/knowledge/{note.id}"
				class="rounded-2xl border border-border/50 bg-muted/15 p-3 transition-colors hover:bg-muted/30"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<h4 class="truncate text-sm font-semibold text-foreground">
								{summarize(note.title, 72) || 'Untitled note'}
							</h4>
							{#if note.pinned}
								<Pin class="size-3.5 shrink-0 text-amber-500" />
							{/if}
						</div>
						<p class="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
							{summarize(note.content, 160) || 'No note content yet.'}
						</p>
					</div>
					<span class="shrink-0 text-[11px] text-muted-foreground">
						{formatDate(note.updated || note.created)}
					</span>
				</div>
				<div class="mt-2 flex items-center gap-2">
					{#if note.category}
						<Badge variant="outline" class="max-w-full truncate text-[0.6rem]">
							{note.category}
						</Badge>
					{/if}
					{#if note.agentName}
						<Badge variant="secondary" class="max-w-full truncate text-[0.6rem]">
							{note.agentName}
						</Badge>
					{/if}
				</div>
			</a>
		{/each}
	</div>
{/if}
