<!-- CategoryTabs.svelte -->
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { HeaderCategoryTabsProps } from '$lib/constants/data';
	import { cn } from '$lib/utils';

	type Props = {
		tabs: HeaderCategoryTabsProps[];
		activeTab?: string;
	};

	let { tabs, activeTab = $bindable<string | undefined>() }: Props = $props();

	const getTabValue = (tab: HeaderCategoryTabsProps) => tab.value ?? tab.label;

	$effect(() => {
		if (!activeTab && tabs.length > 0) {
			activeTab = getTabValue(tabs[0]);
		}
	});

	function handleTabClick(tab: HeaderCategoryTabsProps) {
		activeTab = getTabValue(tab);
		tab.onClick?.();
	}
</script>

<div class="ml-auto flex items-center gap-2">
	{#each tabs as tab (getTabValue(tab))}
		{@const tabValue = getTabValue(tab)}
		<Button
			variant={tab.variant}
			class={cn(
				'rounded-full px-6 py-6 text-sm font-medium font-Inter transition-opacity',
				activeTab === tabValue ? 'shadow-sm bg-primary hover:bg-primary/80 text-white' : 'bg-white text-primary',
				tab.className
			)}
			onclick={() => handleTabClick(tab)}
			aria-pressed={activeTab === tabValue}
		>
			{#if tab.icon}
				<svelte:component this={tab.icon} class="mr-2 size-4" />
			{/if}
			<span class="hidden lg:inline">{tab.label}</span>
		</Button>
	{/each}
</div>
