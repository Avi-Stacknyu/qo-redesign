<!-- WidgetCard.svelte -->
<script lang="ts">
	import { Settings, GripVertical, X } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { getContext } from 'svelte';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils';
	import type { DashboardWidgetRow } from '@repo/db/types';
	import type { Snippet } from 'svelte';
	import type { UserWidgetInstanceRecord, WidgetSize } from '$lib/types/widgets';

	import WidgetSettings from './WidgetSettings.svelte';

	type WidgetCardInstance = UserWidgetInstanceRecord & {
		count?: number;
		showAddButton?: boolean;
		actionLabel?: string;
		onAdd?: () => void;
	};

	let {
		instance,
		editMode = false,
		onRemove,
		onUpdate,
		children,
		showHeader = true
	}: {
		instance: WidgetCardInstance;
		editMode?: boolean;
		onRemove?: (id: string) => void;
		onUpdate?: (id: string, data: Partial<UserWidgetInstanceRecord>) => void;
		children?: Snippet;
		showHeader?: boolean;
	} = $props();

	const widgetCatalog = getContext<{
		map: Map<string, DashboardWidgetRow>;
		list: DashboardWidgetRow[];
	}>('widgetCatalog');

	let settingsOpen = $state(false);
	let previewInstance = $state(untrack(() => instance));

	$effect(() => {
		if (!settingsOpen) {
			previewInstance = instance;
		}
	});

	const SIZE_OPTIONS: WidgetSize[] = ['sm', 'md', 'lg'];

	let displayTitle = $derived(
		previewInstance.widget_title ||
			widgetCatalog?.map.get(previewInstance.widget_type)?.name ||
			previewInstance.widget_type ||
			'Widget'
	);

	let currentSize = $derived(instance.position?.size ?? 'sm');
	let hasTint = $derived(!!previewInstance.visual_config?.tint);

	function handleSizeChange(size: WidgetSize) {
		onUpdate?.(instance.id, {
			position: { ...instance.position, size }
		});
	}

	function handleRemove() {
		onRemove?.(instance.id);
	}

	function handleSettingsSave(updates: any) {
		onUpdate?.(instance.id, updates);
	}

	function handlePreviewChange(updates: any) {
		previewInstance = { ...previewInstance, ...updates };
	}

	function handleAdd() {
		previewInstance.onAdd?.();
	}
</script>

<div
	class="widget-card group/widget h-full"
	style:--widget-tint={previewInstance.visual_config?.tint ?? 'var(--primary)'}
>
	<Card.Root
		size="sm"
		class={cn(
			'relative flex h-full flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-card/80 py-0 shadow-xs backdrop-blur-xl transition-all duration-300',
			editMode
				? 'cursor-grab ring-2 ring-primary/35 ring-offset-2 ring-offset-background active:cursor-grabbing'
				: 'hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card hover:shadow-lg hover:shadow-primary/5'
		)}
		style={hasTint
			? 'border-color: color-mix(in oklch, var(--widget-tint), transparent 65%); background-color: color-mix(in oklch, var(--widget-tint), var(--card) 96%);'
			: ''}
	>
		<div class="pointer-events-none absolute inset-0 bg-linear-to-br from-background/10 via-transparent to-primary/5 opacity-70"></div>

		{#if showHeader}
			<div class="relative z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border/35 px-3 py-2.5">

				<div class="flex min-w-0 items-center gap-2">
					{#if editMode}
						<GripVertical class="size-4 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />
					{/if}
					<span class="size-1.5 shrink-0 rounded-full bg-(--widget-tint) shadow-[0_0_8px_color-mix(in_oklch,var(--widget-tint),transparent_45%)]"></span>
					<h3 class="truncate text-[13px] font-semibold tracking-tight text-card-foreground">
						{displayTitle}
					</h3>

					{#if previewInstance.count !== undefined}
						<span class="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold leading-none text-muted-foreground tabular-nums">
							{previewInstance.count}
						</span>
					{/if}
				</div>

				<div class="flex shrink-0 items-center gap-1">
					{#if editMode}
						<div class="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
							{#each SIZE_OPTIONS as size (size)}
								<button
									type="button"
									onclick={() => handleSizeChange(size)}
									class="rounded-md px-1.5 py-0.5 text-[8px] font-semibold uppercase transition-colors {currentSize === size
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:bg-background hover:text-foreground'}"
								>
									{size}
								</button>
							{/each}
						</div>
					{/if}

					{#if previewInstance.showAddButton}
						<Button
							variant="secondary"
							size="xs"
							onclick={handleAdd}
							class="rounded-lg"
						>
							<span>Add</span>
							<span class="text-sm leading-none">+</span>
						</Button>
					{/if}

					{#if previewInstance.actionLabel && !previewInstance.showAddButton}
						<Button variant="secondary" size="xs" class="rounded-lg text-[11px]">
							<span>{previewInstance.actionLabel}</span>
							<span class="text-sm leading-none">+</span>
						</Button>
					{/if}

					<WidgetSettings
						{instance}
						bind:open={settingsOpen}
						onSave={handleSettingsSave}
						onPreviewChange={handlePreviewChange}
						onRemove={handleRemove}
					>
						{#snippet trigger({ props }: { props: Record<string, unknown> })}
							<Button
								{...props}
								variant="ghost"
								size="icon-xs"
								class="rounded-lg text-muted-foreground transition-colors {editMode
									? ''
									: 'opacity-0 group-hover/widget:opacity-100'}"
								aria-label="Widget settings"
							>
								<Settings class="size-3.5" />
							</Button>
						{/snippet}
					</WidgetSettings>

					{#if editMode}
						<Button
							variant="destructive"
							size="icon-xs"
							onclick={handleRemove}
							class="rounded-lg opacity-0 transition-all group-hover/widget:opacity-100"
							aria-label="Remove widget"
						>
							<X class="h-3.5 w-3.5" />
						</Button>
					{/if}
				</div>
			</div>
		{/if}

		<div class="relative z-10 flex-1 overflow-hidden p-4 text-card-foreground">
			{#if children}
				{@render children()}
			{:else}
				<div class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/60">
					<div class="flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/50">
						<div class="size-3 rounded-full bg-muted-foreground/40"></div>
					</div>
					<span class="text-xs font-medium tracking-wide uppercase">No Content</span>
				</div>
			{/if}
		</div>
	</Card.Root>
</div>