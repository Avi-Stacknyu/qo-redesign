<script lang="ts">
	import { ArrowRight, CheckCircle2, Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ProfileData, ProfileSection } from '$lib/data/profile-types';
	import ProfileDiscoverTab from '$lib/components/profile/ProfileDiscoverTab.svelte';
	import { cn } from '$lib/utils';
	import MemorySurfaceCard from './MemorySurfaceCard.svelte';

	let {
		profile,
		defaultAgentId,
		onThreadReady,
		onOpenProfile
	}: {
		profile: ProfileData;
		defaultAgentId: string;
		onThreadReady?: (threadId: string) => void;
		onOpenProfile?: () => void;
	} = $props();

	type SectionProgress = {
		label: string;
		progress: number;
		accent: 'violet' | 'slate' | 'emerald';
	};

	let onboardingSections = $derived<SectionProgress[]>(
		[...profile.sections]
			.sort((a, b) => a.order - b.order)
			.map((section: ProfileSection) => ({
				label: section.label,
				progress: section.completionPct,
				accent:
					section.completionPct === 100
						? 'emerald'
						: section.completionPct >= 40
							? 'violet'
							: 'slate'
			}))
	);

	function progressTrackClass(accent: SectionProgress['accent']) {
		if (accent === 'emerald') return 'bg-[#E9FBF2]';
		if (accent === 'violet') return 'bg-[#F0EAFE]';
		return 'bg-[#EEF2F7]';
	}

	function progressFillClass(accent: SectionProgress['accent']) {
		if (accent === 'emerald') return 'bg-[#1BB76E]';
		if (accent === 'violet') return 'bg-[#7C4DFF]';
		return 'bg-[#CBD5E1]';
	}

	function panelClass(accent: SectionProgress['accent']) {
		if (accent === 'emerald') return 'border-[#CBEFD8] bg-[#F3FFF8]';
		if (accent === 'violet') return 'border-[#E8DFFD] bg-[#F7F3FF]';
		return 'border-[#EEF2F6] bg-[#F8FAFC]';
	}
</script>

<div class="mt-6 flex flex-col gap-4">
	<div class="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
		<MemorySurfaceCard class="min-h-180 border-white/80 bg-white/78 px-5 py-5 backdrop-blur-sm">
			<div>
				<h2 class="text-lg font-semibold text-[#25324B]">Onboarding Sections</h2>
			</div>

			<div class="mt-5 flex flex-col gap-4">
				{#each onboardingSections as section}
					<div class={cn('rounded-2xl border p-4', panelClass(section.accent))}>
						<div class="mb-3 flex items-center justify-between gap-3">
							<p class="text-[13px] font-semibold text-[#4A5568]">{section.label}</p>
							<div class="flex items-center gap-2 text-[12px] font-semibold text-[#7B8794]">
								{#if section.progress === 100}
									<CheckCircle2 class="size-3.5 text-[#1BB76E]" />
								{/if}
								<span>{section.progress}%</span>
							</div>
						</div>

						<div class={cn('h-2 rounded-full', progressTrackClass(section.accent))}>
							<div
								class={cn(
									'h-full rounded-full transition-[width] duration-500',
									progressFillClass(section.accent)
								)}
								style={`width: ${section.progress}%`}
							></div>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-auto rounded-[24px] bg-[#111A2E] p-4 text-white shadow-[0_18px_40px_rgba(17,26,46,0.24)]">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-white/45 uppercase">Pro Tip</p>
				<p class="mt-3 text-sm leading-6 text-white/85">
					Complete your lowest-progress section to improve agent suggestions and profile recall quality.
				</p>
			</div>
		</MemorySurfaceCard>

		<MemorySurfaceCard class="rounded-[30px] border-white/80 bg-white/64 p-3 backdrop-blur-sm">
			<div class="h-full rounded-[26px] bg-white/90 p-3 shadow-sm">
				<ProfileDiscoverTab {profile} {defaultAgentId} {onThreadReady} />
			</div>
		</MemorySurfaceCard>
	</div>

	<div class="flex flex-col gap-4 rounded-[24px] border border-white/80 bg-white/78 px-5 py-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm md:flex-row md:items-center">
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold text-[#25324B]">Overall Progress</p>
			<div class="mt-3 h-3 rounded-full bg-[#E8EEF7]">
				<div class="h-full rounded-full bg-[#7C4DFF] transition-[width]" style={`width: ${profile.overallCompletion}%`}></div>
			</div>
		</div>

		<div class="flex items-center justify-between gap-4 md:min-w-55 md:justify-end">
			<p class="text-base font-semibold text-[#7C4DFF]">{profile.overallCompletion}%</p>
			<Button
				type="button"
				onclick={() => onOpenProfile?.()}
				class="h-11 rounded-full bg-[#111A2E] px-5 text-sm font-semibold text-white hover:bg-[#0A1120]"
			>
				Review Profile
				<ArrowRight data-icon="inline-end" />
			</Button>
		</div>
	</div>
</div>