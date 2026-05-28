<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/shadcn/popover';
	import { cn } from '$lib/utils';
	import { Check, Moon, Palette, Sun } from '@lucide/svelte';
	import {
		getThemeState,
		listThemePresets,
		setThemeMode,
		setThemePreset
	} from './themeStore.svelte';
	import type { ThemeMode, ThemeStyles } from './types';

	type ThemePresetWithPreview = ReturnType<typeof listThemePresets>[number] & {
		preview: string[];
	};

	const presetOptions: ThemePresetWithPreview[] = listThemePresets().map((option) => ({
		...option,
		preview: buildPreviewPalette(option.styles)
	}));

	let popoverOpen = $state(false);
	let activePreset = $state(presetOptions[0]);

	// Derive current theme state
	let currentTheme = $derived(getThemeState());

	$effect(() => {
		activePreset =
			presetOptions.find((option) => option.id === currentTheme.preset) ?? presetOptions[0];
	});

	function buildPreviewPalette(styles: ThemeStyles): string[] {
		const keys = ['background', 'primary', 'accent', 'muted', 'chart-1'] as const;
		const swatches: string[] = [];

		for (const key of keys) {
			const value = styles.light[key] ?? styles.dark[key];
			if (typeof value === 'string' && value.length && !swatches.includes(value)) {
				swatches.push(value);
			}

			if (swatches.length === 4) break;
		}

		if (!swatches.length) {
			swatches.push('hsl(var(--primary))');
		}

		return swatches;
	}

	function isRecentlyAdded(createdAt?: string): boolean {
		if (!createdAt) return false;
		const timestamp = Date.parse(createdAt);
		if (Number.isNaN(timestamp)) return false;
		const daysElapsed = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
		return daysElapsed <= 45;
	}

	function handleModeChange(mode: ThemeMode) {
		setThemeMode(mode);
	}

	function handlePresetSelect(preset: string) {
		setThemePreset(preset);
		popoverOpen = false;
	}
</script>

<Popover bind:open={popoverOpen}>
	<PopoverTrigger
		class="{buttonVariants({
			variant: 'outline',
			size: 'sm'
		})} flex w-auto items-center gap-2 rounded-full border-border/70 bg-background/80 px-4 py-1 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/60 hover:bg-card/80 hover:text-primary max-md:aspect-square"
	>
		<Palette class="h-4 w-4 text-muted-foreground" />
		<span class="hidden md:inline">Theme</span>
		<span
			class=" hidden rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground lg:inline-flex"
		>
			{activePreset.label}
		</span>
	</PopoverTrigger>
	<PopoverContent
		align="end"
		class="z-50 flex max-h-[min(70vh,28rem)] w-[320px] flex-col rounded-2xl border border-border/60 bg-card/95 p-4 shadow-lg backdrop-blur supports-backdrop-filter:bg-card/80 sm:w-[360px]"
	>
		<div class="mb-4 flex shrink-0 items-center justify-between gap-3">
			<div>
				<p class="text-xs font-semibold tracking-[0.28em] text-muted-foreground/70 uppercase">
					Colorway
				</p>
				<p class="text-base font-semibold text-foreground">{activePreset.label}</p>
			</div>
			<div class="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1">
				<button
					type="button"
					onclick={() => handleModeChange('light')}
					class={cn(
						'inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
						currentTheme.currentMode === 'light'
							? 'bg-background text-primary shadow'
							: 'bg-transparent'
					)}
					aria-label="Activate light mode"
				>
					<Sun class="h-[18px] w-[18px]" />
				</button>
				<button
					type="button"
					onclick={() => handleModeChange('dark')}
					class={cn(
						'inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
						currentTheme.currentMode === 'dark'
							? 'bg-background text-primary shadow'
							: 'bg-transparent'
					)}
					aria-label="Activate dark mode"
				>
					<Moon class="h-[18px] w-[18px]" />
				</button>
			</div>
		</div>
		<div
			class="min-h-0 flex-1 overflow-y-auto pr-1 [--scrollbar-size:6px] [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-(--scrollbar-size,6px) [&::-webkit-scrollbar]:w-(--scrollbar-size,6px) [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[hsl(var(--muted-foreground)/0.35)] [&::-webkit-scrollbar-thumb]:transition-colors hover:[&::-webkit-scrollbar-thumb]:bg-[hsl(var(--muted-foreground)/0.5)]"
		>
			<div class="grid grid-cols-1 gap-3">
				{#each presetOptions as option}
					<button
						type="button"
						onclick={() => handlePresetSelect(option.id)}
						class={cn(
							'group flex w-full items-center gap-3 rounded-xl border border-transparent bg-card/70 p-3 text-left transition-all hover:border-primary/40 hover:bg-card/90 hover:shadow-md',
							option.id === currentTheme.preset &&
								'border-primary/60 bg-primary/10 shadow-lg ring-1 ring-primary/40'
						)}
					>
						<div
							class="flex h-10 w-16 items-center justify-center rounded-lg bg-muted/60 p-1 shadow-inner"
						>
							<div class="grid w-full grid-cols-4 gap-[3px]">
								{#each option.preview as color, index}
									<span
										class="block h-3.5 rounded-sm border border-white/30 shadow-sm"
										style={`background:${color}`}
										aria-hidden={true}
									>
										<span class="sr-only">Color swatch {index + 1}</span>
									</span>
								{/each}
							</div>
						</div>
						<div class="flex flex-1 flex-col">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{option.label}</span>
								{#if isRecentlyAdded(option.createdAt)}
									<Badge variant="secondary" class="rounded-full px-2 py-0.5 text-[11px] uppercase">
										New
									</Badge>
								{/if}
							</div>
							<span class="text-[11px] font-medium text-muted-foreground/80">
								{option.id === 'default' ? 'Signature palette' : 'Custom preset'}
							</span>
						</div>
						{#if option.id === currentTheme.preset}
							<Check class="ml-auto h-4 w-4 text-primary" />
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</PopoverContent>
</Popover>
