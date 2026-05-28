<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils';

	let {
		class: className = '',
		children
	}: {
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<Card.Root
	class={cn(
		'rounded-[28px] border-[#E7EDF7] bg-white shadow-[0_16px_36px_rgba(15,23,42,0.06)]',
		className
	)}
>
	<Card.Content class="p-0">{@render children?.()}</Card.Content>
</Card.Root>