<!-- WidgetCard.svelte -->
<script lang="ts">
	import { Settings, GripVertical, X } from '@lucide/svelte';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	import WidgetSettings from './WidgetSettings.svelte';

	let {
		instance,
		editMode = false,
		onRemove,
		onUpdate,
		children,
		headerRight = undefined,
		showHeader = true
	} = $props();

	let settingsOpen = $state(false);
	let previewInstance = $state(instance);

	$effect(() => {
		if (!settingsOpen) {
			previewInstance = instance;
		}
	});

	const SIZE_OPTIONS = ['sm', 'md', 'lg'];

	let displayTitle = $derived(
		previewInstance.widget_title || previewInstance.widget_type || 'Widget'
	);

	let currentSize = $derived(instance.position?.size ?? 'sm');
	let hasTint = $derived(!!previewInstance.visual_config?.tint);

	function handleSizeChange(size: string) {
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
	style:--widget-tint={previewInstance.visual_config?.tint ?? '#8B5CF6'}
>
	<Card.Root
		class={`relativeflex h-full flex-col overflow-hidden rounded-[28px] border-0 ring-0 bg-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 ${
			editMode
				? 'cursor-grab ring-2 ring-violet-300/50 active:cursor-grabbing'
				: 'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)]'
		}`}
		
	>
		<!-- Subtle gradient overlay -->
		<div
			class="pointer-events-none absolute inset-0 bg-linear-to-br from-white via-white to-violet-50/40 opacity-80"
		></div>

		{#if showHeader}
			<div class="relative z-10 flex items-center justify-between px-5 pb-3">

				<!-- LEFT: Title + optional numeric badge -->
				<div class="flex items-center gap-2">
					<h3
						class="font-Inter text-2xl font-semibold capitalize tracking-[-0.02em] text-slate-800"
					>
						{displayTitle}
					</h3>

					<!--
						Numeric badge — shown when `count` is defined on the instance.
						Matches the "2" and "3" pills visible in the Todos / Reminders cards.
					-->
					{#if previewInstance.count !== undefined}
						<span
							class="inline-flex p-2 items-center justify-center rounded-lg bg-[#F6F6F6]  text-base font-semibold leading-none text-slate-500 tabular-nums"
						>
							{previewInstance.count}
						</span>
					{/if}
				</div>

				<!-- RIGHT: "Add +" action button — shown when `showAddButton` is true -->
				<div class="flex items-center gap-2">
					{#if headerRight}
						{@render headerRight()}
					{/if}

					{#if previewInstance.showAddButton}
						<button
							onclick={handleAdd}
							class="flex items-center gap-1 rounded-full bg-[#F6F6F6] text-[#83899F] px-4 py-2 text-md font-medium  transition-colors hover:bg-slate-200 hover:text-slate-700 active:scale-95"
						>
							<span>Add</span>
							<span class="text-sm leading-none">+</span>
						</button>
					{/if}

					<!--
						Fallback: if a custom `actionLabel` is set but `showAddButton` is false,
						render the old-style labelled button (e.g. "Filter", "Month", etc.)
					-->
					{#if previewInstance.actionLabel && !previewInstance.showAddButton}
						<button
							class="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
						>
							<span>{previewInstance.actionLabel}</span>
							<span class="text-sm leading-none">+</span>
						</button>
					{/if}

					<!-- Edit-mode controls -->
					{#if editMode}
						<button
							onclick={handleRemove}
							class="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-400 opacity-0 transition-all group-hover/widget:opacity-100 hover:bg-red-200 hover:text-red-600"
							aria-label="Remove widget"
						>
							<X class="h-3.5 w-3.5" />
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Content slot -->
		<div class="relative z-10 flex-1 px-5 text-slate-700">
			{#if children}
				{@render children()}
			{:else}
				<div class="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
					<div
						class="flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50"
					>
						<div class="size-3 rounded-full bg-slate-300"></div>
					</div>
					<span class="text-xs font-medium tracking-wide uppercase">No Content</span>
				</div>
			{/if}
		</div>
	</Card.Root>
</div>