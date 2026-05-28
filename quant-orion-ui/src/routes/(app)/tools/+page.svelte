<script lang="ts">
	import Shell from '$lib/components/Shell.svelte';
	import ToolBrowser from '$lib/components/tools/ToolBrowser.svelte';
	import type { AppLayoutState } from '$lib/constants/data';
	import { getContext } from 'svelte';
	const appLayoutState = getContext<AppLayoutState>('app-layout');
</script>

<Shell pageTitle="Analytical Tools" headerVerticalAlign="center">
	{#snippet header()}
		<div class="space-y-1">
			<h1 class="font-Inter text-3xl font-normal tracking-tight text-foreground lg:text-3xl">
				Analytical Tools
			</h1>
		</div>
	{/snippet}

	<div
		class={`transition-[margin] duration-300 ${
			appLayoutState.sidebarVisible ? 'ml-0' : '-ml-16 sm:-ml-18 lg:-ml-22'
		}`}
	>
	
	<ToolBrowser />
	</div>
</Shell>
