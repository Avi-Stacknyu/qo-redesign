<script lang="ts">
	import { cn } from '$lib/utils';
	import type { ProfileData } from '$lib/data/profile-types';

	let { profile }: { profile: ProfileData } = $props();

	let pct = $derived(profile.overallCompletion);
	let barColor = $derived(pct >= 70 ? 'bg-emerald-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-400');
	let formattedDate = $derived(
		profile.lastUpdated
			? new Date(profile.lastUpdated).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric'
				})
			: '—'
	);
</script>

{#if profile.sections.length > 0}
	<div
		class="flex items-center gap-4 rounded-lg border border-border/30 bg-card/40 px-4 py-2.5 text-xs backdrop-blur"
	>
		<div class="flex items-center gap-2">
			<span class="text-muted-foreground">Completion</span>
			<div class="h-1.5 w-20 overflow-hidden rounded-full bg-primary/10">
				<div class={cn('h-full rounded-full transition-all', barColor)} style="width: {pct}%"></div>
			</div>
			<span class="font-medium text-foreground tabular-nums">{pct}%</span>
		</div>
		<!-- <span class="text-border/60">·</span>
		<span class="text-muted-foreground">
			<span class="font-medium text-foreground">{profile.filledFields}</span>/{profile.totalFields} fields
		</span>
		<span class="text-border/60">·</span>
		<span class="text-muted-foreground">
			<span class="font-medium text-foreground">{profile.sections.length}</span> sections
		</span> -->
		<span class="text-border/60">·</span>
		<span class="text-muted-foreground">Updated {formattedDate}</span>
	</div>
{/if}
