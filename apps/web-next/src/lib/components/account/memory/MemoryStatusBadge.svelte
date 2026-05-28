<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils';

	type BadgeTone = 'violet' | 'mint' | 'coral' | 'slate';

	let {
		label,
		tone = 'violet',
		class: className = '',
		children
	}: {
		label?: string;
		tone?: BadgeTone;
		class?: string;
		children?: Snippet;
	} = $props();

	function toneClass(value: BadgeTone) {
		if (value === 'mint') return 'border-[#C6F1D8] bg-[#ECFFF4] text-[#36A867]';
		if (value === 'coral') return 'border-[#FFD8D1] bg-[#FFF2EF] text-[#E26B54]';
		if (value === 'slate') return 'border-[#E3E8F0] bg-[#F6F8FB] text-[#7B8794]';
		return 'border-[#E0D5FF] bg-[#F5F1FF] text-[#7C4DFF]';
	}
</script>

<Badge
	variant="outline"
	class={cn(
		'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.02em]',
		toneClass(tone),
		className
	)}
>
	{#if children}
		{@render children()}
	{:else}
		{label}
	{/if}
</Badge>