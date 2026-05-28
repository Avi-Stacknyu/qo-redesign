<script lang="ts">
	import { X, SlidersHorizontal, Trash2 } from '@lucide/svelte';
	import * as Popover from '$lib/components/shadcn/popover/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import {
		type UserWidgetInstanceRecord,
		type VisualConfig,
		type ConfigFieldDescriptor
	} from '$lib/types/widgets';
	import type { DashboardWidgetRow } from '@repo/db/types';
	import { getContext } from 'svelte';
	import TintSelector from './TintSelector.svelte';
	import ConfigFieldRenderer from './ConfigFieldRenderer.svelte';

	let {
		instance,
		open = $bindable(false),
		onSave,
		onPreviewChange,
		onRemove,
		trigger
	}: {
		instance: UserWidgetInstanceRecord;
		open?: boolean;
		onSave?: (updates: Partial<UserWidgetInstanceRecord>) => void;
		onPreviewChange?: (updates: Partial<UserWidgetInstanceRecord>) => void;
		onRemove?: () => void;
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	// Get widget catalog from context (DB-driven)
	const widgetCatalog = getContext<{
		map: Map<string, DashboardWidgetRow>;
		list: DashboardWidgetRow[];
	}>('widgetCatalog');

	// Get options from context (provided by +page.svelte)
	const widgetOptions = getContext<{
		categories: { value: string; label: string }[];
		dataSources: { value: string; label: string; type?: string }[];
	}>('widgetOptions');

	function getFieldOptions(field: ConfigFieldDescriptor) {
		if (field.source === 'categories') return widgetOptions?.categories ?? [];
		if (field.source === 'dataSources') return widgetOptions?.dataSources ?? [];
		return field.options ?? [];
	}

	// Local editable state — intentionally captures initial value; $effect below resets on open
	// svelte-ignore state_referenced_locally
	let editTitle = $state(instance.widget_title);
	// svelte-ignore state_referenced_locally
	let editConfig = $state<Record<string, unknown>>({ ...instance.custom_config });
	// svelte-ignore state_referenced_locally
	let editVisual = $state<VisualConfig>({ ...instance.visual_config });

	// Reset state when modal opens
	$effect(() => {
		if (open) {
			untrack(() => {
				editTitle = instance.widget_title;
				editConfig = { ...instance.custom_config };
				editVisual = { ...instance.visual_config };
			});
		}
	});

	// Emit changes logic
	function emitPreview() {
		if (!open) return;

		const updates: Partial<UserWidgetInstanceRecord> = {};
		if (editTitle !== instance.widget_title) updates.widget_title = editTitle;

		if (JSON.stringify(editConfig) !== JSON.stringify(instance.custom_config)) {
			updates.custom_config = $state.snapshot(editConfig);
		}
		if (JSON.stringify(editVisual) !== JSON.stringify(instance.visual_config)) {
			updates.visual_config = $state.snapshot(editVisual);
		}

		if (Object.keys(updates).length > 0) {
			onPreviewChange?.(updates);
		}
	}

	// Watch for changes - explicit trigger
	$effect(() => {
		const _title = editTitle;
		const _config = JSON.stringify(editConfig);
		const _visual = JSON.stringify(editVisual);
		untrack(() => emitPreview());
	});

	const catalogWidget = $derived(widgetCatalog?.map.get(instance.widget_type));
	const configFields = $derived(
		(catalogWidget?.configFields as ConfigFieldDescriptor[] | null) ?? []
	);
	const widgetLabel = $derived(catalogWidget?.name ?? instance.widget_type);

	function handleSave() {
		const updates: Partial<UserWidgetInstanceRecord> = {};
		if (editTitle !== instance.widget_title) updates.widget_title = editTitle;
		if (JSON.stringify(editConfig) !== JSON.stringify(instance.custom_config)) {
			updates.custom_config = $state.snapshot(editConfig);
		}
		if (JSON.stringify(editVisual) !== JSON.stringify(instance.visual_config)) {
			updates.visual_config = $state.snapshot(editVisual);
		}
		if (Object.keys(updates).length > 0) {
			onSave?.(updates);
		}
		open = false;
	}

	function handleConfigChange(key: string, value: unknown) {
		editConfig[key] = value;
		if (key === 'dataSource' && typeof value === 'string') {
			const dsType = widgetOptions?.dataSources.find((s) => s.value === value)?.type;
			if (dsType) editConfig['dataSourceType'] = dsType;
		}
	}

	function handleTagsChange(key: string, value: string) {
		const tags = value
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		editConfig[key] = tags;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		class="w-80 overflow-hidden rounded-xl border border-border/50 bg-popover/95 p-0 shadow-2xl backdrop-blur-3xl"
		align="end"
		sideOffset={8}
		alignOffset={-4}
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3">
			<div class="flex items-center gap-2">
				<SlidersHorizontal class="size-4 text-muted-foreground" />
				<span class="text-sm font-semibold text-foreground">Widget Settings</span>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="size-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
				onclick={() => (open = false)}
			>
				<X class="size-4" />
			</Button>
		</div>

		<div class="max-h-[60vh] overflow-y-auto">
			<div class="space-y-6 p-5">
				<!-- Title Section -->
				<div class="space-y-3">
					<Label
						for="widget-title"
						class="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
					>
						Display Title
					</Label>
					<Input
						id="widget-title"
						bind:value={editTitle}
						placeholder={widgetLabel}
						class="font-medium"
					/>
				</div>

				<!-- Tint Selector -->
				<TintSelector selectedTint={editVisual.tint} onSelect={(v) => (editVisual.tint = v)} />

				<!-- Dynamic Config Fields -->
				<ConfigFieldRenderer
					fields={configFields}
					values={editConfig}
					{getFieldOptions}
					onChange={handleConfigChange}
					onTagsChange={handleTagsChange}
				/>
			</div>
		</div>

		<!-- Footer -->
		<div
			class="flex items-center justify-between border-t border-border/50 bg-muted/30 px-4 py-3 backdrop-blur-sm"
		>
			<Button
				variant="ghost"
				size="sm"
				class="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
				onclick={() => {
					onRemove?.();
					open = false;
				}}
			>
				<Trash2 class="mr-2 size-3.5" />
				Remove
			</Button>
			<Button size="sm" class="h-8 shadow-sm" onclick={handleSave}>Save Changes</Button>
		</div>
	</Popover.Content>
</Popover.Root>
