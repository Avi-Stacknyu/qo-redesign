<script lang="ts">
	import { Check, Moon, Sun, Palette } from '@lucide/svelte';
	import * as Popover from '$lib/components/shadcn/popover/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { cn } from '$lib/utils';
	import { THEME_PRESET_LIST, type ThemeMode } from '$lib/types/theme';
	import { THEME_PRESETS } from '$lib/theme-presets';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		trigger
	}: {
		open?: boolean;
		trigger?: Snippet;
	} = $props();

	let currentPreset = $derived(dashboard.activeProfile?.theme_preset ?? 'orion');
	let currentMode = $derived((dashboard.activeProfile?.theme_mode as ThemeMode) ?? 'dark');

	function handlePresetSelect(preset: string) {
		dashboard.updateTheme(preset, currentMode);
	}

	function handleModeToggle(mode: ThemeMode) {
		dashboard.updateTheme(currentPreset, mode);
	}

	const activePresetInfo = $derived(
		THEME_PRESET_LIST.find((p) => p.id === currentPreset) ?? THEME_PRESET_LIST[0]
	);
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			{#if trigger}
				<span {...props}>
					{@render trigger()}
				</span>
			{:else}
				<Button {...props} variant="outline" size="sm" class="gap-2">
					<Palette class="size-4" />
					<span class="hidden sm:inline">Theme</span>
					<Badge variant="secondary" class="hidden rounded-full px-2 py-0.5 text-[10px] lg:inline">
						{activePresetInfo.label}
					</Badge>
				</Button>
			{/if}
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		align="end"
		class="w-64 rounded-xl border-border/60 bg-card/95 p-3 shadow-xl backdrop-blur"
	>
		<!-- Header -->
		<div class="mb-3 flex items-center justify-between">
			<span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Theme</span>

			<div class="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-0.5">
				<button
					type="button"
					onclick={() => handleModeToggle('light')}
					class={cn(
						'inline-flex size-6 items-center justify-center rounded-full transition-all',
						currentMode === 'light'
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					)}
					title="Light Mode"
				>
					<Sun class="size-3.5" />
				</button>
				<button
					type="button"
					onclick={() => handleModeToggle('dark')}
					class={cn(
						'inline-flex size-6 items-center justify-center rounded-full transition-all',
						currentMode === 'dark'
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					)}
					title="Dark Mode"
				>
					<Moon class="size-3.5" />
				</button>
			</div>
		</div>

		<!-- Swatch Grid -->
		<div class="grid grid-cols-5 gap-2">
			{#each THEME_PRESET_LIST as preset (preset.id)}
				<button
					type="button"
					onclick={() => handlePresetSelect(preset.id)}
					class={cn(
						'group relative flex aspect-square items-center justify-center rounded-full border-2 transition-all hover:scale-110',
						currentPreset === preset.id
							? 'border-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background'
							: 'border-transparent hover:border-border'
					)}
					title={preset.label}
				>
					<!-- Swatch Circle -->
					<div
						class="size-full rounded-full border border-border/20 shadow-sm"
						style={`background-color: ${THEME_PRESETS[preset.id][currentMode].primary}`}
					></div>

					{#if currentPreset === preset.id}
						<div class="absolute inset-0 flex items-center justify-center">
							<Check class="size-3 text-primary-foreground drop-shadow-md" />
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
