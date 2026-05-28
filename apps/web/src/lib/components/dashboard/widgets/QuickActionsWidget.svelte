<script lang="ts">
	import type { QuickActionsConfig } from '$lib/types/widgets';
	import { FileText, MessageSquare, Plus, Search, Settings, Zap } from '@lucide/svelte';
	import type { Component } from 'svelte';

	let { config }: { config: QuickActionsConfig } = $props();

	const ICON_MAP: Record<string, Component<{ class?: string }>> = {
		MessageSquare,
		Plus,
		Settings,
		Zap,
		Search,
		FileText
	};

	const DEFAULT_ACTIONS = [
		{ label: 'New Chat', icon: 'MessageSquare', route: '/chat' },
		{ label: 'Preferences', icon: 'Settings', route: '/preferences' }
	];

	let actions = $derived(config.actions?.length ? config.actions : DEFAULT_ACTIONS);
</script>

<div class="grid grid-cols-2 gap-2">
	{#each actions as action (action.label)}
		{@const Icon = ICON_MAP[action.icon]}
		<a
			href={action.route}
			class="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-center transition-colors hover:border-border hover:bg-muted/50"
			aria-label={action.label}
		>
			{#if Icon}
				<Icon class="size-5 text-muted-foreground" />
			{:else}
				<Zap class="size-5 text-muted-foreground" />
			{/if}
			<span class="text-xs font-medium text-foreground">{action.label}</span>
		</a>
	{/each}
</div>
