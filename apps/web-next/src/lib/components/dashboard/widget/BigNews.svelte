<script lang="ts">
	import { loadNews, type NewsItem } from '$lib/remote/news.remote';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import WidgetError from '../WidgetError.svelte';
	import { Rss } from '@lucide/svelte';

	const news = loadNews();

	let items = $derived((news.current ?? []) as NewsItem[]);

	function relativeTime(dateStr: string): string {
		if (!dateStr) return '';
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
		const items = (news.current ?? []) as NewsItem[];
		const rule = FILTER_MAP[activeFilter ?? 'Markets'];
		if (!rule) return items;
		return items.filter((item) => {
			const text = `${item.title} ${item.description}`.toLowerCase();
			return rule.sources?.includes(item.source) || rule.keywords?.some((kw) => text.includes(kw));
		});
	});

	function relativeTime(dateStr: string): string {
		if (!dateStr) return '';
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

{#if news.loading && !news.current}
	<WidgetSkeleton lines={3} />
{:else if news.error}
	<WidgetError
		message={news.error?.message ?? 'Failed to load news'}
		onRetry={() => loadNews().refresh()}
	/>
{:else if items.length === 0}
	<div class="flex min-h-28 flex-col items-center justify-center gap-3 p-4 text-center">
		<div class="rounded-full bg-muted/60 p-3">
			<Rss class="size-6 text-muted-foreground/70" />
		</div>
		<p class="text-sm font-medium text-muted-foreground">No news available</p>
	</div>
{:else}
	<div
		class="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		style="scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;"
	>
		{#each items as item (item.id)}
			<a
				href={item.link}
				target="_blank"
				rel="noopener noreferrer"
				class="group flex min-w-60 max-w-85 shrink-0 basis-[calc(33.333%-11px)] snap-start flex-col gap-3 rounded-2xl p-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
			>
				<!-- Thumbnail -->
				<div class="aspect-video w-full overflow-hidden rounded-2xl bg-muted/50">
					{#if item.thumbnail}
						<img
							src={item.thumbnail}
							alt={item.title}
							class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
							loading="lazy"
						/>
					{:else}
						<div class="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/10 to-primary/5">
							<Rss class="size-8 text-primary/30" />
						</div>
					{/if}
				</div>

				<!-- Meta -->
				<div class="flex items-center gap-1.5">
					<Badge
						variant="outline"
						class="border-0 bg-transparent px-0 text-[10px] font-bold uppercase tracking-widest text-primary"
					>
						{item.source}
					</Badge>
					{#if item.pubDate}
						<span class="text-[10px] text-muted-foreground">• {relativeTime(item.pubDate)}</span>
					{/if}
				</div>

				<!-- Headline -->
				<h4 class="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
					{item.title}
				</h4>

				<!-- Body -->
				{#if item.description}
					<p class="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
						{item.description}
					</p>
				{/if}
			</a>
		{/each}
	</div>
{/if}
