<script lang="ts">
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import { format, formatDistanceToNow } from 'date-fns';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import NoteCard from '$lib/components/knowledge/NoteCard.svelte';
  import NoteEditor from '$lib/components/knowledge/NoteEditor.svelte';
  import {
    createNote,
    deleteNote,
    getNotes,
    getNoteCategories,
    toggleNotePin,
    updateNote,
    type Note
  } from '$lib/remote/knowledge.remote';
  import {
    Bot,
    Check,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Ellipsis,
    FolderOpen,
    ListFilter,
    MessageSquare,
    Pencil,
    Pin,
    PinOff,
    Plus,
    Search,
    Star,
    Tag,
    Trash2,
    X
  } from '@lucide/svelte';

  let { data } = $props();

  let search = $state('');
  let activeFilter = $state('all');
  let filtersOpen = $state(false);
  let creating = $state(false);
  let selectedNoteId = $state<string | null>(null);
  let copied = $state(false);
  let editing = $state(false);
  let title = $state('');
  let category = $state('');
  let tags = $state<string[]>([]);
  let editorContent = $state('');
  let pinned = $state(false);
  let saving = $state(false);
  let deleting = $state(false);
  let showTagInput = $state(false);
  let newTag = $state('');
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  // Reactive queries — auto-refresh when commands call .refresh() server-side
  const notesQuery = getNotes();
  const categoriesQuery = getNoteCategories();

  let notes = $derived(
    ((notesQuery.current ?? data.notes) as Note[]).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    })
  );

  let categories = $derived(categoriesQuery.current ?? data.categories);

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

  $effect(() => {
    if (!selectedNote) {
      editing = false;
      return;
    }

    title = selectedNote.title;
    category = selectedNote.category;
    tags = [...selectedNote.tags];
    editorContent = selectedNote.content;
    pinned = selectedNote.pinned;
    showTagInput = false;
    newTag = '';
  });

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
    editing = false;
    selectedNoteId = note.id;
  }

  function moveSelection(direction: -1 | 1) {
    if (!filtered.length) return;
    const current = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = Math.min(filtered.length - 1, Math.max(0, current + direction));
    editing = false;
    selectedNoteId = filtered[nextIndex]?.id ?? null;
  }

  function openEditor() {
    if (!selectedNote) return;
    editing = true;
  }

  async function closeEditor() {
    // Flush any pending debounced save
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = undefined;

      if (selectedNote) {
        const fields: Record<string, unknown> = {};
        if (title !== selectedNote.title) fields.title = title;
        if (editorContent !== selectedNote.content) fields.content = editorContent;
        if (category !== selectedNote.category) fields.category = category;
        if (JSON.stringify(tags) !== JSON.stringify(selectedNote.tags)) fields.tags = tags;

        if (Object.keys(fields).length > 0) {
          saving = true;
          try {
            await updateNote({ noteId: selectedNote.id, ...fields }).updates(
              getNotes(),
              getNoteCategories()
            );
          } catch {
            toast.error('Failed to save');
          } finally {
            saving = false;
          }
        }
      }
    }

    editing = false;
    showTagInput = false;
    newTag = '';
  }

  function handleNotePin(noteId: string, pinned: boolean) {
    // NoteCard already calls toggleNotePin which triggers server refresh
    // No local override needed — query auto-updates
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
      }).updates(getNotes(), getNoteCategories());
      activeFilter = 'all';
      search = '';
      selectedNoteId = note.id;
      editing = true;
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

  function debouncedSave(fields: Record<string, unknown>) {
    if (!selectedNote) return;
    const noteId = selectedNote.id;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saving = true;
      try {
        await updateNote({ noteId, ...fields }).updates(getNotes(), getNoteCategories());
      } catch {
        toast.error('Failed to save');
      } finally {
        saving = false;
      }
    }, 800);
  }

  function handleContentUpdate(markdown: string) {
    editorContent = markdown;
    debouncedSave({ content: markdown });
  }

  function handleTitleBlur() {
    if (!selectedNote || title === selectedNote.title) return;
    debouncedSave({ title });
  }

  function handleTitleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    (event.target as HTMLTextAreaElement).blur();
  }

  async function handleCategorySelect(nextCategory: string) {
    if (!selectedNote) return;
    category = nextCategory;
    saving = true;
    try {
      await updateNote({ noteId: selectedNote.id, category: nextCategory }).updates(
        getNotes(),
        getNoteCategories()
      );
    } catch {
      toast.error('Failed to update category');
    } finally {
      saving = false;
    }
  }

  async function handleTogglePin() {
    if (!selectedNote) return;
    const next = !pinned;
    pinned = next;
    try {
      await toggleNotePin({ noteId: selectedNote.id, pinned: next }).updates(getNotes());
    } catch {
      pinned = !next;
      toast.error('Failed to toggle pin');
    }
  }

  async function handleDeleteSelected() {
    if (!selectedNote || !confirm('Are you sure you want to delete this note?')) return;

    const deletedId = selectedNote.id;
    const remaining = notes.filter((note) => note.id !== deletedId);
    deleting = true;

    try {
      await deleteNote({ noteId: deletedId }).updates(getNotes(), getNoteCategories());
      editing = false;
      selectedNoteId = remaining[0]?.id ?? null;
      toast.success('Note deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      deleting = false;
    }
  }

  function addTag() {
    const tag = newTag.trim();
    if (!tag || tags.includes(tag)) {
      newTag = '';
      return;
    }

    tags = [...tags, tag];
    newTag = '';
    debouncedSave({ tags });
  }

  function removeTag(tag: string) {
    tags = tags.filter((currentTag) => currentTag !== tag);
    debouncedSave({ tags });
  }

  function handleTagKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    }

    if (event.key === 'Escape') {
      showTagInput = false;
      newTag = '';
    }
  }

  let sourceLabel = $derived.by(() => {
    if (!selectedNote) return 'Manual';
    if (selectedNote.source === 'user_chat_save') return 'Saved from chat';
    if (selectedNote.source === 'agent_tool') return 'Created by agent';
    return 'Manual';
  });
</script>

<svelte:head>
  <title>Knowledge</title>
</svelte:head>

<div class="flex w-full flex-col gap-4 xl:flex-row">
  <section class="w-full xl:max-w-[430px]">
    <Card
      class="flex max-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden border-0 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-0 backdrop-blur-xl"
    >
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
            <Search
              class="absolute top-1/2 left-5 -translate-y-1/2 text-muted-foreground"
              size={22}
            />
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

              {#each categories as cat (cat.category)}
                <Button
                  type="button"
                  variant={activeFilter === cat.category ? 'default' : 'outline'}
                  class="h-8 rounded-full bg-white px-3 text-xs"
                  onclick={() => selectFilter(cat.category)}
                >
                  {cat.category}
                </Button>
              {/each}
            </div>
          {/if}
        </div>

        <div
          class="min-h-0 flex-1 overflow-y-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
                <div
                  class={selectedNote?.id === note.id
                    ? 'rounded-3xl ring-2 ring-violet-400/20'
                    : ''}
                >
                  <NoteCard
                    {note}
                    onclick={() => selectNote(note)}
                    onpin={(pinned) => handleNotePin(note.id, pinned)}
                  />
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
      <Card
        class="flex min-h-[calc(100vh-4rem)] w-full flex-col gap-6 border-0 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-0 backdrop-blur-xl"
      >
        {#if editing}
          <div class="flex items-start justify-between gap-4">
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
              <div>
                <p class="text-sm font-medium text-[#83899F]">{category || 'Knowledge Note'}</p>
                <p class="text-xs text-muted-foreground/70">
                  {saving ? 'Saving...' : 'Editing in place'}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- <Button variant="secondary" class="rounded-2xl px-4 py-2 text-sm" onclick={shareSelected}>
								{copied ? 'Copied' : 'Share'}
							</Button> -->
              <Button
                variant="ghost"
                size="icon"
                class="rounded-full"
                onclick={handleTogglePin}
                title={pinned ? 'Unpin' : 'Pin'}
              >
                {#if pinned}
                  <PinOff class="size-5 text-amber-500" />
                {:else}
                  <Pin class="size-5" />
                {/if}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="rounded-full text-destructive/70 hover:text-destructive"
                onclick={handleDeleteSelected}
                disabled={deleting}
                title="Delete note"
              >
                <Trash2 class="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="rounded-full"
                onclick={closeEditor}
                aria-label="Close inline editor"
              >
                <X class="size-5" />
              </Button>
            </div>
          </div>

          <textarea
            bind:value={title}
            onblur={handleTitleBlur}
            onkeydown={handleTitleKeydown}
            placeholder="Untitled"
            rows="1"
            class="field-sizing-content w-full resize-none border-none bg-transparent font-Inter text-4xl font-bold text-[#83899F] placeholder:text-muted-foreground/40 focus:outline-none"
          ></textarea>

          <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
            <div class="flex items-center gap-1">
              {#if selectedNote.source === 'user_chat_save'}
                <MessageSquare class="size-3" />
              {:else if selectedNote.source === 'agent_tool'}
                <Bot class="size-3" />
              {:else}
                <Pencil class="size-3" />
              {/if}
              <span>{sourceLabel}</span>
            </div>

            {#if selectedNote.chatTitle}
              <span>&middot;</span>
              <span>{selectedNote.chatTitle}</span>
            {/if}

            {#if selectedNote.agentName}
              <span>&middot;</span>
              <span>{selectedNote.agentName}</span>
            {/if}

            <span>&middot;</span>
            <span title={format(new Date(selectedNote.created), 'PPpp')}>
              Created {formatDistanceToNow(new Date(selectedNote.created), { addSuffix: true })}
            </span>

            {#if selectedNote.updated !== selectedNote.created}
              <span>&middot;</span>
              <span title={format(new Date(selectedNote.updated), 'PPpp')}>
                Edited {formatDistanceToNow(new Date(selectedNote.updated), { addSuffix: true })}
              </span>
            {/if}
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Button {...props} variant="outline" size="sm" class="h-7 gap-1.5 text-xs">
                    <FolderOpen class="size-3" />
                    {category || 'No category'}
                  </Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start">
                <DropdownMenu.Item onclick={() => handleCategorySelect('')}>
                  No category
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                {#each categories as categoryItem (categoryItem.category)}
                  <DropdownMenu.Item onclick={() => handleCategorySelect(categoryItem.category)}>
                    {categoryItem.category}
                    {#if categoryItem.category === category}
                      <Check class="ml-auto size-3.5" />
                    {/if}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            {#each tags as tag (tag)}
              <Badge variant="secondary" class="gap-1 text-xs">
                {tag}
                <button
                  type="button"
                  onclick={() => removeTag(tag)}
                  class="ml-0.5 opacity-60 hover:opacity-100"
                >
                  <X class="size-3" />
                </button>
              </Badge>
            {/each}

            {#if showTagInput}
              <Input
                type="text"
                bind:value={newTag}
                onkeydown={handleTagKeydown}
                onblur={() => {
                  addTag();
                  showTagInput = false;
                }}
                placeholder="Tag name"
                class="h-7 w-24 rounded-md border-border/40 bg-transparent px-2 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
              />
            {:else}
              <Button
                variant="ghost"
                size="sm"
                class="h-7 gap-1 text-xs text-muted-foreground"
                onclick={() => (showTagInput = true)}
              >
                <Tag class="size-3" />
                Add tag
              </Button>
            {/if}
          </div>

          <Separator class="opacity-40" />

          {#key selectedNote.id}
            <NoteEditor content={editorContent} onupdate={handleContentUpdate} />
          {/key}
        {:else}
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
              <!-- <Button variant="secondary" class="rounded-2xl px-6 py-5 text-lg" onclick={shareSelected}>
								{copied ? 'Copied' : 'Share'}
							</Button> -->
              <Star
                color="white"
                fill={selectedNote.pinned ? '#FFCC00' : 'transparent'}
                size={36}
              />
              <Button
                variant="ghost"
                size="icon"
                class="rounded-full"
                onclick={openEditor}
                aria-label="Edit note inline"
              >
                <Ellipsis size={36} />
              </Button>
            </div>
          </section>

          <!-- <img src="/images/rainbow.png" alt="Knowledge cover" class="max-h-60 w-full rounded-2xl object-cover" /> -->

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
                  class="inline-flex h-10 items-center justify-center rounded-full border border-dashed border-muted bg-white px-4 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:bg-muted/40"
                >
                  {tag}
                </Button>
              {/each}
            </div>
          </section>

          <CardHeader class="mt-auto px-0 pt-4">
            <CardTitle class="font-Inter text-base font-normal text-[#83899F]">
              Click the ellipsis to edit this note inline without leaving the knowledge page.
            </CardTitle>
          </CardHeader>
        {/if}
      </Card>
    {:else}
      <Card
        class="flex min-h-[calc(100vh-4rem)] items-center justify-center border-0 bg-white p-10 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-0"
      >
        <CardContent class="max-w-sm space-y-4">
          <BookOpen class="mx-auto size-10 text-muted-foreground/40" />
          <h2 class="text-2xl font-semibold text-[#83899F]">Knowledge is empty</h2>
          <p class="text-muted-foreground">
            Create a note or save an answer from chat to start building this workspace.
          </p>
          <Button onclick={handleCreate} disabled={creating} class="rounded-full">
            <Plus class="mr-2 size-4" />
            Create Note
          </Button>
        </CardContent>
      </Card>
    {/if}
  </section>
</div>
