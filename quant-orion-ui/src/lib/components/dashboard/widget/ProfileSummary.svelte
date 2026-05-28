<script lang="ts">
	import { User, Sparkles } from '@lucide/svelte';
	import type { ProfileSummaryConfig } from '$lib/types/widgets';

	let { config = {} }: { config?: ProfileSummaryConfig } = $props();

	const summary = {
		summaryText:
			'A product-focused engineer with deep experience in frontend systems, design tooling, and AI-assisted workflows. Frequently works on dashboard UIs, component libraries, and real-time data visualization.',
		factCountAtGeneration: 24,
		intentCountAtGeneration: 8,
		generatedAt: '2026-05-25T10:30:00Z'
	};

	let displayText = $derived(
		config.compact && summary.summaryText.length > 200
			? summary.summaryText.slice(0, 200) + '…'
			: summary.summaryText
	);

	let generatedDate = $derived(
		new Date(summary.generatedAt).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	);
</script>

<div class="flex flex-col gap-3">
	<p class="text-[15px] leading-relaxed text-slate-700">
		{displayText}
	</p>

	<div class="flex flex-wrap items-center gap-2">
		<div
			class="inline-flex items-center gap-1.5 rounded-2xl border border-[#F6F6F6] bg-[#F6F6F6] px-3 py-1 text-xs font-medium text-[#83899F]"
		>
			<Sparkles class="size-3" />
			{summary.factCountAtGeneration} facts
		</div>

		<div
			class="rounded-2xl border border-[#F6F6F6] bg-[#F6F6F6] px-3 py-1 text-xs font-medium text-[#83899F]"
		>
			{summary.intentCountAtGeneration} intents
		</div>

		<span class="text-xs font-medium text-[#83899F]">
			Generated {generatedDate}
		</span>
	</div>
</div>
