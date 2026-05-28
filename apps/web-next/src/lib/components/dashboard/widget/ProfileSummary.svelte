<script lang="ts">
	import { Sparkles, User } from '@lucide/svelte';
	import { loadProfileSummary } from '$lib/remote/widget-data.remote';
	import type { ProfileSummaryConfig } from '$lib/types/widgets';
	import WidgetError from '../WidgetError.svelte';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';

	let { config }: { config?: ProfileSummaryConfig } = $props();
	let resolvedConfig = $derived(config ?? { compact: false });

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
		resolvedConfig.compact && (summary.summaryText?.length ?? 0) > 200
			? summary.summaryText!.slice(0, 200) + '…'
			: summary.summaryText ?? ''}
	{@const generatedDate = summary.generatedAt
		? new Date(summary.generatedAt).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			})
		: null}

	<div class="flex flex-col gap-3">
		<p class="text-[15px] leading-relaxed text-slate-700">{displayText}</p>

		<div class="flex flex-wrap items-center gap-2">
			{#if summary.factCountAtGeneration != null}
				<div class="inline-flex items-center gap-1.5 rounded-2xl border border-[#F6F6F6] bg-[#F6F6F6] px-3 py-1 text-xs font-medium text-[#83899F]">
					<Sparkles class="size-3" />
					{summary.factCountAtGeneration} facts
				</div>
			{/if}

			{#if summary.intentCountAtGeneration != null}
				<div class="rounded-2xl border border-[#F6F6F6] bg-[#F6F6F6] px-3 py-1 text-xs font-medium text-[#83899F]">
					{summary.intentCountAtGeneration} intents
				</div>
			{/if}

			{#if generatedDate}
				<span class="text-xs font-medium text-[#83899F]">Generated {generatedDate}</span>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex min-h-24 flex-col items-center justify-center gap-2 p-4">
		<User class="size-6 text-muted-foreground/50" />
		<p class="text-sm text-muted-foreground">Profile summary not generated yet</p>
	</div>
{/if}