<script lang="ts">
	import type { QuickActionsConfig } from '$lib/types/widgets';
	import { Bot, FileText, MessageSquare, Search, Settings, Wrench, Zap } from '@lucide/svelte';
	import type { Component } from 'svelte';

	let { config = {} }: { config?: QuickActionsConfig } = $props();

	const ICON_MAP: Record<string, Component<{ class?: string }>> = {
		Bot,
		MessageSquare,
		Search,
		Settings,
		FileText,
		Wrench,
		Zap
	};

	const DEFAULT_ACTIONS = [
		{ label: 'AI Chat', icon: 'MessageSquare', route: '/ai-chat' },
		{ label: 'Tools', icon: 'Wrench', route: '/tools' },
	];

	let actions = $derived(config.actions?.length ? config.actions : DEFAULT_ACTIONS);
</script>

<div class="grid grid-cols-2 gap-2">
	{#each actions as action (action.label)}
		{@const Icon = ICON_MAP[action.icon] ?? Bot}
		<a
			href={action.route}
			class="flex flex-col items-center gap-2 rounded-2xl  bg-[#e5eeff]/50 px-3 py-3 text-center"
			aria-label={action.label}
		>
			<div class="p-3 rounded-full bg-[#d3e4fe]">
				<Icon class="size-5 text-[#45464d]" />
			</div>
			<span class="text-sm font-medium text-[#0b1c30]">{action.label}</span>
		</a>
	{/each}
</div>