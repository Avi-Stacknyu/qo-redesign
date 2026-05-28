<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { cn } from '$lib/utils';

	import DiscoverTab from './DiscoverTab.svelte';
	import ProfileTab from './ProfileTab.svelte';

	const memoryTabs = ['Discover', 'Profile', 'Document', 'Memory'] as const;

	type MemoryTabLabel = (typeof memoryTabs)[number];

	let activeTab = $state<MemoryTabLabel>('Discover');
</script>

<div class="w-full px-4 py-2">
	<div class="w-full">
		<div class="flex w-full items-center gap-4" role="tablist" aria-label="Memory sections">
			{#each memoryTabs as tab}
				<Button
					variant="ghost"
					type="button"
					role="tab"
					aria-selected={activeTab === tab}
					tabindex={activeTab === tab ? 0 : -1}
					onclick={() => (activeTab = tab)}
					class={cn(
						'relative h-auto rounded-none px-0 pb-2 text-[11px] font-medium tracking-[0.01em] text-[#73819A] hover:bg-transparent md:text-sm',
						activeTab === tab && 'text-[#2F3C4F]'
					)}
				>
					<span>{tab}</span>
					<span
						aria-hidden="true"
						class="absolute inset-x-0 -bottom-px h-0.5 origin-center rounded-full bg-[#2F3C4F] transition-transform duration-300 ease-out"
						class:scale-x-100={activeTab === tab}
						class:scale-x-0={activeTab !== tab}
					></span>
				</Button>
			{/each}
		</div>
		<Separator class="bg-[#D7DCE5]" />
	</div>

	{#if activeTab === 'Discover'}
		<DiscoverTab />
	{:else if activeTab === 'Profile'}
		<ProfileTab />
	{:else}
		<div
			class="mt-6 rounded-[28px] border border-white/80 bg-white/78 p-6 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm"
		>
			<h2 class="text-xl font-semibold text-[#25324B]">{activeTab}</h2>
			<p class="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
				This section is ready for the next pass. The reusable onboarding conversation stays shared
				with the dedicated chat detail screen.
			</p>
		</div>
	{/if}
</div>
