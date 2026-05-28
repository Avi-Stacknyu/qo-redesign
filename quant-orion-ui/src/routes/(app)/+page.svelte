<script lang="ts">
	import CategoryTabs from '$lib/components/CategoryTabs.svelte';
	import DashboardContent from '$lib/components/dashboard/DashboardContent.svelte';
	import Shell from '$lib/components/Shell.svelte';
	import type { AppLayoutState, HeaderCategoryTabsProps } from '$lib/constants/data';
	import { getContext } from 'svelte';

	const appLayoutState = getContext<AppLayoutState>('app-layout');

	const tabs = $state<HeaderCategoryTabsProps[]>([
		{
			label: 'Productivity',
			variant: 'secondary'
		},
		{
			label: 'Information',
			variant: 'secondary'
		},
		{
			label: 'Finanace',
			variant: 'secondary'
		}
	]);
</script>

<Shell pageTitle="Dashboard — Quant Orion">
	{#snippet header()}
		<div class="space-y-1">
			<h1 class="font-Inter text-2xl font-normal tracking-tight text-foreground lg:text-3xl">
				Welcome back, Harsh
			</h1>

			<h2 class="font-Inter text-base font-normal tracking-wide text-[#83899F]">
				You have 4 tasks due today and 2 meetings this
			</h2>
		</div>
	{/snippet}

	{#snippet headerTabs()}
		<CategoryTabs {tabs} />
	{/snippet}

	<div
		class={`transition-[margin] duration-300 ${
			appLayoutState.sidebarVisible ? 'ml-0' : '-ml-16 sm:-ml-18 lg:-ml-22'
		}`}
	>
		<DashboardContent />
	</div>
</Shell>
