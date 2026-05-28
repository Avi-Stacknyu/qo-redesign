<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import WidgetCard from './WidgetCard.svelte';
	import {
		type UserWidgetInstanceRecord,
		type WidgetPosition,
		type ChartConfig,
		type TodoConfig,
		type NewsConfig,
		type RemindersConfig,
		type QuickActionsConfig,
		type RecentChatsConfig,
		type BookmarksConfig,
		type ProfileSummaryConfig,
		type KnowledgeConfig
	} from '$lib/types/widgets';
	import ChartWidget from './widgets/ChartWidget.svelte';
	import TodoWidget from './widgets/TodoWidget.svelte';
	import NewsWidget from './widgets/NewsWidget.svelte';
	import RemindersWidget from './widgets/RemindersWidget.svelte';
	import QuickActionsWidget from './widgets/QuickActionsWidget.svelte';
	import RecentChatsWidget from './widgets/RecentChatsWidget.svelte';
	import CalendarWidget from './widgets/CalendarWidget.svelte';
	import BookmarksWidget from './widgets/BookmarksWidget.svelte';
	import ProfileSummaryWidget from './widgets/ProfileSummaryWidget.svelte';
	import KnowledgeWidget from './widgets/KnowledgeWidget.svelte';
	import PlaidWidget from './widgets/PlaidWidget.svelte';

	let {
		widgets,
		editMode = false,
		onReorder,
		onRemove,
		onUpdate
	}: {
		widgets: UserWidgetInstanceRecord[];
		editMode?: boolean;
		onReorder?: (widgetPositions: { widgetId: string; position: WidgetPosition }[]) => void;
		onRemove?: (id: string) => void;
		onUpdate?: (id: string, data: Partial<UserWidgetInstanceRecord>) => void;
	} = $props();

	let sortedWidgets = $derived([...widgets].sort((a, b) => a.position.order - b.position.order));

	// ── Masonry action ──────────────────────────────────────────────────────────
	// CSS Grid with micro-rows (2px each, no row-gap). Each item measures its
	// card's rendered height via ResizeObserver, then sets grid-row: span N
	// so the item occupies exactly card-height + visual-gap worth of rows.
	const ROW_H = 2;
	const GAP = 16;

	function masonryItem(node: HTMLElement) {
		let frame = 0;
		let lastSpan = 0;

		function recalc() {
			const card = node.firstElementChild as HTMLElement | null;
			if (!card) return;
			const height = Math.ceil(card.offsetHeight);
			const span = Math.max(1, Math.ceil((height + GAP) / ROW_H));

			if (span === lastSpan) return;

			lastSpan = span;
			node.style.gridRowEnd = `span ${span}`;
		}

		function scheduleRecalc() {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(recalc);
		}

		const ro = new ResizeObserver(scheduleRecalc);
		const card = node.firstElementChild;
		if (card) ro.observe(card);
		scheduleRecalc();

		return {
			destroy: () => {
				cancelAnimationFrame(frame);
				ro.disconnect();
			}
		};
	}

	function colSpan(size: string): string {
		if (size === 'lg') return 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-3 2xl:col-span-3';
		if (size === 'md') return 'col-span-1 md:col-span-2';
		return 'col-span-1';
	}

	// ── Drag and Drop State ──────────────────────────────────────────────────────
	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	function handleDragStart(e: DragEvent, widgetId: string) {
		if (!editMode) {
			e.preventDefault();
			return;
		}
		draggedId = widgetId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', widgetId);
		}
	}

	function handleDragOver(e: DragEvent, widgetId: string) {
		if (!editMode || !draggedId || draggedId === widgetId) return;
		e.preventDefault();
		dragOverId = widgetId;
	}

	function handleDragLeave() {
		dragOverId = null;
	}

	function handleDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		if (!editMode || !draggedId || draggedId === targetId) {
			resetDragState();
			return;
		}

		const draggedWidget = widgets.find((w) => w.id === draggedId);
		const targetWidget = widgets.find((w) => w.id === targetId);

		if (!draggedWidget || !targetWidget) {
			resetDragState();
			return;
		}

		const draggedOrder = draggedWidget.position.order;
		const targetOrder = targetWidget.position.order;

		const newPositions = widgets.map((w) => {
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

			return { widgetId: w.id, position: { ...w.position, order: newOrder } };
		});

		onReorder?.(newPositions);
		resetDragState();
	}

	function handleDragEnd() {
		resetDragState();
	}

	function resetDragState() {
		draggedId = null;
		dragOverId = null;
	}
</script>

{#if sortedWidgets.length === 0}
	<div
		class="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-linear-to-br from-muted/20 to-muted/5 p-8 text-center"
	>
		<div class="mb-4 rounded-2xl bg-linear-to-br from-primary/10 to-primary/5 p-4 shadow-inner">
			<Sparkles class="size-8 text-primary/70" />
		</div>
		<p class="text-base font-semibold text-foreground">Your dashboard is empty</p>
		<p class="mt-1 max-w-xs text-sm text-muted-foreground">
			Add widgets to customize your dashboard and track what matters to you
		</p>
	</div>
{:else}
	<div
		class="grid grid-cols-1 pb-20 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
		style="grid-auto-rows: {ROW_H}px; column-gap: {GAP}px;"
	>
		{#each sortedWidgets as widget (widget.id)}
			<div
				class="{colSpan(widget.position.size)} self-start transition-opacity duration-200
					{draggedId === widget.id ? 'opacity-50' : ''}
					{dragOverId === widget.id ? 'rounded-xl ring-2 ring-primary ring-offset-2' : ''}"
				use:masonryItem
				draggable={editMode}
				ondragstart={(e) => handleDragStart(e, widget.id)}
				ondragover={(e) => handleDragOver(e, widget.id)}
				ondragleave={handleDragLeave}
				ondrop={(e) => handleDrop(e, widget.id)}
				ondragend={handleDragEnd}
				role={editMode ? 'listitem' : undefined}
			>
				<WidgetCard instance={widget} {editMode} {onRemove} {onUpdate}>
					{#snippet children()}
						{@const cfg = widget.custom_config}
						{#if widget.widget_type === 'chart'}
							<ChartWidget config={cfg as ChartConfig} />
						{:else if widget.widget_type === 'todo'}
							<TodoWidget config={cfg as TodoConfig} />
						{:else if widget.widget_type === 'news'}
							<NewsWidget config={cfg as NewsConfig} />
						{:else if widget.widget_type === 'reminders'}
							<RemindersWidget config={cfg as RemindersConfig} />
						{:else if widget.widget_type === 'quick-actions'}
							<QuickActionsWidget config={cfg as QuickActionsConfig} />
						{:else if widget.widget_type === 'recent-chats'}
							<RecentChatsWidget config={cfg as RecentChatsConfig} />
						{:else if widget.widget_type === 'calendar'}
							<CalendarWidget />
						{:else if widget.widget_type === 'bookmarks'}
							<BookmarksWidget config={cfg as BookmarksConfig} />
						{:else if widget.widget_type === 'profile-summary'}
							<ProfileSummaryWidget config={cfg as ProfileSummaryConfig} />
						{:else if widget.widget_type === 'knowledge'}
							<KnowledgeWidget config={cfg as KnowledgeConfig} />
						{:else if widget.widget_type === 'bank-accounts'}
							<PlaidWidget />
						{/if}
					{/snippet}
				</WidgetCard>
			</div>
		{/each}
	</div>
{/if}
