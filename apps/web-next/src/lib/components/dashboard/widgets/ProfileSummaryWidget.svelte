<script lang="ts">
	import { User, Sparkles } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import WidgetError from '../WidgetError.svelte';
	import { loadProfileSummary } from '$lib/remote/widget-data.remote';
	import type { ProfileSummaryConfig } from '$lib/types/widgets';

	let { config }: { config: ProfileSummaryConfig } = $props();

	const summaryQuery = loadProfileSummary();

	let summary = $derived(summaryQuery.current ?? null);
</script>

{#if summaryQuery.loading && !summaryQuery.current}
	<WidgetSkeleton lines={4} />
{:else if summaryQuery.error}
	<WidgetError
		message={summaryQuery.error?.message ?? 'Failed to load profile summary'}
		onRetry={() => loadProfileSummary().refresh()}
	/>
{:else if summary}
	{@const displayText =
		config.compact && (summary.summaryText?.length ?? 0) > 200
			? summary.summaryText!.slice(0, 200) + '…'
			: summary.summaryText ?? ''}
	{@const generatedDate = summary.generatedAt
		? new Date(summary.generatedAt).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			})
		: null}

	<div class="flex flex-col gap-3 p-1">
		<p class="text-sm leading-relaxed text-foreground/90">{displayText}</p>
		<div class="flex flex-wrap items-center gap-2">
			{#if summary.factCountAtGeneration != null}
				<Badge variant="secondary" class="gap-1 text-[0.6rem]">
					<Sparkles class="size-2.5" />
					{summary.factCountAtGeneration} facts
				</Badge>
			{/if}
			{#if summary.intentCountAtGeneration != null}
				<Badge variant="secondary" class="text-[0.6rem]">
					{summary.intentCountAtGeneration} intents
				</Badge>
			{/if}
			{#if generatedDate}
				<span class="text-xs text-muted-foreground">Generated {generatedDate}</span>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex min-h-24 flex-col items-center justify-center gap-2 p-4">
		<User class="size-6 text-muted-foreground/50" />
		<p class="text-sm text-muted-foreground">Profile summary not generated yet</p>
	</div>
{/if}
