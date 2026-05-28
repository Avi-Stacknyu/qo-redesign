<script lang="ts">
	import CustomSelect from '$lib/components/account/CustomSelect.svelte';
	import type { SelectOption } from '$lib/components/account/types';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import { THEME_PRESETS } from '$lib/theme-presets';
	import { THEME_GROUPS, THEME_PRESET_LIST, type ThemeMode } from '$lib/types/theme';
	import { cn } from '$lib/utils';
	import { Check } from '@lucide/svelte';

	type PaletteGroup = 'base' | 'premium' | 'brand';

	let currentPreset = $derived(dashboard.activeProfile?.theme_preset ?? 'orion');
	let currentMode = $derived((dashboard.activeProfile?.theme_mode as ThemeMode) ?? 'dark');
	let selectedAppearanceGroup = $state<PaletteGroup>(
		THEME_PRESET_LIST.find((preset) => preset.id === currentPreset)?.group ?? 'base'
	);

	const appearanceGroupOptions: SelectOption[] = [
		{ value: 'base', label: 'Base' },
		{ value: 'premium', label: 'Premium' },
		{ value: 'brand', label: 'Brand' }
	];

	const modeOptions: SelectOption[] = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	let visiblePresets = $derived(
		THEME_PRESET_LIST.filter((preset) => preset.group === selectedAppearanceGroup)
	);
	let activeMeta = $derived(THEME_GROUPS[selectedAppearanceGroup]);
	let currentPresetLabel = $derived(
		THEME_PRESET_LIST.find((preset) => preset.id === currentPreset)?.label ?? currentPreset
	);

	function selectPreset(presetId: string) {
		dashboard.updateTheme(presetId, currentMode);
	}

	function selectMode(value: string) {
		if (value === 'light' || value === 'dark') {
			dashboard.updateTheme(currentPreset, value);
		}
	}
</script>

<Tooltip.Provider>
	<div class="flex w-full flex-col gap-10 p-4">
		<div class="flex flex-col gap-10">
			<section class="flex flex-col gap-1">
				<h1 class="font-Inter text-3xl font-medium text-primary">Appearance</h1>
				<p class="text-muted-foreground">Change the appearance of your interface</p>
			</section>

			<section class="flex flex-col gap-5">
				<img
					src="/images/rainbow.png"
					alt="Theme preview"
					class="max-h-60 w-full rounded-2xl object-cover"
				/>

				<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
					<div class="flex flex-col gap-1">
						<h2 class="text-2xl font-medium text-primary">Choose the mode</h2>
						<p class="text-muted-foreground">Change the appearance of your interface</p>
					</div>

					<CustomSelect
						value={currentMode}
						options={modeOptions}
						placeholder="Choose Mode"
						onValueChange={selectMode}
					/>
				</div>
			</section>

			<section class="flex flex-col gap-5">
				<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
					<div class="flex flex-col gap-1">
						<h2 class="text-2xl font-medium text-primary">Accent Colors</h2>
						<p class="text-muted-foreground">{activeMeta.description}</p>
					</div>

					<CustomSelect
						value={selectedAppearanceGroup}
						options={appearanceGroupOptions}
						placeholder="Base"
						onValueChange={(value) => {
							if (value === 'base' || value === 'premium' || value === 'brand') {
								selectedAppearanceGroup = value;
							}
						}}
					/>
				</div>

				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
					{#each visiblePresets as preset (preset.id)}
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
											'group relative flex flex-col items-center gap-2 rounded-[1.5rem] border p-4 transition-all duration-200',
											currentPreset === preset.id
												? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/15'
												: 'border-border/30 bg-card/70 hover:border-border/60 hover:bg-card hover:shadow-sm'
										)}
										aria-label="Select {preset.label} theme"
									>
										<div class="relative flex w-full items-center justify-center gap-1">
											<div
												class="size-8 rounded-full border border-border/20 shadow-sm transition-transform duration-200 group-hover:scale-110"
												style="background-color: {colors?.primary ?? 'var(--primary)'}"
											></div>
											<div
												class="size-6 rounded-full border border-border/20 shadow-sm transition-transform duration-200 group-hover:scale-105"
												style="background-color: {colors?.secondary ?? 'var(--secondary)'}"
											></div>
											<div
												class="size-5 rounded-full border border-border/20 shadow-sm"
												style="background-color: {colors?.accent ?? 'var(--accent)'}"
											></div>
										</div>

										<span class="max-w-full truncate text-[11px] font-medium text-muted-foreground">
											{preset.label}
										</span>

										{#if currentPreset === preset.id}
											<div class="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
												<Check class="size-3" />
											</div>
										{/if}
									</button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="bottom" class="text-xs">{preset.label}</Tooltip.Content>
						</Tooltip.Root>
					{/each}
				</div>

				<div class="rounded-[1.75rem] border border-primary/15 bg-primary/5 p-4">
					<p class="text-sm font-medium text-primary">Current theme: {currentPresetLabel}</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Changes apply instantly to the active dashboard and sync to your saved profile.
					</p>
				</div>
			</section>
		</div>
	</div>
</Tooltip.Provider>
