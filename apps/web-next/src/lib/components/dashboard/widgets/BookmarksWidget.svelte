<script lang="ts">
	import { ExternalLink, Bookmark, Plus, Trash2, Loader2 } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import WidgetError from '../WidgetError.svelte';
	import { loadBookmarks, addBookmark, removeBookmark } from '$lib/remote/bookmarks.remote';
	import type { BookmarksConfig } from '$lib/types/widgets';

	let { config }: { config: BookmarksConfig } = $props();

	let urlInput = $state('');
	let adding = $state(false);

	const bookmarks = loadBookmarks();

	let filtered = $derived.by(() => {
		const items = bookmarks.current ?? [];
		if (config.category) return items.filter((b) => b.category === config.category);
		return items;
	});

	async function handleAdd() {
		const url = urlInput.trim();
		if (!url || adding) return;
		adding = true;
		try {
			await addBookmark({ url, category: config.category });
			urlInput = '';
		} catch {
			/* error propagated via query */
		} finally {
			adding = false;
		}
	}

	async function handleRemove(id: string) {
		try {
			await removeBookmark({ bookmarkId: id });
		} catch {
			/* error propagated via query */
		}
	}
</script>

{#if bookmarks.loading && !bookmarks.current}
	<WidgetSkeleton lines={3} />
{:else if bookmarks.error}
	<WidgetError
		message={bookmarks.error?.message ?? 'Failed to load bookmarks'}
		onRetry={() => loadBookmarks().refresh()}
	/>
{:else}
	<!-- Quick-paste URL input -->
	<form
		class="mb-3 flex items-center gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			handleAdd();
		}}
	>
		<Input
			placeholder="Paste a URL..."
			class="h-8 flex-1 border-border/40 bg-muted/20 text-sm"
			bind:value={urlInput}
			disabled={adding}
		/>
		<Button
			variant="ghost"
			size="icon"
			class="size-8 shrink-0"
			type="submit"
			disabled={!urlInput.trim() || adding}
		>
			{#if adding}
				<Loader2 class="size-3.5 animate-spin" />
			{:else}
				<Plus class="size-3.5" />
			{/if}
		</Button>
	</form>

	{#if filtered.length === 0}
		<div class="flex min-h-16 flex-col items-center justify-center gap-2 p-4">
			<Bookmark class="size-6 text-muted-foreground/50" />
			<p class="text-sm text-muted-foreground">No bookmarks saved</p>
		</div>
	{:else}
		<div class="flex flex-col gap-0.5">
			{#each filtered as bm (bm.id)}
				<div
					class="group/bm flex items-start gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted/40"
				>
					<a
						href={bm.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex min-w-0 flex-1 items-start gap-3"
					>
						{#if bm.favicon}
							<img
								src={bm.favicon}
								alt=""
								class="mt-0.5 size-5 rounded"
								loading="lazy"
								onerror={(e) => {
									(e.currentTarget as HTMLImageElement).style.display = 'none';
								}}
							/>
						{:else}
							<div class="mt-0.5 rounded-full bg-muted/60 p-1">
								<ExternalLink class="size-3 text-muted-foreground" />
							</div>
						{/if}
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-sm leading-tight text-foreground">{bm.title}</span>
							<span class="truncate text-xs text-muted-foreground">
								{bm.domain ?? bm.url}
							</span>
						</div>
					</a>
					<button
						class="mt-0.5 opacity-0 transition-opacity group-hover/bm:opacity-100"
						onclick={() => handleRemove(bm.id)}
						aria-label="Remove bookmark"
					>
						<Trash2 class="size-3.5 text-muted-foreground hover:text-destructive" />
					</button>
				</div>
			{/each}
		</div>
	{/if}
{/if}
