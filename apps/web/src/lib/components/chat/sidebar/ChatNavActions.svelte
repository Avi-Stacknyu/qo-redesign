<script lang="ts">
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Star } from '@lucide/svelte';
	import { toggleThreadFavorite, getThreadList } from '$lib/remote/chat-threads.remote';

	let { threadId = null, favorite = false }: { threadId?: string | null; favorite?: boolean } =
		$props();
	let isToggling = $state(false);

	async function toggleFavorite() {
		if (!threadId || isToggling) return;
		isToggling = true;
		const newFavorite = !favorite;
		try {
			await toggleThreadFavorite({ thread_id: threadId, favorite: newFavorite }).updates(
				getThreadList().withOverride((chats) =>
					chats.map((c) => (c.id === threadId ? { ...c, favorite: newFavorite } : c))
				)
			);
		} catch {
			getThreadList().refresh();
		} finally {
			isToggling = false;
		}
	}
</script>

<div class="flex items-center gap-2 text-sm">
	{#if threadId}
		<Button
			variant="ghost"
			size="icon"
			class="size-7"
			onclick={toggleFavorite}
			disabled={isToggling}
			title={favorite ? 'Remove from favorites' : 'Add to favorites'}
		>
			<Star class={favorite ? 'fill-yellow-400 text-yellow-400' : ''} />
		</Button>
	{/if}
</div>
