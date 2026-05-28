<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Component } from 'svelte';

	type Props = {
		label: string;
		icon?: Component<{ class?: string }>;
		variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
		class?: string;
		iconClass?: string;
	};

	let {
		label,
		icon: Icon,
		variant = 'outline',
		class: className = '',
		iconClass = 'size-3.5 md:size-4'
	}: Props = $props();
</script>

<Button
	{variant}
	class={`h-8 rounded-full border-border/60 bg-white px-3.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted/40 md:h-9 md:px-5 md:text-sm ${className}`}
>
	<span>{label}</span>

	{#if Icon}
		<Icon class={iconClass} />
	{/if}
</Button>