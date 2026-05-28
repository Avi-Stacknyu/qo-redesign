<!-- WidgetSettings.svelte -->
<script lang="ts">
	import { X, SlidersHorizontal, Trash2 } from '@lucide/svelte';
	import { untrack } from 'svelte';
 	import { getContext } from 'svelte';

	import * as Popover from '$lib/components/ui/popover/index.js';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
 	import type { Snippet } from 'svelte';
 	import type { DashboardWidgetRow } from '@repo/db/types';
 	import {
 		type ConfigFieldDescriptor,
 		type UserWidgetInstanceRecord,
 		type VisualConfig
 	} from '$lib/types/widgets';
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

	const widgetCatalog = getContext<{
		map: Map<string, DashboardWidgetRow>;
		list: DashboardWidgetRow[];
	}>('widgetCatalog');

	const widgetOptions = getContext<{
		categories: { value: string; label: string }[];
		dataSources: { value: string; label: string; type?: string }[];
	}>('widgetOptions');

	let editTitle = $state('');
	let editVisual = $state<VisualConfig>({});
	let editConfig = $state<Record<string, unknown>>({});

	const catalogWidget = $derived(widgetCatalog?.map.get(instance.widget_type));
	const configFields = $derived(
		(catalogWidget?.configFields as ConfigFieldDescriptor[] | null) ?? []
	);
	const widgetLabel = $derived(catalogWidget?.name ?? instance.widget_type);

	function getFieldOptions(field: ConfigFieldDescriptor) {
		if (field.source === 'categories') return widgetOptions?.categories ?? [];
		if (field.source === 'dataSources') return widgetOptions?.dataSources ?? [];
		return field.options ?? [];
	}

	$effect(() => {
		if (open) {
			untrack(() => {
				editTitle = instance.widget_title ?? '';
				editVisual = { ...(instance.visual_config ?? {}) };
				editConfig = { ...(instance.custom_config ?? {}) };
			});
		}
	});

	function emitPreview() {
		if (!open) return;

		const updates: Partial<UserWidgetInstanceRecord> = {};
		if (editTitle !== (instance.widget_title ?? '')) updates.widget_title = editTitle;
		if (JSON.stringify(editVisual) !== JSON.stringify(instance.visual_config ?? {})) {
			updates.visual_config = $state.snapshot(editVisual);
		}
		if (JSON.stringify(editConfig) !== JSON.stringify(instance.custom_config ?? {})) {
			updates.custom_config = $state.snapshot(editConfig);
		}

		if (Object.keys(updates).length > 0) onPreviewChange?.(updates);
	}

	$effect(() => {
		editTitle;
		JSON.stringify(editVisual);
		JSON.stringify(editConfig);

		untrack(() => emitPreview());
	});

	function handleSave() {
		const updates: Partial<UserWidgetInstanceRecord> = {};
		if (editTitle !== (instance.widget_title ?? '')) updates.widget_title = editTitle;
		if (JSON.stringify(editVisual) !== JSON.stringify(instance.visual_config ?? {})) {
			updates.visual_config = $state.snapshot(editVisual);
		}
		if (JSON.stringify(editConfig) !== JSON.stringify(instance.custom_config ?? {})) {
			updates.custom_config = $state.snapshot(editConfig);
		}
		if (Object.keys(updates).length > 0) onSave?.(updates);

		open = false;
	}

	function handleConfigChange(key: string, value: unknown) {
		editConfig[key] = value;
		if (key === 'dataSource' && typeof value === 'string') {
			const dataSourceType = widgetOptions?.dataSources.find((source) => source.value === value)?.type;
			if (dataSourceType) editConfig.dataSourceType = dataSourceType;
		}
	}

	function handleTagsChange(key: string, value: string) {
		editConfig[key] = value
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);
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

				<span class="text-sm font-semibold text-foreground">
					Widget Settings
				</span>
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

		<!-- Body -->
		<div class="max-h-[60vh] overflow-y-auto">
			<div class="space-y-6 p-5">
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

				<TintSelector selectedTint={editVisual.tint} onSelect={(value) => (editVisual.tint = value)} />

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
			class="flex items-center justify-between border-t border-border/50 bg-muted/30 px-4 py-3"
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

			<Button
				size="sm"
				class="h-8 shadow-sm"
				onclick={handleSave}
			>
				Save Changes
			</Button>
		</div>
	</Popover.Content>
</Popover.Root>