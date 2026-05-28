<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		ArrowLeft,
		Pin,
		PinOff,
		Trash2,
		Tag,
		FolderOpen,
		Bot,
		MessageSquare,
		Pencil,
		Check,
		X
	} from '@lucide/svelte';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Separator } from '$lib/components/shadcn/separator/index.js';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import NoteEditor from '$lib/components/knowledge/NoteEditor.svelte';
	import { updateNote, deleteNote, toggleNotePin } from '$lib/remote/knowledge.remote';
	import { formatDistanceToNow, format } from 'date-fns';

	let { data } = $props();

	let title = $state('');
	let category = $state('');
	let tags = $state<string[]>([]);
	let pinned = $state(false);
	let saving = $state(false);
	let deleting = $state(false);
	let showTagInput = $state(false);
	let newTag = $state('');

	// Sync local state when server data changes (initial load + invalidation)
	$effect(() => {
		title = data.note.title;
		category = data.note.category;
		tags = [...data.note.tags];
		pinned = data.note.pinned;
	});

	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	function debouncedSave(fields: Record<string, unknown>) {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(async () => {
			saving = true;
			try {
				await updateNote({ noteId: data.note.id, ...fields });
			} catch {
				toast.error('Failed to save');
			} finally {
				saving = false;
			}
		}, 800);
	}

	function handleContentUpdate(markdown: string) {
		debouncedSave({ content: markdown });
	}

	function handleTitleBlur() {
		if (title !== data.note.title) {
			debouncedSave({ title });
		}
	}

	function handleTitleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLInputElement).blur();
		}
	}

	async function handleCategorySelect(cat: string) {
		category = cat;
		saving = true;
		try {
			await updateNote({ noteId: data.note.id, category: cat });
		} catch {
			toast.error('Failed to update category');
		} finally {
			saving = false;
		}
	}

	async function handleTogglePin() {
		const next = !pinned;
		pinned = next;
		try {
			await toggleNotePin({ noteId: data.note.id, pinned: next });
		} catch {
			pinned = !next;
			toast.error('Failed to toggle pin');
		}
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this note?')) return;
		deleting = true;
		try {
			await deleteNote({ noteId: data.note.id });
			toast.success('Note deleted');
			await goto('/knowledge');
		} catch {
			toast.error('Failed to delete');
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
		tags = tags.filter((t) => t !== tag);
		debouncedSave({ tags });
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		}
		if (e.key === 'Escape') {
			showTagInput = false;
			newTag = '';
		}
	}

	let sourceLabel = $derived.by(() => {
		if (data.note.source === 'user_chat_save') return 'Saved from chat';
		if (data.note.source === 'agent_tool') return 'Created by agent';
		return 'Manual';
	});
</script>

<svelte:head>
	<title>{title} — Knowledge — Quant Orion</title>
</svelte:head>

<div class="relative mx-auto w-full max-w-4xl">
	<!-- Top bar -->
	<div class="mb-6 flex items-center justify-between gap-3">
		<Button
			variant="ghost"
			size="sm"
			onclick={() => goto('/knowledge')}
			class="gap-1.5 text-muted-foreground"
		>
			<ArrowLeft class="size-4" />
			Back
		</Button>

		<div class="flex items-center gap-1">
			{#if saving}
				<span class="mr-2 text-xs text-muted-foreground/60">Saving...</span>
			{/if}

			<Button
				variant="ghost"
				size="icon"
				onclick={handleTogglePin}
				class="size-8"
				title={pinned ? 'Unpin' : 'Pin'}
			>
				{#if pinned}
					<PinOff class="size-4 text-amber-500" />
				{:else}
					<Pin class="size-4" />
				{/if}
			</Button>

			<Button
				variant="ghost"
				size="icon"
				onclick={handleDelete}
				disabled={deleting}
				class="size-8 text-destructive/70 hover:text-destructive"
				title="Delete"
			>
				<Trash2 class="size-4" />
			</Button>
		</div>
	</div>

	<!-- Title -->
	<textarea
		bind:value={title}
		onblur={handleTitleBlur}
		onkeydown={handleTitleKeydown}
		placeholder="Untitled"
		rows="1"
		class="mb-2 field-sizing-content w-full resize-none border-none bg-transparent text-2xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none sm:text-3xl lg:text-4xl"
	></textarea>

	<!-- Metadata row -->
	<div class="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
		<!-- Source -->
		<div class="flex items-center gap-1">
			{#if data.note.source === 'user_chat_save'}
				<MessageSquare class="size-3" />
			{:else if data.note.source === 'agent_tool'}
				<Bot class="size-3" />
			{:else}
				<Pencil class="size-3" />
			{/if}
			<span>{sourceLabel}</span>
		</div>

		{#if data.note.chatTitle}
			<span>&middot;</span>
			<span>{data.note.chatTitle}</span>
		{/if}

		{#if data.note.agentName}
			<span>&middot;</span>
			<span>{data.note.agentName}</span>
		{/if}

		<span>&middot;</span>
		<span title={format(new Date(data.note.created), 'PPpp')}>
			Created {formatDistanceToNow(new Date(data.note.created), { addSuffix: true })}
		</span>

		{#if data.note.updated !== data.note.created}
			<span>&middot;</span>
			<span title={format(new Date(data.note.updated), 'PPpp')}>
				Edited {formatDistanceToNow(new Date(data.note.updated), { addSuffix: true })}
			</span>
		{/if}
	</div>

	<!-- Category + Tags -->
	<div class="mb-6 flex flex-wrap items-center gap-2">
		<!-- Category dropdown -->
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
				<DropdownMenu.Item onclick={() => handleCategorySelect('')}>No category</DropdownMenu.Item>
				<DropdownMenu.Separator />
				{#each data.categories as cat}
					<DropdownMenu.Item onclick={() => handleCategorySelect(cat.category)}>
						{cat.category}
						{#if cat.category === category}
							<Check class="ml-auto size-3.5" />
						{/if}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<!-- Tags -->
		{#each tags as tag}
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
			<input
				type="text"
				bind:value={newTag}
				onkeydown={handleTagKeydown}
				onblur={() => {
					addTag();
					showTagInput = false;
				}}
				placeholder="Tag name"
				class="h-7 w-24 rounded-md border border-border/40 bg-transparent px-2 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
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

	<Separator class="mb-6 opacity-40" />

	<!-- Editor -->
	<NoteEditor content={data.note.content} onupdate={handleContentUpdate} />
</div>
