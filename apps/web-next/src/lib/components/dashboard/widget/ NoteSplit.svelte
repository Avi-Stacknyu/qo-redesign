<script lang="ts">
	import Note from './Note.svelte';
	import NoteView from './NoteView.svelte';

	type NoteType = {
		id: number;
		title: string;
		description: string;
		date?: string;
		category?: string;
		tags?: string[];
	};

	let {
		title = 'Recent Notes',
		notes,
		showSearch = true,
		showFilter = true,
		showMenu = true,
		showDate = true,
		showCategory = true
	}: {
		title?: string;
		notes: NoteType[];
		showSearch?: boolean;
		showFilter?: boolean;
		showMenu?: boolean;
		showDate?: boolean;
		showCategory?: boolean;
	} = $props();

	let activeNote = $state<NoteType | null>(null);

	$effect(() => {
		if (!activeNote || !notes.some((note) => note.id === activeNote?.id)) {
			activeNote = notes[0] ?? null;
		}
	});
</script>

<div class="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
	<div class="min-w-0">
		<Note
			{title}
			{notes}
			{showSearch}
			{showFilter}
			{showMenu}
			{showDate}
			{showCategory}
			selectedNoteId={activeNote?.id ?? null}
			onSelect={(note) => (activeNote = note)}
		/>
	</div>

	<div class="min-w-0">
		{#if activeNote}
			<NoteView note={activeNote} />
		{/if}
	</div>
</div>