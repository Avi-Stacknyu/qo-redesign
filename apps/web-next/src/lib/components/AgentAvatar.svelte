<script lang="ts">
	import { getAgentIcon, getAgentColor } from '$lib/utils/agent-ui';

	let {
		agent,
		size = 'md'
	}: {
		agent: { id: string; name: string; avatar_url?: string | null };
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'chat';
	} = $props();

	const sizeClasses: Record<string, string> = {
		xs: 'size-4',
		sm: 'size-5',
		md: 'size-8',
		lg: 'size-12',
		chat: 'size-6 md:size-8'
	};

	const iconClasses: Record<string, string> = {
		xs: 'size-2.5',
		sm: 'size-3',
		md: 'size-4',
		lg: 'size-6',
		chat: 'size-3 md:size-4'
	};

	const FallbackIcon = $derived(getAgentIcon(agent.name, agent.id));
	const fallbackColor = $derived(getAgentColor(agent.name, agent.id));
</script>

{#if agent.avatar_url}
	<img
		src={agent.avatar_url}
		alt={agent.name}
		class="shrink-0 rounded-full object-cover {sizeClasses[size]}"
	/>
{:else}
	<div
		class="flex shrink-0 items-center justify-center rounded-full {sizeClasses[size]}"
		style="background-color: {fallbackColor}20; color: {fallbackColor}"
	>
		<FallbackIcon class={iconClasses[size]} />
	</div>
{/if}
