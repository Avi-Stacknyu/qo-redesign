<script lang="ts">
	import { Clock3, FileText, Network, Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ProfileData, ProfileSection } from '$lib/data/profile-types';
	import { cn } from '$lib/utils';
	import AnalyticsBars from './AnalyticsBars.svelte';
	import MemoryStatusBadge from './MemoryStatusBadge.svelte';
	import MemorySurfaceCard from './MemorySurfaceCard.svelte';
	import ProgressRing from './ProgressRing.svelte';

	let {
		profile,
		onOpenDiscover,
		onOpenDocument,
		onOpenMemory
	}: {
		profile: ProfileData;
		onOpenDiscover?: () => void;
		onOpenDocument?: () => void;
		onOpenMemory?: () => void;
	} = $props();

	let sortedSections = $derived([...profile.sections].sort((a, b) => a.order - b.order));
	let completedSections = $derived(sortedSections.filter((section) => section.completionPct === 100).length);
	let nextSection = $derived(sortedSections.find((section) => section.completionPct < 100) ?? sortedSections[0]);
	let recentFields = $derived(
		sortedSections
			.flatMap((section) => section.fields.map((field) => ({ ...field, sectionLabel: section.label })))
			.filter((field) => field.value.trim())
			.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
			.slice(0, 6)
	);
	let analyticsMetrics = $derived([
		{ label: 'Completed Sections', value: sortedSections.length ? Math.round((completedSections / sortedSections.length) * 100) : 0 },
		{ label: 'Filled Fields', value: profile.totalFields ? Math.round((profile.filledFields / profile.totalFields) * 100) : 0 }
	]);
	let analyticsBars = $derived(
		sortedSections.map((section, index) => ({
			height: Math.max(36, Math.round(section.completionPct * 1.4)),
			accent: section.completionPct >= 70 || index === 0
		}))
	);

	function sectionTone(section: ProfileSection): 'violet' | 'mint' | 'coral' {
		if (section.completionPct === 100) return 'mint';
		if (section.completionPct >= 40) return 'violet';
		return 'coral';
	}

	function sectionChipClass(section: ProfileSection) {
		if (section.completionPct === 100) return 'border-[#C6F1D8] bg-[#ECFFF4] text-[#36A867]';
		if (section.completionPct >= 40) return 'border-[#E0D5FF] bg-[#F4F0FF] text-[#7C4DFF]';
		return 'border-[#FFD8D1] bg-[#FFF2EF] text-[#E26B54]';
	}
</script>

<div class="mt-6 flex flex-col gap-4">
	<MemorySurfaceCard class="px-4 py-4 md:px-5 md:py-4.5">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div class="flex items-center gap-4">
				<ProgressRing value={profile.overallCompletion} label={`${profile.overallCompletion}%`} />

				<div class="max-w-xl">
					<h2 class="text-lg font-semibold text-[#25324B] md:text-xl">Complete your profile</h2>
					<p class="mt-1 text-sm leading-6 text-[#7B8794] md:text-[15px]">
						Completing your information helps the AI produce better memory recall, summaries, and routing suggestions.
					</p>
				</div>
			</div>

			<Button type="button" onclick={() => onOpenDiscover?.()} class="h-11 rounded-2xl bg-[#7C4DFF] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(124,77,255,0.28)] hover:-translate-y-0.5 hover:bg-[#7347F1]">
				Continue Discovery
			</Button>
		</div>
	</MemorySurfaceCard>

	<div class="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
		<MemorySurfaceCard class="min-h-90 px-4 py-4">
			<div class="flex items-start justify-between gap-3">
				<div class="flex size-9 items-center justify-center rounded-2xl bg-[#F2ECFF] text-[#7C4DFF]">
					<Clock3 class="size-4" />
				</div>
			</div>

			<div class="mt-8">
				<div class="flex items-center gap-2">
					<h3 class="text-lg font-semibold text-[#25324B]">Next Focus</h3>
					{#if nextSection}
						<MemoryStatusBadge label={`${nextSection.completionPct}%`} tone={sectionTone(nextSection)} />
					{/if}
				</div>

				<p class="mt-3 text-sm leading-6 text-[#7B8794]">
					{nextSection ? `${nextSection.label} is the next section to improve.` : 'Your profile is fully completed.'}
				</p>

				<div class="mt-6 space-y-3 text-sm text-[#667085]">
					<p><span class="font-semibold text-[#25324B]">Sections:</span> {sortedSections.length}</p>
					<p><span class="font-semibold text-[#25324B]">Fields:</span> {profile.filledFields}/{profile.totalFields}</p>
					<p><span class="font-semibold text-[#25324B]">Updated:</span> {profile.lastUpdated ? new Date(profile.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
				</div>
			</div>
		</MemorySurfaceCard>

		<MemorySurfaceCard class="min-h-90 px-5 py-5">
			<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h3 class="text-lg font-semibold text-[#25324B]">Recent Profile Signals</h3>
						<MemoryStatusBadge label={`${profile.filledFields} fields`} tone="mint" />
					</div>
					<p class="mt-1 text-sm text-[#7B8794]">The latest information captured across your structured profile.</p>
				</div>

				<Button variant="ghost" type="button" onclick={() => onOpenDocument?.()} class="h-auto px-0 text-sm font-semibold text-[#7C4DFF] hover:bg-transparent hover:text-[#6D42E8]">
					<FileText data-icon="inline-start" />
					View document
				</Button>
			</div>

			<div class="mt-7 grid gap-5 md:grid-cols-2 md:gap-x-8">
				{#if recentFields.length > 0}
					{#each recentFields as field}
						<div>
							<p class="text-[10px] font-semibold tracking-[0.12em] text-[#98A2B3] uppercase">{field.sectionLabel}</p>
							<p class="mt-2 text-sm font-semibold text-[#25324B]">{field.label}</p>
							<p class="mt-1 text-sm leading-6 text-[#667085]">{field.value}</p>
						</div>
					{/each}
				{:else}
					<p class="text-sm text-[#7B8794]">No profile fields have been captured yet. Start with the Discover tab.</p>
				{/if}
			</div>
		</MemorySurfaceCard>
	</div>

	<div class="grid gap-4 xl:grid-cols-[1.08fr_1fr]">
		<MemorySurfaceCard class="min-h-66 px-5 py-5">
			<div class="flex items-start gap-3">
				<div class="flex size-9 items-center justify-center rounded-2xl bg-[#F2ECFF] text-[#7C4DFF]">
					<Sparkles class="size-4" />
				</div>

				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h3 class="text-lg font-semibold text-[#25324B]">Profile Sections</h3>
						<MemoryStatusBadge label={`${completedSections}/${sortedSections.length} complete`} />
					</div>
					<p class="mt-1 text-sm text-[#7B8794]">Track progress across the areas your AI uses for context.</p>
				</div>
			</div>

			<div class="mt-6 flex flex-wrap gap-2.5">
				{#each sortedSections as section}
					<span class={cn('inline-flex items-center rounded-2xl border px-3 py-2 text-sm font-medium', sectionChipClass(section))}>
						{section.label} · {section.completionPct}%
					</span>
				{/each}
			</div>
		</MemorySurfaceCard>

		<MemorySurfaceCard class="min-h-66 px-5 py-5">
			<div class="flex items-start gap-3">
				<div class="flex size-9 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#5D7BFF]">
					<Network class="size-4" />
				</div>

				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h3 class="text-lg font-semibold text-[#25324B]">Memory Graph</h3>
						<MemoryStatusBadge label="Live" tone="slate" />
					</div>
					<p class="mt-1 text-sm text-[#7B8794]">Open the memory graph to inspect linked facts and uploaded sources.</p>
				</div>
			</div>

			<div class="mt-6 flex flex-col gap-5">
				{#each analyticsMetrics as metric}
					<div>
						<div class="mb-2 flex items-center justify-between gap-4 text-sm font-semibold text-[#4D5B75]">
							<span>{metric.label}</span>
							<span class="text-[#7C4DFF]">{metric.value}%</span>
						</div>
						<div class="h-2 rounded-full bg-[#E5ECFA]">
							<div class="h-full rounded-full bg-[#7C4DFF]" style={`width: ${metric.value}%`}></div>
						</div>
					</div>
				{/each}
			</div>
		</MemorySurfaceCard>
	</div>

	<MemorySurfaceCard class="px-5 py-5">
		<div class="grid gap-6 xl:grid-cols-[0.94fr_1.06fr] xl:items-end">
			<div>
				<h3 class="text-lg font-semibold text-[#25324B]">Analytics Engagement</h3>
				<p class="mt-2 max-w-sm text-sm leading-6 text-[#7B8794]">
					Section completion density over your current profile. Higher completion improves summary and search quality.
				</p>

				<div class="mt-6 flex items-center gap-3">
					<Button type="button" variant="outline" onclick={() => onOpenMemory?.()} class="rounded-full border-[#D7C8FF] bg-[#F8F4FF] px-4 py-2 text-sm font-semibold text-[#7C4DFF] hover:bg-[#F1E9FF]">
						Open Memory Graph
					</Button>
				</div>
			</div>

			<AnalyticsBars bars={analyticsBars} />
		</div>
	</MemorySurfaceCard>
</div>