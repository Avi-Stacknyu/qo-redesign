<script lang="ts">
	import NoteCard from '$lib/components/knowledge/NoteCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import { getNotes, type Note as KnowledgeNote } from '$lib/remote/knowledge.remote';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import WidgetError from '../WidgetError.svelte';
	import { Brain } from '@lucide/svelte';
    import { goto } from '$app/navigation';

	const INITIAL_LIMIT = 4;

	const notesQuery = getNotes();

	let showAll = $state(false);
	let deletingId = $state<string | null>(null);
	let justPinnedId = $state<string | null>(null);

	let allNotes = $derived(
		Array.isArray(notesQuery.current) ? notesQuery.current : []
	);

	let visibleNotes = $derived(
		showAll ? allNotes : allNotes.slice(0, INITIAL_LIMIT)
	);
</script>

{#if notesQuery.loading && !notesQuery.current}
	<WidgetSkeleton lines={4} />
{:else if notesQuery.error}
	<WidgetError
		message={notesQuery.error?.message ?? 'Failed to load notes'}
		onRetry={() => getNotes().refresh()}
	/>
{:else if allNotes.length === 0}
	<div class="flex min-h-28 flex-col items-center justify-center gap-3 p-4 text-center">
		<div class="rounded-full bg-muted/60 p-3">
			<Brain class="size-6 text-muted-foreground/70" />
		</div>
		<p class="text-sm font-medium text-muted-foreground">No knowledge notes yet</p>
		<p class="max-w-56 text-xs leading-5 text-muted-foreground/80">
			Save notes from chats or create a note in Knowledge to populate this widget.
		</p>
	</div>
{:else}
	<div class="flex flex-col gap-2">
		{#each visibleNotes as note (note.id)}
			<div
				class="group/noterow relative transition-all duration-300 {justPinnedId === note.id
					? 'rounded-lg ring-2 ring-amber-400/60'
					: ''}"
			>
				<NoteCard
					{note}
					onclick={() => goto(`/knowledge/?note=${note.id}`)}
				/>
			</div>
		{/each}

		{#if allNotes.length > INITIAL_LIMIT}
			<div class="flex justify-center border-t border-border/40 pt-2">
				<Button
					variant="ghost"
					size="sm"
					onclick={() => (showAll = !showAll)}
					class="text-xs text-muted-foreground hover:text-foreground"
				>
					{showAll
						? 'Show less'
						: `View ${allNotes.length - INITIAL_LIMIT} more note${allNotes.length - INITIAL_LIMIT === 1 ? '' : 's'}`}
				</Button>
			</div>
		{/if}
	</div>
{/if}