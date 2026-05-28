<script lang="ts">
	import { Settings, GripVertical, X } from '@lucide/svelte';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import type { Snippet } from 'svelte';
	import { type UserWidgetInstanceRecord, type WidgetSize } from '$lib/types/widgets';
	import type { DashboardWidgetRow } from '@repo/db/types';
	import WidgetSettings from './WidgetSettings.svelte';
	import { cn } from '$lib/utils';
	import { untrack } from 'svelte';
	import { getContext } from 'svelte';

	let {
		instance,
		editMode = false,
		onRemove,
		onUpdate,
		children
	}: {
		instance: UserWidgetInstanceRecord;
		editMode?: boolean;
		onRemove?: (id: string) => void;
		onUpdate?: (id: string, data: Partial<UserWidgetInstanceRecord>) => void;
		children?: Snippet;
	} = $props();

	let settingsOpen = $state(false);

	// DB-driven catalog via context
	const widgetCatalog = getContext<{
		map: Map<string, DashboardWidgetRow>;
		list: DashboardWidgetRow[];
	}>('widgetCatalog');

	// Preview state management - Start with instance
	let previewInstance = $state(untrack(() => instance));

	// Sync preview when instance changes externally (and settings are closed)
	$effect(() => {
		// Only sync if settings are NOT open.
		// If settings are open, we want to keep the preview state as the user explores options.
		if (!settingsOpen) {
			previewInstance = instance;
		}
	});

	let displayTitle = $derived(
		previewInstance.widget_title ||
			widgetCatalog?.map.get(previewInstance.widget_type)?.name ||
			previewInstance.widget_type
	);

	let currentSize = $derived(instance.position.size);

	const SIZE_OPTIONS: WidgetSize[] = ['sm', 'md', 'lg'];

	function handleSizeChange(size: WidgetSize) {
		onUpdate?.(instance.id, {
			position: { ...instance.position, size }
		});
	}

	function handleRemove() {
		onRemove?.(instance.id);
	}

	function handleSettingsSave(updates: Partial<UserWidgetInstanceRecord>) {
		onUpdate?.(instance.id, updates);
		// We don't need to manually update previewInstance here immediately
		// The parent will update 'instance' prop, and since settingsOpen becomes false,
		// the effect will sync previewInstance = instance.
	}

	function handlePreviewChange(updates: Partial<UserWidgetInstanceRecord>) {
		// Merge updates into previewInstance
		previewInstance = { ...previewInstance, ...updates };
	}

	let hasTint = $derived(!!previewInstance.visual_config?.tint);
</script>

<div
	class="widget-card group/widget transition-all duration-500 ease-out"
	style:--widget-tint={previewInstance.visual_config?.tint ?? 'var(--primary)'}
>
	<Card.Root
		class={cn(
			'relative flex flex-col gap-0 overflow-hidden p-0 transition-all duration-300',
			// Glassmorphism Base
			'bg-card/40 backdrop-blur-3xl',
			// Borders
			'border border-border/50',
			// Hover Effects (Glow)
			'hover:shadow-lg hover:shadow-primary/5',
			hasTint ? 'hover:border-(--widget-tint)' : 'hover:border-primary/50',

			// Edit Mode
			editMode &&
				'cursor-grab ring-2 ring-primary/40 ring-offset-2 ring-offset-background active:cursor-grabbing'
		)}
		style={hasTint
			? `border-color: color-mix(in oklch, var(--widget-tint), transparent 70%); background-color: color-mix(in oklch, var(--widget-tint), transparent 96%);`
			: ''}
	>
		<!-- Header -->
		<div
			class="flex shrink-0 items-center justify-between border-b border-border/30 px-3 py-2.5 transition-colors duration-300 hover:bg-muted/10"
		>
			<div class="flex items-center gap-2.5">
				{#if editMode}
					<div
						class="cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
					>
						<GripVertical class="size-4" />
					</div>
				{/if}
				<!-- Techy Title -->
				<div class="flex items-center gap-2">
					<div
						class="h-1.5 w-1.5 rounded-full shadow-[0_0_6px_currentColor] transition-colors duration-300"
						style:background-color={hasTint ? 'var(--widget-tint)' : 'var(--primary)'}
						style:color={hasTint ? 'var(--widget-tint)' : 'var(--primary)'}
					></div>
					<h3
						class="font-mono text-[9px] font-bold tracking-[0.2em] text-muted-foreground uppercase transition-colors group-hover/widget:text-foreground/80"
					>
						{displayTitle}
					</h3>
				</div>
			</div>

			<div class="flex items-center gap-1">
				{#if editMode}
					<div
						class="flex items-center gap-0.5 overflow-hidden rounded-lg border border-border/30 bg-muted/20 p-0.5"
					>
						{#each SIZE_OPTIONS as size (size)}
							<button
								class={cn(
									'rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase transition-all',
									currentSize === size
										? 'bg-primary text-primary-foreground shadow-sm'
										: 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
								)}
								onclick={() => handleSizeChange(size)}
								title="Set size to {size}"
							>
								{size}
							</button>
						{/each}
					</div>
					<Button
						variant="ghost"
						size="icon"
						class="size-6 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
						onclick={handleRemove}
					>
						<X class="size-3.5" />
					</Button>
				{/if}

				<WidgetSettings
					{instance}
					bind:open={settingsOpen}
					onSave={handleSettingsSave}
					onPreviewChange={handlePreviewChange}
					onRemove={handleRemove}
				>
					{#snippet trigger({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon"
							class={cn(
								'size-6 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover/widget:opacity-100 hover:bg-accent/30',
								hasTint ? 'hover:text-(--widget-tint)' : 'hover:text-primary'
							)}
							aria-label="Widget settings"
						>
							<Settings class="size-3.5" />
						</Button>
					{/snippet}
				</WidgetSettings>
			</div>
		</div>

		<!-- Content Area -->
		<div class="relative z-10 flex-1 overflow-hidden p-4 text-foreground">
			{#if children}
				{@render children()}
			{:else}
				<div
					class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/40"
				>
					<div class="h-8 w-8 rounded-full border border-current opacity-20"></div>
					<span class="text-[10px] font-medium tracking-wide uppercase">No Content</span>
				</div>
			{/if}
		</div>

		<!-- Subtle Gradient Overlay -->
		<div
			class="pointer-events-none absolute inset-0 bg-linear-to-t from-background/10 to-transparent opacity-0 transition-opacity duration-500 group-hover/widget:opacity-100"
			style:background-image={hasTint
				? `linear-gradient(to top, color-mix(in oklch, var(--widget-tint), transparent 97%), transparent)`
				: ''}
		></div>
	</Card.Root>
</div>
