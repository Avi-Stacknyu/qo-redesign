<script lang="ts">
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import type { AgentSummary } from '$lib/utils/agents';

	let {
		agent
	}: {
		agent: AgentSummary;
	} = $props();
</script>

<div
	class="mt-4 inline-flex items-center gap-3 rounded-full border border-white/55 bg-white/72 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-[0_10px_30px_rgba(68,24,124,0.12)] backdrop-blur-sm sm:mt-5 sm:px-5 sm:py-2.5 sm:text-base"
>
	<div class="relative flex shrink-0 items-center justify-center">
		<AgentAvatar {agent} size="sm" />
		<div
			class="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-white bg-emerald-500 sm:size-2.5"
		></div>
	</div>
	<p class="text-slate-600/90">
		<span class="hidden sm:inline">What would you like to explore today with </span>
		<span class="sm:hidden">Chatting with </span>
		<span class="font-semibold text-slate-900">{agent.name}</span><span class="hidden sm:inline">?</span>
	</p>
</div>