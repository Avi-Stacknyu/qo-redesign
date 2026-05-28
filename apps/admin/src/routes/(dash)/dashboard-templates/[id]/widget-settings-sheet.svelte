<script lang="ts">
	import * as Sheet from '$lib/components/shadcn/sheet';
	import { Input } from '$lib/components/shadcn/input';
	import * as Select from '$lib/components/shadcn/select';
	import { Label } from '$lib/components/shadcn/label';
	import { Button } from '$lib/components/shadcn/button';
	import WidgetConfigEditor from '$lib/components/widget-config-editor.svelte';
	import type { ConfigFieldDescriptor } from '@repo/shared/types';

	const TINT_COLORS = [
		{ value: '#ef4444', label: 'Red' },
		{ value: '#f97316', label: 'Orange' },
		{ value: '#eab308', label: 'Yellow' },
		{ value: '#22c55e', label: 'Green' },
		{ value: '#06b6d4', label: 'Cyan' },
		{ value: '#3b82f6', label: 'Blue' },
		{ value: '#8b5cf6', label: 'Purple' },
		{ value: '#d946ef', label: 'Pink' },
		{ value: '#f43f5e', label: 'Rose' },
		{ value: '#6366f1', label: 'Indigo' }
	];

	interface TemplateWidgetItem {
		id: string;
		widget_type: string;
		widget_title: string;
		position: { order: number; size: string };
		default_config: Record<string, unknown>;
		visual_config: { tint?: string } | null;
	}

	let {
		widget = null,
		configFields = [],
		onclose,
		onsave
	}: {
		widget: TemplateWidgetItem | null;
		configFields: ConfigFieldDescriptor[];
		onclose: () => void;
		onsave: (widget: TemplateWidgetItem) => void;
	} = $props();

	let editing = $state<TemplateWidgetItem | null>(null);

	$effect(() => {
		editing = widget ? { ...widget } : null;
	});
</script>

<Sheet.Root open={!!widget} onOpenChange={(open) => !open && onclose()}>
	<Sheet.Content class="overflow-y-auto sm:max-w-md">
		<Sheet.Header>
			<Sheet.Title>Widget Settings</Sheet.Title>
			<Sheet.Description>Configure this widget's defaults for the template.</Sheet.Description>
		</Sheet.Header>
		{#if editing}
			<div class="space-y-4 px-4 py-4">
				<div class="space-y-2">
					<Label for="w_title">Title</Label>
					<Input id="w_title" bind:value={editing.widget_title} />
				</div>

				<div class="space-y-2">
					<Label for="w_size">Size</Label>
					<Select.Root
						type="single"
						value={editing.position.size}
						onValueChange={(v) => {
							if (editing) {
								editing.position = { ...editing.position, size: v };
							}
						}}
					>
						<Select.Trigger id="w_size">
							{editing?.position.size || 'md'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="sm">Small</Select.Item>
							<Select.Item value="md">Medium</Select.Item>
							<Select.Item value="lg">Large</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<Label>Tint Color</Label>
					<div class="flex flex-wrap gap-2">
						{#each TINT_COLORS as color (color.value)}
							<button
								type="button"
								class="size-7 rounded-full border-2 transition-transform hover:scale-110
									{(editing.visual_config?.tint || '#6366f1') === color.value
									? 'scale-110 border-foreground'
									: 'border-transparent'}"
								style="background-color: {color.value}"
								title={color.label}
								onclick={() => {
									if (editing) {
										editing.visual_config = {
											...editing.visual_config,
											tint: color.value
										};
									}
								}}
							></button>
						{/each}
						<button
							type="button"
							class="flex size-7 items-center justify-center rounded-full border-2 text-xs text-muted-foreground transition-transform hover:scale-110
								{!editing.visual_config?.tint ? 'scale-110 border-foreground' : 'border-border'}"
							title="No tint"
							onclick={() => {
								if (editing) {
									editing.visual_config = { ...editing.visual_config, tint: undefined };
								}
							}}>∅</button
						>
					</div>
				</div>

				<div class="space-y-2">
					<Label>Config</Label>
					<p class="text-xs text-muted-foreground">Default settings for this widget instance.</p>
					<WidgetConfigEditor
						{configFields}
						value={editing.default_config}
						onchange={(v) => {
							if (editing) editing.default_config = v;
						}}
					/>
				</div>

				<div class="flex justify-end gap-2 pt-2">
					<Button variant="outline" onclick={onclose}>Cancel</Button>
					<Button onclick={() => editing && onsave(editing)}>Apply</Button>
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
