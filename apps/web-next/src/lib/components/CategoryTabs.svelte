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

	const getTabValue = (tab: HeaderCategoryTabsProps) => tab.value ?? tab.href ?? tab.label;

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

<div class="flex w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
	{#each tabs as tab (getTabValue(tab))}
		{@const tabValue = getTabValue(tab)}
		<Button
			href={tab.href}
			variant={tab.variant}
			class={cn(
				'shrink-0 rounded-full px-6 py-6 text-sm font-medium font-Inter tracking-[-0.02em] transition-all duration-200 ring-1 ring-border/10',
				activeTab === tabValue
					? 'bg-primary text-white shadow-[0_10px_24px_rgba(16,24,40,0.14)] hover:bg-primary/85'
					: 'bg-white/88 text-primary shadow-sm hover:bg-white hover:shadow-md',
				tab.className
			)}
			onclick={() => handleTabClick(tab)}
			aria-pressed={activeTab === tabValue}
		>
			{#if tab.icon}
				<tab.icon class="mr-2 size-4" />
			{/if}
			<span class="hidden md:inline">{tab.label}</span>
		</Button>
	{/each}
</div>
