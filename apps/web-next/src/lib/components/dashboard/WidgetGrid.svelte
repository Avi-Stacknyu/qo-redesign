<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
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
		type ProfileSummaryConfig
	} from '$lib/types/widgets';
	import Calendar from './widget/Calendar.svelte';
	import QuickActions from './widget/QuickActions.svelte';
	import ProfileSummary from './widget/ProfileSummary.svelte';
	import News from './widget/News.svelte';
	import Todo from './widget/Todo.svelte';
	import Reminder from './widget/Reminder.svelte';
	import Note from './widget/ NoteSplit.svelte';
	import PlaidWidget from './widget/PlaidWidget.svelte';
	import ChartWidget from './widgets/ChartWidget.svelte';
	import RecentChatsWidget from './widgets/RecentChatsWidget.svelte';
	import BookmarksWidget from './widgets/BookmarksWidget.svelte';

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
	let todoShowInput = $state(false);

	const DEFAULT_CHART_CONFIG: ChartConfig = { chartType: 'area', dateRange: 'month' };
	const DEFAULT_RECENT_CHATS_CONFIG: RecentChatsConfig = { limit: 5, showAgentName: true };
	const DEFAULT_BOOKMARKS_CONFIG: BookmarksConfig = {};

	function normalizeWidgetType(type: string | null | undefined) {
		const normalized = (type ?? '').trim().toLowerCase();

		if (!normalized) return '';
		if (normalized === 'reminder') return 'reminders';
		if (normalized === 'plaid') return 'bank-accounts';
		if (normalized.includes('chart') || normalized.includes('analytics') || normalized.includes('gauge')) {
			return 'chart';
		}
		if (
			normalized === 'todo' ||
			normalized.includes('task') ||
			normalized.includes('todo') ||
			normalized.includes('list')
		) {
			return 'todo';
		}
		if (normalized.includes('reminder')) return 'reminders';
		if (normalized.includes('calendar')) return 'calendar';
		if (normalized.includes('quick-action') || normalized === 'actions' || normalized.endsWith('actions')) {
			return 'quick-actions';
		}
		if (normalized === 'big-news') return 'news';
		if (normalized.includes('news')) return 'news';
		if (normalized.includes('bookmark')) return 'bookmarks';
		if (normalized.includes('profile') || normalized.includes('summary')) return 'profile-summary';
		if (normalized.includes('knowledge') || normalized.includes('memory')) return 'note';
		if (normalized.includes('chat') || normalized.includes('conversation')) return 'recent-chats';
		if (normalized.includes('bank') || normalized.includes('account') || normalized.includes('plaid')) {
			return 'bank-accounts';
		}
		if (normalized.includes('note')) return 'note';

		return normalized;
	}

	function headerConfig(widget: UserWidgetInstanceRecord): Record<string, unknown> {
		switch (normalizeWidgetType(widget.widget_type)) {
			case 'calendar':
				return {
					showHeader: false
				};
			case 'quick-actions':
				return {
					widget_title: widget.widget_title || 'Quick Actions',
					showAddButton: false
				};
			case 'todo':
				return {
					widget_title: widget.widget_title || 'Todos',
					showAddButton: true,
					onAdd: () => (todoShowInput = !todoShowInput)
				};
			case 'reminders':
				return {
					widget_title: widget.widget_title || 'Reminders',
					showAddButton: false
				};
			case 'profile-summary':
				return {
					widget_title: widget.widget_title || 'Profile Summary',
					showAddButton: false
				};
			case 'news':
				return {
					widget_title: widget.widget_title || 'News',
					showAddButton: false
				};
			case 'note':
				return {
					widget_title: widget.widget_title || 'Knowledge',
					showAddButton: false
				};
			default:
				return {
					widget_title: widget.widget_title || widget.widget_type || 'Widget',
					showAddButton: false
				};
		}
	}

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
		class="grid grid-cols-1 pb-16 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
		style="grid-auto-rows: {ROW_H}px; column-gap: {GAP}px;"
	>
		{#each sortedWidgets as widget (widget.id)}
			{@const resolvedType = normalizeWidgetType(widget.widget_type)}
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
				<WidgetCard
					instance={{ ...widget, ...headerConfig(widget) }}
					{editMode}
					{onRemove}
					{onUpdate}
					showHeader={resolvedType !== 'calendar'}
				>
					{#snippet children()}
						{@const cfg = widget.custom_config}
						{@const chartCfg = { ...DEFAULT_CHART_CONFIG, ...(cfg as Partial<ChartConfig>) }}
						{@const recentChatsCfg = {
							...DEFAULT_RECENT_CHATS_CONFIG,
							...(cfg as Partial<RecentChatsConfig>)
						}}
						{@const bookmarksCfg = {
							...DEFAULT_BOOKMARKS_CONFIG,
							...(cfg as Partial<BookmarksConfig>)
						}}
						{#if resolvedType === 'calendar'}
							<Calendar />
						{:else if resolvedType === 'quick-actions'}
							<QuickActions config={cfg as QuickActionsConfig} />
						{:else if resolvedType === 'todo'}
							<Todo config={cfg as TodoConfig} bind:showInput={todoShowInput} />
						{:else if resolvedType === 'reminders'}
							<Reminder config={cfg as RemindersConfig} />
						{:else if resolvedType === 'profile-summary'}
							<ProfileSummary config={cfg as ProfileSummaryConfig} />
						{:else if resolvedType === 'news'}
							<News config={cfg as NewsConfig} />
						{:else if resolvedType === 'bank-accounts'}
							<PlaidWidget />
						{:else if resolvedType === 'chart'}
							<ChartWidget config={chartCfg} />
						{:else if resolvedType === 'recent-chats'}
							<RecentChatsWidget config={recentChatsCfg} />
						{:else if resolvedType === 'bookmarks'}
							<BookmarksWidget config={bookmarksCfg} />
						{:else if resolvedType === 'note'}
							<Note />
						{:else}
							<div class="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-[#D7DCE5] bg-[#F8FBFF] p-6 text-center">
								<p class="text-sm font-medium text-[#25324B]">Unsupported widget</p>
								<p class="text-xs leading-5 text-[#7B8794]">
									{widget.widget_type || 'Unknown'} is in this layout, but no renderer is registered yet.
								</p>
							</div>
						{/if}
					{/snippet}
				</WidgetCard>
			</div>
		{/each}
	</div>
{/if}
