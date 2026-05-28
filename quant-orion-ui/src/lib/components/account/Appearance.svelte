<script lang="ts">
	import { cn } from '$lib/utils';
	import { Check, Crown, Globe, Sparkles } from '@lucide/svelte';
	import * as Card from '../ui/card';
	import {
		THEME_GROUPS,
		THEME_PRESET_LIST,
		THEME_PRESETS,
		type ThemeMode
	} from '$lib/constants/data';
	import Badge from '../ui/badge/badge.svelte';
	import * as Tooltip from '../ui/tooltip';

	type PaletteGroup = 'base' | 'premium' | 'brand';

	const { selectedMode = 'base' }: { selectedMode?: PaletteGroup } = $props();

	let currentPreset = $state<string>('orion');
	let currentMode = $state<ThemeMode>('dark');

	const basePresets = THEME_PRESET_LIST.filter((preset) => preset.group === 'base');
	const premiumPresets = THEME_PRESET_LIST.filter((preset) => preset.group === 'premium');
	const brandPresets = THEME_PRESET_LIST.filter((preset) => preset.group === 'brand');
	const presetsByGroup: Record<PaletteGroup, typeof THEME_PRESET_LIST> = {
		base: basePresets,
		premium: premiumPresets,
		brand: brandPresets
	};

	function selectPreset(presetId: string) {
		currentPreset = presetId;
	}

	function selectMode(mode: ThemeMode) {
		currentMode = mode;
	}

	const groupIcons = { base: Sparkles, premium: Crown, brand: Globe } as const;
	let visiblePresets = $derived(presetsByGroup[selectedMode]);
	let activeMeta = $derived(THEME_GROUPS[selectedMode]);
	let ActiveGroupIcon = $derived(groupIcons[selectedMode]);

	$effect(() => {
		if (!visiblePresets.some((preset) => preset.id === currentPreset)) {
			currentPreset = visiblePresets[0]?.id ?? currentPreset;
		}
	});
</script>

<section class="space-y-6" aria-label="Appearance settings">
	<!-- Theme Presets by Group -->
	<Card.Root class="overflow-hidden bg-transparent ring-transparent">
		<Card.Content class="p-6">
			<!-- <div class="mb-5 flex items-center gap-2.5">
				<div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<ActiveGroupIcon class="size-4" />
				</div>
				<div>
					<h3 class="text-sm font-semibold text-foreground">{activeMeta.label}</h3>
					<p class="text-xs text-muted-foreground">{activeMeta.description}</p>
				</div>
				<Badge variant="outline" class="ml-auto rounded-full text-[10px]">
					{visiblePresets.length}
				</Badge>
			</div> -->

			<div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
				{#each visiblePresets as preset (preset.id)}
					{@const presetData = THEME_PRESETS[preset.id]}
					{@const colors =
						presetData?.[currentMode] ?? presetData?.[currentMode === 'dark' ? 'light' : 'dark']}
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<button
										{...props}
										type="button"
										onclick={() => selectPreset(preset.id)}
										class={cn(
											'group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all duration-200',
											currentPreset === preset.id
												? 'border-primary bg-primary/5 shadow-md ring-2 shadow-primary/10 ring-primary/20'
												: 'border-border/30 bg-muted/10 hover:border-border/50 hover:bg-muted/30 hover:shadow-sm'
										)}
										aria-label="Select {preset.label} theme"
									>
										<div class="relative flex w-full items-center justify-center gap-1">
											<div
												class="size-7 rounded-full border border-border/20 shadow-sm transition-transform duration-200 group-hover:scale-110"
												style="background-color: {colors?.primary ?? 'var(--primary)'}"
											></div>
											<div
												class="size-5 rounded-full border border-border/20 shadow-sm transition-transform duration-200 group-hover:scale-105"
												style="background-color: {colors?.secondary ?? 'var(--secondary)'}"
											></div>
											<div
												class="size-4 rounded-full border border-border/20 shadow-sm"
												style="background-color: {colors?.accent ?? 'var(--accent)'}"
											></div>
										</div>

										<span
											class="max-w-full truncate text-[11px] leading-tight font-medium text-muted-foreground transition-colors group-hover:text-foreground"
										>
											{preset.label}
										</span>

										{#if currentPreset === preset.id}
											<div
												class="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
											>
												<Check class="size-3" />
											</div>
										{/if}
									</button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="bottom" class="text-xs">
								{preset.label}
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Active Theme Info -->
	<!-- <Card.Root class="overflow-hidden rounded-xl border-primary/20 bg-primary/5 shadow-sm">
		<Card.Content class="flex items-center gap-3 p-4">
			<div
				class="size-6 shrink-0 rounded-full shadow-sm"
				style="background-color: {THEME_PRESETS[currentPreset]?.[currentMode]?.primary ??
					'var(--primary)'}"
			></div>
			<div class="min-w-0 flex-1">
				<p class="text-xs font-medium text-foreground">
					Active: <span class="text-primary"
						>{THEME_PRESET_LIST.find((p) => p.id === currentPreset)?.label ?? currentPreset}</span
					>
				</p>
				<p class="text-[11px] text-muted-foreground">
					Preview only. This screen shows static palette options without live theme syncing.
				</p>
			</div>
		</Card.Content>
	</Card.Root> -->
</section>
