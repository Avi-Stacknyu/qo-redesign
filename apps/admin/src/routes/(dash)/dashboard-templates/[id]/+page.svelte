<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Dialog from '$lib/components/shadcn/dialog/index.js';
	import { Input } from '$lib/components/shadcn/input';
	import WidgetSettingsSheet from './widget-settings-sheet.svelte';
	import {
		GripVertical,
		X,
		Plus,
		Save,
		Loader2,
		ArrowLeft,
		Search,
		Settings
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { updateTemplateWidgets } from '../template.remote';
	import type { ConfigFieldDescriptor } from '@repo/shared/types';

	let { data } = $props();
	type WidgetRow = (typeof data.widgets)[number];

	interface TemplateWidgetItem {
		id: string;
		widget_type: string;
		widget_title: string;
		position: { order: number; size: string };
		default_config: Record<string, unknown>;
		visual_config: { tint?: string } | null;
	}

	function buildTemplateWidgets(): TemplateWidgetItem[] {
		return Array.isArray(data.template.defaultWidgets)
			? (data.template.defaultWidgets as TemplateWidgetItem[]).map((w, i) => ({
					...w,
					id: w.id || crypto.randomUUID(),
					position: { ...w.position, order: w.position?.order ?? i }
				}))
			: [];
	}

	// ── State ─────────────────────────────────────────────────────────────────
	let templateWidgets = $state<TemplateWidgetItem[]>(buildTemplateWidgets());

	$effect(() => {
		templateWidgets = buildTemplateWidgets();
	});

	let saving = $state(false);
	let catalogOpen = $state(false);
	let editingWidget = $state<TemplateWidgetItem | null>(null);
	let catalogSearch = $state('');

	let sortedWidgets = $derived(
		[...templateWidgets].sort((a, b) => a.position.order - b.position.order)
	);

	let availableWidgets = $derived(data.widgets as WidgetRow[]);
	let catalogMap = $derived(new Map(availableWidgets.map((w) => [w.widgetType, w])));
	let editingConfigFields = $derived<ConfigFieldDescriptor[]>(
		(editingWidget
			? (catalogMap.get(editingWidget.widget_type)?.configFields as ConfigFieldDescriptor[] | null)
			: null) ?? []
	);
	let filteredCatalog = $derived(
		availableWidgets.filter(
			(w) =>
				(w.name ?? '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
				(w.widgetType ?? '').toLowerCase().includes(catalogSearch.toLowerCase())
		)
	);

	// ── Drag and Drop ─────────────────────────────────────────────────────────
	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	function handleDragStart(e: DragEvent, id: string) {
		draggedId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', id);
		}
	}

	function handleDragOver(e: DragEvent, id: string) {
		if (!draggedId || draggedId === id) return;
		e.preventDefault();
		dragOverId = id;
	}

	function handleDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		if (!draggedId || draggedId === targetId) {
			draggedId = null;
			dragOverId = null;
			return;
		}

		const dragged = templateWidgets.find((w) => w.id === draggedId);
		const target = templateWidgets.find((w) => w.id === targetId);
		if (!dragged || !target) {
			draggedId = null;
			dragOverId = null;
			return;
		}

		const draggedOrder = dragged.position.order;
		const targetOrder = target.position.order;

		templateWidgets = templateWidgets.map((w) => {
			let newOrder = w.position.order;
			if (w.id === draggedId) {
				newOrder = targetOrder;
			} else if (draggedOrder < targetOrder) {
				if (w.position.order > draggedOrder && w.position.order <= targetOrder) {
					newOrder = w.position.order - 1;
				}
			} else {
				if (w.position.order >= targetOrder && w.position.order < draggedOrder) {
					newOrder = w.position.order + 1;
				}
			}
			return { ...w, position: { ...w.position, order: newOrder } };
		});

		draggedId = null;
		dragOverId = null;
	}

	// ── Widget Operations ─────────────────────────────────────────────────────
	function addWidget(catalogWidget: WidgetRow) {
		const newWidget: TemplateWidgetItem = {
			id: crypto.randomUUID(),
			widget_type: catalogWidget.widgetType ?? '',
			widget_title: catalogWidget.name ?? '',
			position: { order: templateWidgets.length, size: catalogWidget.defaultSize || 'md' },
			default_config: (catalogWidget.defaultConfig as Record<string, unknown>) ?? {},
			visual_config: null
		};
		templateWidgets = [...templateWidgets, newWidget];
		catalogOpen = false;
		toast.success(`Added ${catalogWidget.name}`);
	}

	function removeWidget(id: string) {
		templateWidgets = templateWidgets
			.filter((w) => w.id !== id)
			.map((w, i) => ({ ...w, position: { ...w.position, order: i } }));
	}

	function handleWidgetSave(updated: TemplateWidgetItem) {
		templateWidgets = templateWidgets.map((w) => (w.id === updated.id ? updated : w));
		editingWidget = null;
	}

	// ── Save to database ────────────────────────────────────────────────────
	async function handleSave() {
		saving = true;
		try {
			const payload = sortedWidgets.map(({ id, ...rest }) => rest);
			const result = await updateTemplateWidgets({
				id: data.template.id,
				default_widgets: JSON.stringify(payload)
			});
			if (result?.success) {
				toast.success('Template saved');
				await invalidateAll();
			} else {
				toast.error(result?.error || 'Failed to save');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save');
		} finally {
			saving = false;
		}
	}

	function colSpan(size: string): string {
		if (size === 'lg') return 'col-span-1 md:col-span-2 lg:col-span-3';
		if (size === 'md') return 'col-span-1 md:col-span-2';
		return 'col-span-1 md:col-span-2';
	}
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<!-- Header -->
	<div class="flex items-center justify-between px-4 lg:px-6">
		<div class="flex items-center gap-3">
			<Button variant="ghost" size="sm" onclick={() => goto('/dashboard-templates')}>
				<ArrowLeft class="size-4" />
			</Button>
			<div>
				<h2 class="text-2xl font-bold tracking-tight">{data.template.name}</h2>
				<p class="text-sm text-muted-foreground">
					Visual template editor — drag to reorder, click settings to configure
				</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" onclick={() => (catalogOpen = true)}>
				<Plus class="mr-1.5 size-3.5" />
				Add Widget
			</Button>
			<Button size="sm" onclick={handleSave} disabled={saving}>
				{#if saving}
					<Loader2 class="mr-1.5 size-3.5 animate-spin" />
				{:else}
					<Save class="mr-1.5 size-3.5" />
				{/if}
				Save
			</Button>
		</div>
	</div>

	<!-- Widget Grid -->
	<div class="px-4 lg:px-6">
		{#if sortedWidgets.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 py-20"
			>
				<p class="mb-2 text-lg font-medium text-muted-foreground">No widgets yet</p>
				<p class="mb-4 text-sm text-muted-foreground">
					Add widgets from the catalog to build this template
				</p>
				<Button variant="outline" onclick={() => (catalogOpen = true)}>
					<Plus class="mr-1.5 size-3.5" />
					Add Widget
				</Button>
			</div>
		{:else}
			<div class="grid auto-rows-auto grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-6">
				{#each sortedWidgets as widget (widget.id)}
					<div
						class="{colSpan(widget.position.size)} transition-transform {draggedId === widget.id
							? 'z-20 scale-[1.02] opacity-50'
							: 'z-0'}"
						draggable="true"
						ondragstart={(e) => handleDragStart(e, widget.id)}
						ondragover={(e) => handleDragOver(e, widget.id)}
						ondragleave={() => (dragOverId = null)}
						ondrop={(e) => handleDrop(e, widget.id)}
						ondragend={() => {
							draggedId = null;
							dragOverId = null;
						}}
						role="listitem"
					>
						<Card.Root
							class="relative flex flex-col gap-0 overflow-hidden p-0 transition-all
								{dragOverId === widget.id ? 'ring-2 ring-primary' : ''}
								cursor-grab ring-1 ring-border/50 active:cursor-grabbing"
						>
							<div
								class="flex items-center justify-between gap-1 border-b border-border/30 px-2 py-1.5"
							>
								<div class="flex min-w-0 items-center gap-1.5">
									<GripVertical class="size-3.5 shrink-0 text-muted-foreground" />
									<span class="truncate text-sm font-medium">{widget.widget_title}</span>
								</div>
								<div class="flex shrink-0 items-center gap-0.5">
									<span class="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
										{widget.position.size}
									</span>
									<Button
										variant="ghost"
										size="sm"
										class="h-6 w-6 p-0"
										onclick={() => (editingWidget = { ...widget })}
									>
										<Settings class="size-3" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										class="h-6 w-6 p-0 text-destructive hover:text-destructive"
										onclick={() => removeWidget(widget.id)}
									>
										<X class="size-3" />
									</Button>
								</div>
							</div>
							<!-- Preview placeholder -->
							<div class="flex items-center justify-center p-6 text-sm text-muted-foreground/50">
								{widget.widget_type} widget preview
							</div>
						</Card.Root>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Widget Catalog Dialog -->
<Dialog.Root bind:open={catalogOpen}>
	<Dialog.Content class="max-w-2xl gap-0 overflow-hidden p-0">
		<div class="flex flex-col gap-4 border-b border-border/40 p-6">
			<Dialog.Header>
				<Dialog.Title class="text-xl font-semibold">Widget Catalog</Dialog.Title>
				<Dialog.Description class="text-muted-foreground">
					Select a widget to add to this template.
				</Dialog.Description>
			</Dialog.Header>
			<div class="relative">
				<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input placeholder="Search widgets..." class="pl-10" bind:value={catalogSearch} />
			</div>
		</div>
		<div class="max-h-96 overflow-y-auto p-4">
			<div class="grid grid-cols-2 gap-3">
				{#each filteredCatalog as cw (cw.id)}
					<button
						type="button"
						class="flex items-start gap-3 rounded-lg border border-border/40 p-3 text-left transition-colors hover:bg-muted/50"
						onclick={() => addWidget(cw)}
					>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium">{cw.name}</p>
							<p class="text-xs text-muted-foreground">{cw.widgetType}</p>
							{#if cw.description}
								<p class="mt-1 line-clamp-2 text-xs text-muted-foreground/70">
									{cw.description}
								</p>
							{/if}
						</div>
						<span class="rounded bg-muted px-1.5 py-0.5 text-xs">{cw.defaultSize || 'md'}</span>
					</button>
				{/each}
			</div>
			{#if filteredCatalog.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">No widgets found</p>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Widget Settings Sheet -->
<WidgetSettingsSheet
	widget={editingWidget}
	configFields={editingConfigFields}
	onclose={() => (editingWidget = null)}
	onsave={handleWidgetSave}
/>
