<!-- WidgetSettings.svelte -->
<script lang="ts">
	import { X, SlidersHorizontal, Trash2 } from '@lucide/svelte';

	import * as Popover from '$lib/components/ui/popover/index.js';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';


	let {
		instance,
		open = $bindable(false),
		onSave,
		onPreviewChange,
		onRemove,
		trigger
	} = $props();

	let editTitle = $state(instance.widget_title ?? '');

	let editVisual = $state({
		tint: instance.visual_config?.tint ?? ''
	});

	let editConfig = $state({
		category: 'productivity',
		layout: 'grid'
	});

	$effect(() => {
		if (open) {
			editTitle = instance.widget_title ?? '';

			editVisual = {
				tint: instance.visual_config?.tint ?? ''
			};
		}
	});

	function emitPreview() {
		onPreviewChange?.({
			widget_title: editTitle,
			visual_config: editVisual,
			custom_config: editConfig
		});
	}

	$effect(() => {
		editTitle;
		editVisual.tint;

		emitPreview();
	});

	function handleSave() {
		onSave?.({
			widget_title: editTitle,
			visual_config: editVisual,
			custom_config: editConfig
		});

		open = false;
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
						placeholder="Widget Title"
						class="font-medium"
					/>
				</div>

				

				<!-- Demo Config -->
				<div class="space-y-3">
					<Label class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
						Category
					</Label>

					<select
						bind:value={editConfig.category}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="productivity">Productivity</option>
						<option value="finance">Finance</option>
						<option value="personal">Personal</option>
					</select>
				</div>
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