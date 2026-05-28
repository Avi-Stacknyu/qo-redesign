<script lang="ts">
	import { Newspaper, ArrowUpRight, Rss } from '@lucide/svelte';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import WidgetError from '../WidgetError.svelte';
	import { loadNews } from '$lib/remote/news.remote';
	import type { NewsConfig } from '$lib/types/widgets';

	let { config }: { config: NewsConfig } = $props();

	const news = loadNews();

	let items = $derived.by(() => {
		let raw = (news.current ?? []) as Array<{
			title: string;
			link: string;
			source: string;
			pubDate: string;
		}>;

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
		if (mins < 60) return `${mins}m`;
		if (hrs < 24) return `${hrs}h`;
		return `${days}d`;
	}
</script>

{#if news.loading && !news.current}
	<WidgetSkeleton lines={4} />
{:else if news.error}
	<WidgetError
		message={news.error?.message ?? 'Failed to load news'}
		onRetry={() => loadNews().refresh()}
	/>
{:else if items.length === 0}
	<div class="flex min-h-24 flex-col items-center justify-center gap-2 p-4">
		<Rss class="size-6 text-muted-foreground/50" />
		<p class="text-sm text-muted-foreground">No news available</p>
	</div>
{:else}
	<div class="flex max-h-80 flex-col overflow-y-auto">
		{#each items as item, i (item.link + i)}
			<a
				href={item.link}
				target="_blank"
				rel="noopener noreferrer"
				class="group flex items-start gap-3 border-b border-border/40 px-1 py-2.5 transition-colors last:border-0 hover:bg-muted/20"
			>
				<div
					class="mt-0.5 rounded-full border border-border/40 bg-muted/20 p-1.5 transition-colors group-hover:border-primary/30"
				>
					<Newspaper class="size-3 text-muted-foreground" />
				</div>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span
						class="line-clamp-2 text-xs leading-snug font-medium text-foreground transition-colors group-hover:text-primary"
						>{item.title}</span
					>
					<div class="flex items-center gap-1.5">
						<Badge variant="outline" class="h-4 px-1.5 text-[0.55rem]">
							{item.source}
						</Badge>
						<span class="text-[10px] text-muted-foreground">{relativeTime(item.pubDate)}</span>
					</div>
				</div>
				<ArrowUpRight
					class="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
				/>
			</a>
		{/each}
	</div>
{/if}
