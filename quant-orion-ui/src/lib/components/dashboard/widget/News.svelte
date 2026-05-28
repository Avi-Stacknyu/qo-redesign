<script lang="ts">
	import { Newspaper, ArrowUpRight, Rss } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import type { NewsConfig } from '$lib/types/widgets';

	let { config = {} }: { config?: NewsConfig } = $props();

	const FAKE_NEWS = [
		{
			title: 'OpenAI announces GPT-5 with improved reasoning capabilities',
			link: '#',
			source: 'TechCrunch',
			pubDate: '2026-05-27T08:00:00Z'
		},
		{
			title: 'Fed holds rates steady, signals potential cut in Q3',
			link: '#',
			source: 'Bloomberg',
			pubDate: '2026-05-27T06:30:00Z'
		},
		{
			title: 'Svelte 5 adoption surges as framework gains enterprise traction',
			link: '#',
			source: 'Dev.to',
			pubDate: '2026-05-26T18:00:00Z'
		},
		{
			title: 'Apple WWDC 2026: New developer tools and AI integrations',
			link: '#',
			source: 'The Verge',
			pubDate: '2026-05-26T14:00:00Z'
		}
	];

	let items = $derived.by(() => {
		let raw = FAKE_NEWS;

		if (config.source && config.source !== 'all') {
			raw = raw.filter((item) => item.source === config.source);
		}

		return raw.slice(0, config.limit ?? 8);
	});

	function relativeTime(dateStr: string): string {
		const diffMs = Date.now() - new Date(dateStr).getTime();
		const mins = Math.round(diffMs / 60000);
		const hrs = Math.round(diffMs / 3600000);
		const days = Math.round(diffMs / 86400000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		if (hrs < 24) return `${hrs}h ago`;
		return `${days}d ago`;
	}
</script>

{#if items.length === 0}
	<div
		class="flex min-h-32 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200"
	>
		<Rss class="size-7 text-slate-300" />
		<p class="text-sm font-medium text-slate-400">No news available</p>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		{#each items as item, i (item.link + i)}
			<Card.Root
				class="group rounded-3xl border border-[#F6F6F6] bg-white p-1 shadow-none ring-0 transition-all hover:shadow-sm"
			>
				<Card.Content class="flex items-start gap-3 p-3">
					<span
						class="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F6F6F6] text-[#83899F]"
					>
						<Newspaper class="size-4" />
					</span>

					<div class="flex min-w-0 flex-1 flex-col gap-1.5">
						<p class="line-clamp-2 text-sm font-medium leading-snug text-slate-700">
							{item.title}
						</p>

						<div class="flex items-center gap-2">
							<span
								class="rounded-lg bg-[#F6F6F6] px-2.5 py-0.5 text-xs font-medium text-[#83899F]"
							>
								{item.source}
							</span>
							<span class="text-xs text-[#83899F]">
								{relativeTime(item.pubDate)}
							</span>
						</div>
					</div>

					<span
						class="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-300 opacity-0 transition-all group-hover:opacity-100 group-hover:text-slate-500"
					>
						<ArrowUpRight class="size-3.5" />
					</span>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
{/if}
