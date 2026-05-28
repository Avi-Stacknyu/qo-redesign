<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Plus,
		Search,
		Pin,
		BookOpen,
		FolderOpen,
		Inbox,
		Bot,
		MessageSquare,
		Pencil,
		X,
		SlidersHorizontal
	} from '@lucide/svelte';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { ScrollArea } from '$lib/components/shadcn/scroll-area/index.js';
	import * as Sheet from '$lib/components/shadcn/sheet/index.js';
	import NoteCard from '$lib/components/knowledge/NoteCard.svelte';
	import { createNote } from '$lib/remote/knowledge.remote';
	import type { Note } from '$lib/remote/knowledge.remote';

	let { data } = $props();

	let search = $state('');
	let activeFilter = $state<string>('all');
	let creating = $state(false);
	let mobileFilterOpen = $state(false);

	let filtered = $derived.by(() => {
		let result: Note[] = data.notes;

		if (activeFilter === 'pinned') {
			result = result.filter((n) => n.pinned);
		} else if (activeFilter === 'user_manual') {
			result = result.filter((n) => n.source === 'user_manual');
		} else if (activeFilter === 'user_chat_save') {
			result = result.filter((n) => n.source === 'user_chat_save');
		} else if (activeFilter === 'agent_tool') {
			result = result.filter((n) => n.source === 'agent_tool');
		} else if (activeFilter !== 'all') {
			result = result.filter((n) => n.category === activeFilter);
		}

		if (search.trim()) {
			const q = search.trim().toLowerCase();
			result = result.filter(
				(n) =>
					n.title.toLowerCase().includes(q) ||
					n.content.toLowerCase().includes(q) ||
					n.tags.some((t) => t.toLowerCase().includes(q))
			);
		}

		return result;
	});

	let pinnedCount = $derived(data.notes.filter((n) => n.pinned).length);

	let activeFilterLabel = $derived.by(() => {
		if (activeFilter === 'all') return 'All Notes';
		if (activeFilter === 'pinned') return 'Pinned';
		if (activeFilter === 'user_manual') return 'Manual';
		if (activeFilter === 'user_chat_save') return 'From Chat';
		if (activeFilter === 'agent_tool') return 'By Agent';
		return activeFilter;
	});

	function selectFilter(filter: string) {
		activeFilter = filter;
		mobileFilterOpen = false;
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
</script>

{#snippet sidebarNav()}
	<nav class="flex flex-col gap-0.5 p-2">
		<!-- All notes -->
		<button
			type="button"
			onclick={() => selectFilter('all')}
			class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors
				{activeFilter === 'all'
				? 'bg-accent font-medium text-accent-foreground'
				: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
		>
			<Inbox class="size-4 shrink-0" />
			<span class="flex-1 truncate">All Notes</span>
			<span class="text-[10px] text-muted-foreground/60 tabular-nums">{data.notes.length}</span>
		</button>

		<!-- Pinned -->
		{#if pinnedCount > 0}
			<button
				type="button"
				onclick={() => selectFilter('pinned')}
				class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors
					{activeFilter === 'pinned'
					? 'bg-accent font-medium text-accent-foreground'
					: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
			>
				<Pin class="size-4 shrink-0 rotate-45" />
				<span class="flex-1 truncate">Pinned</span>
				<span class="text-[10px] text-muted-foreground/60 tabular-nums">{pinnedCount}</span>
			</button>
		{/if}

		<!-- Categories section -->
		{#if data.categories.length > 0}
			<div
				class="mt-4 mb-1 px-3 text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase"
			>
				Categories
			</div>
			{#each data.categories as cat (cat.category)}
				<button
					type="button"
					onclick={() => selectFilter(cat.category)}
					class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors
						{activeFilter === cat.category
						? 'bg-accent font-medium text-accent-foreground'
						: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
				>
					<FolderOpen class="size-4 shrink-0" />
					<span class="flex-1 truncate">{cat.category}</span>
					<span class="text-[10px] text-muted-foreground/60 tabular-nums">{cat.count}</span>
				</button>
			{/each}
		{/if}

		<!-- Sources section -->
		<div
			class="mt-4 mb-1 px-3 text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase"
		>
			Sources
		</div>
		<button
			type="button"
			onclick={() => selectFilter('user_manual')}
			class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors
				{activeFilter === 'user_manual'
				? 'bg-accent font-medium text-accent-foreground'
				: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
		>
			<Pencil class="size-4 shrink-0" />
			<span class="flex-1 truncate">Manual</span>
		</button>
		<button
			type="button"
			onclick={() => selectFilter('user_chat_save')}
			class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors
				{activeFilter === 'user_chat_save'
				? 'bg-accent font-medium text-accent-foreground'
				: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
		>
			<MessageSquare class="size-4 shrink-0" />
			<span class="flex-1 truncate">From Chat</span>
		</button>
		<button
			type="button"
			onclick={() => selectFilter('agent_tool')}
			class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors
				{activeFilter === 'agent_tool'
				? 'bg-accent font-medium text-accent-foreground'
				: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
		>
			<Bot class="size-4 shrink-0" />
			<span class="flex-1 truncate">By Agent</span>
		</button>
	</nav>
{/snippet}

<svelte:head>
	<title>Knowledge — Quant Orion</title>
</svelte:head>

<!-- Mobile sheet for filters -->
<Sheet.Root bind:open={mobileFilterOpen}>
	<Sheet.Content side="left" class="w-72 p-0">
		<Sheet.Header class="border-b border-border/20 px-4 py-3">
			<Sheet.Title class="text-sm font-semibold">Filters</Sheet.Title>
		</Sheet.Header>
		<ScrollArea class="h-[calc(100vh-4rem)]">
			{@render sidebarNav()}
		</ScrollArea>
	</Sheet.Content>
</Sheet.Root>

<div
	class="relative mx-auto flex h-[calc(100vh-5rem)] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-border/30 bg-card/40 backdrop-blur md:flex-row"
>
	<!-- ─── Sidebar (desktop only) ─── -->
	<aside class="hidden w-56 shrink-0 flex-col border-r border-border/20 md:flex lg:w-64">
		<!-- Sidebar header -->
		<div class="flex items-center justify-between border-b border-border/20 px-4 py-3">
			<h1 class="text-sm font-semibold tracking-tight text-foreground">Knowledge</h1>
			<Button
				variant="ghost"
				size="icon"
				class="size-7 text-muted-foreground hover:text-foreground"
				onclick={handleCreate}
				disabled={creating}
				title="New note"
			>
				<Plus class="size-4" />
			</Button>
		</div>

		<ScrollArea class="flex-1">
			{@render sidebarNav()}
		</ScrollArea>
	</aside>

	<!-- ─── Main Content ─── -->
	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Top bar: filter toggle (mobile) + search + new note -->
		<div class="flex items-center gap-2 border-b border-border/20 px-3 py-2.5 md:px-4">
			<!-- Mobile filter toggle -->
			<button
				type="button"
				onclick={() => (mobileFilterOpen = true)}
				class="flex shrink-0 items-center gap-1.5 rounded-md border border-border/30 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground md:hidden"
			>
				<SlidersHorizontal class="size-3.5" />
				<span class="max-w-20 truncate">{activeFilterLabel}</span>
			</button>

			<div class="relative flex-1">
				<Search
					class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/50"
				/>
				<input
					type="text"
					placeholder="Search notes..."
					class="h-8 w-full rounded-md border-none bg-transparent pl-8 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
					bind:value={search}
				/>
				{#if search}
					<button
						type="button"
						onclick={() => (search = '')}
						class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
					>
						<X class="size-3.5" />
					</button>
				{/if}
			</div>
			<Button
				variant="default"
				size="sm"
				class="h-8 gap-1.5 text-xs"
				onclick={handleCreate}
				disabled={creating}
			>
				<Plus class="size-3.5" />
				<span class="hidden sm:inline">New</span>
			</Button>
		</div>

		<!-- Note list -->
		<ScrollArea class="flex-1">
			{#if data.notes.length === 0}
				<!-- Global empty state -->
				<div class="flex flex-1 flex-col items-center justify-center px-6 py-24">
					<div class="mb-4 flex size-14 items-center justify-center rounded-full bg-muted/40">
						<BookOpen class="size-6 text-muted-foreground/50" />
					</div>
					<h2 class="mb-1 text-base font-medium text-foreground">No notes yet</h2>
					<p class="mb-6 max-w-xs text-center text-sm text-muted-foreground/70">
						Start building your knowledge base. Notes saved from chats will appear here too.
					</p>
					<Button onclick={handleCreate} disabled={creating} size="sm" class="gap-1.5">
						<Plus class="size-4" />
						Create Note
					</Button>
				</div>
			{:else if filtered.length === 0}
				<!-- Filter empty state -->
				<div class="flex flex-col items-center justify-center px-6 py-20">
					<p class="mb-3 text-sm text-muted-foreground/70">No notes match this filter.</p>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => {
							activeFilter = 'all';
							search = '';
						}}
					>
						Show all notes
					</Button>
				</div>
			{:else}
				<div class="flex flex-col">
					{#each filtered as note (note.id)}
						<NoteCard {note} onclick={() => goto(`/knowledge/${note.id}`)} />
					{/each}
				</div>
			{/if}
		</ScrollArea>
	</div>
</div>
