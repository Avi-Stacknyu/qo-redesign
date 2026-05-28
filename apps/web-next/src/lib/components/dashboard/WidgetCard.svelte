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
		headerRight,
		showHeader = true
	}: {
		instance: WidgetCardInstance;
		editMode?: boolean;
		onRemove?: (id: string) => void;
		onUpdate?: (id: string, data: Partial<UserWidgetInstanceRecord>) => void;
		children?: Snippet;
		headerRight?: Snippet;
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
			'relative flex h-full flex-col gap-0 overflow-hidden rounded-[30px] border border-white/70 bg-white/90 py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300',
			editMode
				? 'cursor-grab ring-2 ring-primary/25 ring-offset-4 ring-offset-background active:cursor-grabbing'
				: 'hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-[0_24px_56px_rgba(15,23,42,0.12)]'
		)}
		style={hasTint
			? 'border-color: color-mix(in oklch, var(--widget-tint), white 76%); background: linear-gradient(180deg, color-mix(in oklch, var(--widget-tint), white 95%) 0%, white 18%, white 100%);'
			: ''}
	>
		<div class="pointer-events-none absolute inset-0 bg-linear-to-br from-white via-white to-primary/4 opacity-90"></div>

		{#if showHeader}
			<div class="relative z-10 flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-5">

				<div class="flex min-w-0 items-center gap-2.5">
					{#if editMode}
						<GripVertical class="size-4 shrink-0 cursor-grab text-[#98A2B3] active:cursor-grabbing" />
					{/if}
					<span class="size-2 shrink-0 rounded-full bg-(--widget-tint) shadow-[0_0_10px_color-mix(in_oklch,var(--widget-tint),transparent_30%)]"></span>
					<h3 class="truncate text-xl font-semibold tracking-[-0.02em] text-[#1F2937] md:text-2xl">
						{displayTitle}
					</h3>

					{#if previewInstance.count !== undefined}
						<span class="inline-flex items-center justify-center rounded-xl border border-[#EEF2F6] bg-[#F7F9FC] px-3 py-1 text-sm font-semibold leading-none text-[#7B8794] tabular-nums">
							{previewInstance.count}
						</span>
					{/if}
				</div>

				<div class="flex shrink-0 items-center gap-2">
					{#if headerRight}
						{@render headerRight()}
					{/if}

					{#if editMode}
						<div class="flex items-center gap-1 rounded-full bg-[#F3F6FB] p-1">
							{#each SIZE_OPTIONS as size (size)}
								<button
									type="button"
									onclick={() => handleSizeChange(size)}
									class="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase transition-colors {currentSize === size
										? 'bg-[#111A2E] text-white'
										: 'text-[#7B8794] hover:bg-white hover:text-[#1F2937]'}"
								>
									{size}
								</button>
							{/each}
						</div>
					{/if}

					{#if previewInstance.showAddButton}
						<Button
							variant="ghost"
							onclick={handleAdd}
							class="rounded-full bg-[#F3F6FB] px-4 py-2 text-sm font-medium text-[#7B8794] hover:bg-[#E7EDF7] hover:text-[#25324B]"
						>
							<span>Add</span>
							<span class="text-sm leading-none">+</span>
						</Button>
					{/if}

					{#if previewInstance.actionLabel && !previewInstance.showAddButton}
						<Button variant="ghost" class="rounded-full bg-[#F3F6FB] px-4 py-2 text-xs font-medium text-[#7B8794] hover:bg-[#E7EDF7] hover:text-[#25324B]">
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
								class="rounded-full bg-[#F3F6FB] text-[#7B8794] transition-colors {editMode
									? ''
									: 'opacity-0 group-hover/widget:opacity-100'} hover:bg-[#E7EDF7] hover:text-[#25324B]"
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
							class="rounded-full opacity-0 transition-all group-hover/widget:opacity-100"
							aria-label="Remove widget"
						>
							<X class="h-3.5 w-3.5" />
						</Button>
					{/if}
				</div>
			</div>
		{/if}

		<div class="relative z-10 flex-1 overflow-hidden px-5 pb-5 text-card-foreground">
			{#if children}
				{@render children()}
			{:else}
				<div class="flex h-full flex-col items-center justify-center gap-3 text-[#98A2B3]">
					<div class="flex size-12 items-center justify-center rounded-2xl border border-[#E7EDF7] bg-[#F7F9FC]">
						<div class="size-3 rounded-full bg-[#CBD5E1]"></div>
					</div>
					<span class="text-xs font-medium tracking-wide uppercase">No Content</span>
				</div>
			{/if}
		</div>
	</Card.Root>
</div>