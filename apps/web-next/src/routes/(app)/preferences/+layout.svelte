<script lang="ts">
	import Search2 from '$lib/components/Search2.svelte';
	import CategoryTabs from '$lib/components/CategoryTabs.svelte';
	import Shell from '$lib/components/Shell.svelte';
	import type { AppLayoutState, HeaderCategoryTabsProps } from '$lib/constants/data';
	import { page } from '$app/stores';
	import { PaintRoller, Sparkles, SquareChartGantt, User, Waypoints } from '@lucide/svelte';
    import { getContext } from 'svelte';

	let { children } = $props();


	const appLayoutState = getContext<AppLayoutState>('app-layout');

	const tabs: HeaderCategoryTabsProps[] = [
		{ href: '/preferences/general', value: '/preferences/general', label: 'General', icon: User, variant: 'secondary' },
		{ href: '/preferences/appearance', value: '/preferences/appearance', label: 'Appearance', icon: PaintRoller, variant: 'secondary' },
		{ href: '/preferences/billing', value: '/preferences/billing', label: 'Billing & Plans', icon: SquareChartGantt, variant: 'secondary' },
		{ href: '/preferences/ai', value: '/preferences/ai', label: 'Agent', icon: Sparkles, variant: 'secondary' },
		{ href: '/preferences/profile', value: '/preferences/profile', label: 'Memory', icon: Waypoints, variant: 'secondary' }
	];

	let currentPath = $derived($page.url.pathname);
</script>

<svelte:head>
	<title>Preferences — Quant Orion</title>
</svelte:head>

<Shell pageTitle="Preferences" profileHref="/preferences/profile" headerVerticalAlign="center">
	{#snippet header()}
		<Search2 />
	{/snippet}

	{#snippet children()}
		<!-- sidebar transition div -->
	<div
		class={`mx-auto flex w-full  flex-col gap-8 transition-[margin,padding] duration-300  ${
			appLayoutState.sidebarVisible ? 'ml-0' : '-ml-16 sm:-ml-18 lg:-ml-22'
		}`}
	>
			<CategoryTabs tabs={tabs} activeTab={currentPath} />
			<div class="min-w-0">
				{#if children}
					{@render children()}
				{/if}
			</div>
		</div>
	{/snippet}
</Shell>
