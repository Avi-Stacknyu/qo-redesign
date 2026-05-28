<script lang="ts">
	import { Input } from '$lib/components/shadcn/input';
	import { Button } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import * as Select from '$lib/components/shadcn/select';
	import { Label } from '$lib/components/shadcn/label';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { useSortable } from '@dnd-kit-svelte/sortable';
	import type { SchemaSection, SchemaField } from './schema-section-editor.svelte';

	let {
		section,
		index,
		expanded,
		ontoggle,
		onremove,
		onupdate,
		onaddfield,
		onremovefield,
		onupdatefield
	}: {
		section: SchemaSection;
		index: number;
		expanded: boolean;
		ontoggle: () => void;
		onremove: () => void;
		onupdate: (key: keyof SchemaSection, value: unknown) => void;
		onaddfield: () => void;
		onremovefield: (fieldIndex: number) => void;
		onupdatefield: (fieldIndex: number, key: keyof SchemaField, value: string) => void;
	} = $props();

	const sortable = useSortable({
		get id() {
			return section.section_id;
		}
	});

	let style = $derived.by(() => {
		const t = sortable.transform.current;
		const tr = sortable.transition.current;
		if (!t) return '';
		return `transform: translate3d(${t.x}px, ${t.y}px, 0);${tr ? ` transition: ${tr};` : ''}`;
	});

	const FIELD_TYPES = ['text', 'number', 'date', 'list'] as const;
	const ICON_OPTIONS = [
		'user',
		'briefcase',
		'bar-chart-3',
		'target',
		'settings',
		'heart',
		'wallet',
		'shield',
		'graduation-cap',
		'home',
		'globe',
		'activity',
		'award',
		'book-open',
		'calendar',
		'credit-card',
		'trending-up',
		'users',
		'zap'
	] as const;
</script>

<div class="rounded-lg border border-border/40 bg-card/30" use:sortable.setNodeRef {style}>
	<!-- Section header -->
	<div class="flex items-center gap-2 p-3">
		<button
			type="button"
			class="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
			tabindex={-1}
			use:sortable.setActivatorNodeRef
			{...sortable.listeners.current}
			{...sortable.attributes.current}
		>
			<GripVertical class="size-4" />
		</button>
		<button type="button" class="flex flex-1 items-center gap-2 text-left" onclick={ontoggle}>
			<ChevronDown
				class="size-4 text-muted-foreground transition-transform {expanded
					? 'rotate-0'
					: '-rotate-90'}"
			/>
			<span class="text-sm font-medium">
				{section.label || '(untitled section)'}
			</span>
			<span class="text-xs text-muted-foreground">{section.section_id}</span>
			<Badge variant="outline" class="ml-auto text-[10px]">
				{section.fields.length} field{section.fields.length !== 1 ? 's' : ''}
			</Badge>
		</button>
		<Button
			variant="ghost"
			size="sm"
			type="button"
			class="size-8 p-0 text-muted-foreground hover:text-destructive"
			onclick={onremove}
		>
			<Trash2 class="size-3.5" />
		</Button>
	</div>

	<!-- Section details (expanded) -->
	{#if expanded}
		<div class="space-y-4 border-t border-border/30 p-3 pt-4">
			<!-- Section metadata -->
			<div class="grid grid-cols-3 gap-3">
				<div class="grid gap-1">
					<Label class="text-xs">Section ID</Label>
					<Input
						value={section.section_id}
						oninput={(e) => onupdate('section_id', (e.target as HTMLInputElement).value)}
						placeholder="e.g. financial"
						class="h-8 text-xs"
					/>
				</div>
				<div class="grid gap-1">
					<Label class="text-xs">Label</Label>
					<Input
						value={section.label}
						oninput={(e) => onupdate('label', (e.target as HTMLInputElement).value)}
						placeholder="e.g. Financial Profile"
						class="h-8 text-xs"
					/>
				</div>
				<div class="grid gap-1">
					<Label class="text-xs">Icon</Label>
					<Select.Root
						type="single"
						value={section.icon}
						onValueChange={(v) => onupdate('icon', v)}
					>
						<Select.Trigger class="h-8 text-xs">{section.icon}</Select.Trigger>
						<Select.Content>
							{#each ICON_OPTIONS as icon (icon)}
								<Select.Item value={icon}>{icon}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<!-- Fields -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label class="text-xs font-medium text-muted-foreground">Fields</Label>
					<Button
						variant="outline"
						size="sm"
						type="button"
						class="h-7 gap-1 text-xs"
						onclick={onaddfield}
					>
						<Plus class="size-3" />
						Add Field
					</Button>
				</div>

				{#if section.fields.length > 0}
					<!-- Field header row -->
					<div
						class="grid grid-cols-[1fr_1fr_80px_1.5fr_32px] items-center gap-2 px-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
					>
						<span>Key</span>
						<span>Label</span>
						<span>Type</span>
						<span>Description</span>
						<span></span>
					</div>

					{#each section.fields as field, fi (field.key + '-' + fi)}
						<div class="grid grid-cols-[1fr_1fr_80px_1.5fr_32px] items-center gap-2">
							<Input
								value={field.key}
								oninput={(e) => onupdatefield(fi, 'key', (e.target as HTMLInputElement).value)}
								placeholder="field_key"
								class="h-7 text-xs"
							/>
							<Input
								value={field.label}
								oninput={(e) => onupdatefield(fi, 'label', (e.target as HTMLInputElement).value)}
								placeholder="Display Label"
								class="h-7 text-xs"
							/>
							<Select.Root
								type="single"
								value={field.type}
								onValueChange={(v) => onupdatefield(fi, 'type', v)}
							>
								<Select.Trigger class="h-7 text-xs">{field.type}</Select.Trigger>
								<Select.Content>
									{#each FIELD_TYPES as t (t)}
										<Select.Item value={t}>{t}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
							<Input
								value={field.description}
								oninput={(e) =>
									onupdatefield(fi, 'description', (e.target as HTMLInputElement).value)}
								placeholder="Brief hint for the LLM"
								class="h-7 text-xs"
							/>
							<Button
								variant="ghost"
								size="sm"
								type="button"
								class="size-7 p-0 text-muted-foreground hover:text-destructive"
								onclick={() => onremovefield(fi)}
							>
								<Trash2 class="size-3" />
							</Button>
						</div>
					{/each}
				{:else}
					<p class="py-2 text-center text-xs text-muted-foreground italic">
						No fields yet. Click "Add Field" to define what data this section collects.
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
