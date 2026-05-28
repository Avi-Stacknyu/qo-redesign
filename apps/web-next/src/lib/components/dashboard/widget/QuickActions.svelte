<script lang="ts">
	import { FileText, MessageSquare, Plus, Search, Settings, Zap } from '@lucide/svelte';
	import type { QuickActionsConfig } from '$lib/types/widgets';
	import type { Component } from 'svelte';

	let { config }: { config?: QuickActionsConfig } = $props();

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

	let resolvedConfig = $derived(config ?? { actions: [] });
	let actions = $derived(resolvedConfig.actions?.length ? resolvedConfig.actions : DEFAULT_ACTIONS);
</script>

<div class="grid grid-cols-2 gap-3">
	{#each actions as action (action.label)}
		{@const Icon = ICON_MAP[action.icon] ?? Zap}
		<a
			href={action.route}
			class="flex flex-col items-center gap-2 rounded-[24px] bg-[#EAF2FF] px-3 py-3 text-center transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#DDEAFE]"
			aria-label={action.label}
		>
			<div class="rounded-full bg-[#D3E4FE] p-3 text-[#45464D]">
				<Icon class="size-5" />
			</div>
			<span class="text-sm font-medium text-[#0B1C30]">{action.label}</span>
		</a>
	{/each}
</div>