<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';

	let {
		canScrollUp = false,
		canScrollDown = false,
		onScrollTop,
		onScrollBottom
	}: {
		canScrollUp?: boolean;
		canScrollDown?: boolean;
		onScrollTop: () => void;
		onScrollBottom: () => void;
	} = $props();
</script>

{#if canScrollUp || canScrollDown}
	<div class="pointer-events-none absolute top-3 right-3 bottom-3 z-10 flex flex-col justify-between">
		<div>
			{#if canScrollUp}
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					class="pointer-events-auto rounded-full border-white/70 bg-white/88 text-[#7c4dff] shadow-[0_10px_24px_rgba(124,77,255,0.14)] backdrop-blur-sm hover:bg-white"
					onclick={onScrollTop}
					aria-label="Scroll to top"
				>
					<ChevronUp class="size-4" />
				</Button>
			{/if}
		</div>

		<div>
			{#if canScrollDown}
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					class="pointer-events-auto rounded-full border-white/70 bg-white/88 text-[#7c4dff] shadow-[0_10px_24px_rgba(124,77,255,0.14)] backdrop-blur-sm hover:bg-white"
					onclick={onScrollBottom}
					aria-label="Scroll to bottom"
				>
					<ChevronDown class="size-4" />
				</Button>
			{/if}
		</div>
	</div>
{/if}