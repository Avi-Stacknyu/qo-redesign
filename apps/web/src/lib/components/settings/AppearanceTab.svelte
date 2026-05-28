<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Separator } from '$lib/components/shadcn/separator/index.js';
	import * as Tooltip from '$lib/components/shadcn/tooltip/index.js';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import { THEME_PRESETS } from '$lib/theme-presets';
	import { THEME_GROUPS, THEME_PRESET_LIST, type ThemeMode } from '$lib/types/theme';
	import { cn } from '$lib/utils';
	import { Check, Crown, Globe, Moon, Sparkles, Sun } from '@lucide/svelte';

	let currentPreset = $derived(dashboard.activeProfile?.theme_preset ?? 'orion');
	let currentMode = $derived((dashboard.activeProfile?.theme_mode as ThemeMode) ?? 'dark');

	let basePresets = $derived(THEME_PRESET_LIST.filter((p) => p.group === 'base'));
	let premiumPresets = $derived(THEME_PRESET_LIST.filter((p) => p.group === 'premium'));
	let brandPresets = $derived(THEME_PRESET_LIST.filter((p) => p.group === 'brand'));

	function selectPreset(presetId: string) {
		dashboard.updateTheme(presetId, currentMode);
	}

	function selectMode(mode: ThemeMode) {
		dashboard.updateTheme(currentPreset, mode);
	}

	const groupIcons = { base: Sparkles, premium: Crown, brand: Globe } as const;
</script>

<section class="space-y-6" aria-label="Appearance settings">
	<div class="space-y-1">
		<h2 class="text-xl font-semibold tracking-tight text-foreground">Appearance</h2>
		<p class="text-sm text-muted-foreground">
			Customize your visual experience with themes and color modes.
		</p>
	</div>

	<!-- Mode Selector -->
	<Card.Root class="overflow-hidden rounded-xl border-border/40 bg-card/90 shadow-lg backdrop-blur">
		<Card.Content class="p-6">
			<div class="mb-4 flex items-center justify-between">
				<span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
					>Color Mode</span
				>
				<Badge variant="secondary" class="rounded-full px-2.5 py-0.5 text-[10px] font-medium">
					{currentMode === 'dark' ? 'Dark' : 'Light'}
				</Badge>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<button
					type="button"
					onclick={() => selectMode('light')}
					class={cn(
						'group relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-5 transition-all duration-200',
						currentMode === 'light'
							? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
							: 'border-border/40 bg-muted/20 hover:border-border/60 hover:bg-muted/40'
					)}
					aria-label="Switch to light mode"
				>
					<div
						class={cn(
							'flex size-12 items-center justify-center rounded-xl transition-all duration-200',
							currentMode === 'light'
								? 'bg-primary/10 text-primary shadow-sm'
								: 'bg-muted/40 text-muted-foreground group-hover:bg-muted/60'
						)}
					>
						<Sun class="size-5" />
					</div>
					<span class="text-sm font-medium">Light</span>
					{#if currentMode === 'light'}
						<div
							class="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
						>
							<Check class="size-3" />
						</div>
					{/if}
				</button>

				<button
					type="button"
					onclick={() => selectMode('dark')}
					class={cn(
						'group relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-5 transition-all duration-200',
						currentMode === 'dark'
							? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
							: 'border-border/40 bg-muted/20 hover:border-border/60 hover:bg-muted/40'
					)}
					aria-label="Switch to dark mode"
				>
					<div
						class={cn(
							'flex size-12 items-center justify-center rounded-xl transition-all duration-200',
							currentMode === 'dark'
								? 'bg-primary/10 text-primary shadow-sm'
								: 'bg-muted/40 text-muted-foreground group-hover:bg-muted/60'
						)}
					>
						<Moon class="size-5" />
					</div>
					<span class="text-sm font-medium">Dark</span>
					{#if currentMode === 'dark'}
						<div
							class="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
						>
							<Check class="size-3" />
						</div>
					{/if}
				</button>
			</div>
		</Card.Content>
	</Card.Root>

	<Separator class="bg-border/30" />

	<!-- Theme Presets by Group -->
	{#each [{ key: 'base', presets: basePresets }, { key: 'premium', presets: premiumPresets }, { key: 'brand', presets: brandPresets }] as group (group.key)}
		{@const meta = THEME_GROUPS[group.key as keyof typeof THEME_GROUPS]}
		{@const GroupIcon = groupIcons[group.key as keyof typeof groupIcons]}
		<Card.Root
			class="overflow-hidden rounded-xl border-border/40 bg-card/90 shadow-lg backdrop-blur"
		>
			<Card.Content class="p-6">
				<div class="mb-5 flex items-center gap-2.5">
					<div
						class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<GroupIcon class="size-4" />
					</div>
					<div>
						<h3 class="text-sm font-semibold text-foreground">{meta.label}</h3>
						<p class="text-xs text-muted-foreground">{meta.description}</p>
					</div>
					<Badge variant="outline" class="ml-auto rounded-full text-[10px]">
						{group.presets.length}
					</Badge>
				</div>

				<div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
					{#each group.presets as preset (preset.id)}
						{@const presetData = THEME_PRESETS[preset.id]}
						{@const colors =
							presetData?.[currentMode] ?? presetData?.[currentMode === 'dark' ? 'light' : 'dark']}
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
										<!-- Swatch Preview -->
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

										<!-- Label -->
										<span
											class="max-w-full truncate text-[11px] leading-tight font-medium text-muted-foreground transition-colors group-hover:text-foreground"
										>
											{preset.label}
										</span>

										<!-- Active Check -->
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
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	{/each}

	<!-- Active Theme Info -->
	<Card.Root class="overflow-hidden rounded-xl border-primary/20 bg-primary/5 shadow-sm">
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
					Theme changes apply instantly and sync across devices.
				</p>
			</div>
		</Card.Content>
	</Card.Root>
</section>
