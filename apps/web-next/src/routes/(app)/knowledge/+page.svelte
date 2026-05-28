<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoteCard from '$lib/components/knowledge/NoteCard.svelte';
	import { createNote, type Note } from '$lib/remote/knowledge.remote';
	import {
		BookOpen,
		ChevronLeft,
		ChevronRight,
		Ellipsis,
		ListFilter,
		Plus,
		Search,
		Star,
		X
	} from '@lucide/svelte';

	let { data } = $props();

	let search = $state('');
	let activeFilter = $state('all');
	let filtersOpen = $state(false);
	let creating = $state(false);
	let selectedNoteId = $state<string | null>(null);
	let copied = $state(false);

	let notes = $derived(data.notes as Note[]);

	let filtered = $derived.by(() => {
		let result = notes;

		if (activeFilter === 'pinned') {
			result = result.filter((note) => note.pinned);
		} else if (activeFilter === 'user_manual') {
			result = result.filter((note) => note.source === 'user_manual');
		} else if (activeFilter === 'user_chat_save') {
			result = result.filter((note) => note.source === 'user_chat_save');
		} else if (activeFilter === 'agent_tool') {
			result = result.filter((note) => note.source === 'agent_tool');
		} else if (activeFilter !== 'all') {
			result = result.filter((note) => note.category === activeFilter);
		}

		if (search.trim()) {
			const query = search.trim().toLowerCase();
			result = result.filter(
				(note) =>
					note.title.toLowerCase().includes(query) ||
					note.content.toLowerCase().includes(query) ||
					note.tags.some((tag) => tag.toLowerCase().includes(query))
			);
		}

		return result;
	});

	let selectedNote = $derived.by(() => {
		if (selectedNoteId) {
			const match = filtered.find((note) => note.id === selectedNoteId);
			if (match) return match;
		}

		return filtered[0] ?? notes[0] ?? null;
	});

	let selectedIndex = $derived(
		selectedNote ? filtered.findIndex((note) => note.id === selectedNote?.id) : -1
	);

	let sourceFilters = $derived([
		{ key: 'all', label: 'All' },
		{ key: 'pinned', label: 'Pinned' },
		{ key: 'user_manual', label: 'Manual' },
		{ key: 'user_chat_save', label: 'Chat' },
		{ key: 'agent_tool', label: 'Agent' }
	]);

	function cleanMarkdown(value: string, length = 900) {
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
			.replace(/\n{3,}/g, '\n\n')
			.trim()
			.slice(0, length);
	}

	function noteTitle(note: Note | null) {
		if (!note) return 'Untitled';
		return cleanMarkdown(note.title, 120) || 'Untitled';
	}

	function noteBody(note: Note | null) {
		if (!note) return '';
		return cleanMarkdown(note.content || 'No note content yet.', 1200) || 'No note content yet.';
	}

	function noteTags(note: Note | null) {
		if (!note) return [];
		const tags = note.tags.length ? note.tags : [note.category, note.source].filter(Boolean);
		return tags.length ? tags.slice(0, 5) : ['Add Tag'];
	}

	function selectFilter(filter: string) {
		activeFilter = filter;
		filtersOpen = false;
	}

	function selectNote(note: Note) {
		selectedNoteId = note.id;
	}

	function moveSelection(direction: -1 | 1) {
		if (!filtered.length) return;
		const current = selectedIndex >= 0 ? selectedIndex : 0;
		const nextIndex = Math.min(filtered.length - 1, Math.max(0, current + direction));
		selectedNoteId = filtered[nextIndex]?.id ?? null;
	}

	async function handleCreate() {
		creating = true;
		try {
			const note = await createNote({
				title: 'Untitled',
				content: '',
				category:
					activeFilter !== 'all' &&
					activeFilter !== 'pinned' &&
					!['user_manual', 'user_chat_save', 'agent_tool'].includes(activeFilter)
						? activeFilter
						: ''
			});
			await goto(`/knowledge/${note.id}`);
		} finally {
			creating = false;
		}
	}

	async function shareSelected() {
		if (!selectedNote || !browser) return;
		const url = `${window.location.origin}/knowledge/${selectedNote.id}`;
		if (navigator.share) {
			await navigator.share({ title: noteTitle(selectedNote), url }).catch(() => undefined);
		} else if (navigator.clipboard) {
			await navigator.clipboard.writeText(url).catch(() => undefined);
			copied = true;
			window.setTimeout(() => (copied = false), 1500);
		}
	}
</script>

<svelte:head>
	<title>Knowledge</title>
</svelte:head>

<div class="flex w-full flex-col gap-4 xl:flex-row">
	<section class="w-full xl:max-w-[430px]">
		<Card class="flex max-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden border-0 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-0 backdrop-blur-xl">
			<CardContent class="flex min-h-0 flex-1 flex-col gap-5 p-1">
				<div class="flex flex-col gap-4">
					<div class="flex items-center justify-between gap-3">
						<div>
							<h1 class="text-2xl font-bold tracking-tight text-[#1F1F1F]">Recent Notes</h1>
							<p class="text-sm text-muted-foreground">{filtered.length} visible</p>
						</div>

						<div class="flex items-center gap-2">
							<Button
								variant="outline"
								class="rounded-full border-muted bg-white px-4 py-4 text-base font-medium text-muted-foreground shadow-2xs hover:bg-gray-200"
								onclick={() => (filtersOpen = !filtersOpen)}
							>
								Filter
								<ListFilter class="ml-2 h-4 w-4" />
							</Button>

							<Button
								variant="secondary"
								size="icon"
								class="rounded-full bg-white shadow-sm"
								onclick={handleCreate}
								disabled={creating}
								aria-label="New note"
							>
								<Plus class="size-5" />
							</Button>
						</div>
					</div>

					<div class="relative w-full">
						<Search class="absolute top-1/2 left-5 -translate-y-1/2 text-muted-foreground" size={22} />
						<Input
							type="text"
							placeholder="Search"
							class="h-10 rounded-full border-0 bg-muted pr-10 pl-14 text-lg text-muted-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
							bind:value={search}
						/>
						{#if search}
							<button
								type="button"
								onclick={() => (search = '')}
								class="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								aria-label="Clear search"
							>
								<X class="size-4" />
							</button>
						{/if}
					</div>

					{#if filtersOpen}
						<div class="flex flex-wrap gap-2">
							{#each sourceFilters as filter (filter.key)}
								<Button
									type="button"
									variant={activeFilter === filter.key ? 'default' : 'outline'}
									class="h-8 rounded-full px-3 text-xs"
									onclick={() => selectFilter(filter.key)}
								>
									{filter.label}
								</Button>
							{/each}

							{#each data.categories as category (category.category)}
								<Button
									type="button"
									variant={activeFilter === category.category ? 'default' : 'outline'}
									class="h-8 rounded-full bg-white px-3 text-xs"
									onclick={() => selectFilter(category.category)}
								>
									{category.category}
								</Button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="min-h-0 flex-1 overflow-y-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{#if notes.length === 0}
						<div class="flex min-h-80 flex-col items-center justify-center px-6 text-center">
							<div class="mb-4 flex size-14 items-center justify-center rounded-full bg-muted/40">
								<BookOpen class="size-6 text-muted-foreground/50" />
							</div>
							<h2 class="mb-1 text-base font-medium text-foreground">No notes yet</h2>
							<p class="mb-6 max-w-xs text-sm text-muted-foreground/70">
								Start building your knowledge base. Notes saved from chats will appear here too.
							</p>
							<Button onclick={handleCreate} disabled={creating} class="rounded-full">
								<Plus class="mr-2 size-4" />
								Create Note
							</Button>
						</div>
					{:else if filtered.length === 0}
						<div class="flex min-h-80 flex-col items-center justify-center px-6 text-center">
							<p class="mb-3 text-sm text-muted-foreground/70">No notes match this filter.</p>
							<Button
								variant="ghost"
								onclick={() => {
									activeFilter = 'all';
									search = '';
								}}
							>
								Show all notes
							</Button>
						</div>
					{:else}
						<div class="flex flex-col gap-4 pb-1">
							{#each filtered as note (note.id)}
								<div class={selectedNote?.id === note.id ? 'rounded-3xl ring-2 ring-violet-400/20' : ''}>
									<NoteCard {note} onclick={() => selectNote(note)} />
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</CardContent>
		</Card>
	</section>

	<section class="min-w-0 flex-1">
		{#if selectedNote}
			<Card class="flex min-h-[calc(100vh-4rem)] w-full flex-col gap-6 border-0 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-0 backdrop-blur-xl">
				<section class="flex w-full flex-wrap items-center justify-between gap-4">
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-4 text-[#83899F]">
							<Button
								variant="ghost"
								size="icon"
								class="rounded-full"
								onclick={() => moveSelection(-1)}
								disabled={selectedIndex <= 0}
								aria-label="Previous note"
							>
								<ChevronLeft size={34} />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="rounded-full"
								onclick={() => moveSelection(1)}
								disabled={selectedIndex === -1 || selectedIndex >= filtered.length - 1}
								aria-label="Next note"
							>
								<ChevronRight size={34} />
							</Button>
						</div>
						<h2 class="text-lg font-semibold text-[#83899F]">
							{selectedNote.category || 'Knowledge Note'}
						</h2>
					</div>

					<div class="flex items-center gap-2">
						<Button variant="secondary" class="rounded-2xl px-6 py-5 text-lg" onclick={shareSelected}>
							{copied ? 'Copied' : 'Share'}
						</Button>
						<Star color="white" fill={selectedNote.pinned ? '#FFCC00' : 'transparent'} size={36} />
						<Button
							variant="ghost"
							size="icon"
							class="rounded-full"
							onclick={() => goto(`/knowledge/${selectedNote.id}`)}
							aria-label="Open note editor"
						>
							<Ellipsis size={36} />
						</Button>
					</div>
				</section>

				<img src="/images/rainbow.png" alt="Knowledge cover" class="max-h-60 w-full rounded-2xl object-cover" />

				<section class="flex flex-col gap-5">
					<h2 class="font-Inter text-4xl font-bold text-[#83899F]">
						{noteTitle(selectedNote)}
					</h2>
					<p class="font-Inter whitespace-pre-line text-lg font-normal text-[#83899F]">
						{noteBody(selectedNote)}
					</p>
				</section>

				<section class="flex flex-col gap-4">
					<h3 class="font-Inter text-2xl font-semibold text-[#83899F]">Tags and Source</h3>
					<div class="flex flex-wrap gap-3">
						{#each noteTags(selectedNote) as tag (tag)}
							<Button
								variant="secondary"
								class="flex w-fit gap-4 rounded-full border-2 border-dashed border-muted bg-white p-5 text-lg font-medium text-muted-foreground"
							>
								{tag}
							</Button>
						{/each}
					</div>
				</section>

				<CardHeader class="mt-auto px-0 pt-4">
					<CardTitle class="font-Inter text-base font-normal text-[#83899F]">
						Open the note to edit full content, categories, tags, and memory settings.
					</CardTitle>
				</CardHeader>
			</Card>
		{:else}
			<Card class="flex min-h-[calc(100vh-4rem)] items-center justify-center border-0 bg-white p-10 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-0">
				<CardContent class="max-w-sm space-y-4">
					<BookOpen class="mx-auto size-10 text-muted-foreground/40" />
					<h2 class="text-2xl font-semibold text-[#83899F]">Knowledge is empty</h2>
					<p class="text-muted-foreground">Create a note or save an answer from chat to start building this workspace.</p>
					<Button onclick={handleCreate} disabled={creating} class="rounded-full">
						<Plus class="mr-2 size-4" />
						Create Note
					</Button>
				</CardContent>
			</Card>
		{/if}
	</section>
</div>