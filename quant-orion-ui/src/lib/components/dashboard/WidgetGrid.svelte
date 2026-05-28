<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	import Calendar from './widget/Calendar.svelte';
	import QuickActions from './widget/QuickActions.svelte';
	import ProfileSummary from './widget/ProfileSummary.svelte';
	import News from './widget/News.svelte';
	import BigNews from './widget/BigNews.svelte';
	import Todo from './widget/Todo.svelte';
	import Reminder from './widget/Reminder.svelte';

	import WidgetCard from './WidgetCard.svelte';
	import Note from './widget/ NoteSplit.svelte';

	let { widgets = [], editMode = false, onReorder, onRemove, onUpdate } = $props();

	let todoShowInput = $state(false);
	let bigNewsFilter = $state('Markets');
	const bigNewsFilters = ['Markets', 'Tech', 'Policy'];

	// ─────────────────────────────────────────────────────────────
	// Sort widgets
	// ─────────────────────────────────────────────────────────────
	let sortedWidgets = $derived(
		[...widgets].sort((a, b) => {
			const priority: Record<string, number> = {
				calendar: 0,
				todo: 1,
				reminder: 2,
				'quick-actions': 3,
				note: 4
			};

			const pa = priority[a.widget_type] ?? 99;
			const pb = priority[b.widget_type] ?? 99;

			if (pa !== pb) return pa - pb;

			return a.position.order - b.position.order;
		})
	);

	// ─────────────────────────────────────────────────────────────
	// Header config
	// ─────────────────────────────────────────────────────────────
	function headerConfig(widget: any): Record<string, unknown> {
		switch (widget.widget_type) {
			case 'calendar':
				return {
					showHeader: false
				};

				case 'quick-actions':
					return {
						widget_title: widget.widget_title ?? 'Quick Actions',

						showAddButton: false
					};

			case 'todo':
				return {
					widget_title: widget.widget_title ?? 'Todos',

					count: widget.items?.length ?? widget.count ?? 2,

					showAddButton: true,

					onAdd: () => (todoShowInput = !todoShowInput)
				};

			case 'reminder':
				return {
					widget_title: widget.widget_title ?? 'Reminders',

					count: widget.items?.length ?? widget.count ?? 3,

					showAddButton: false
				};

			case 'profile-summary':
				return {
					widget_title: widget.widget_title ?? 'Profile Summary',
					showAddButton: false
				};

			case 'news':
				return {
					widget_title: widget.widget_title ?? 'News',
					showAddButton: false
				};

			case 'big-news':
				return {
					widget_title: widget.widget_title ?? 'News',
					showAddButton: false
				};

			case 'note':
				return {
					showHeader: false
				};

			default:
				return {
					widget_title: widget.widget_title ?? widget.widget_type,

					showAddButton: false
				};
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Masonry
	// ─────────────────────────────────────────────────────────────
	const ROW_H = 2;
	const GAP = 16;

	function masonryItem(node: HTMLElement) {
		let frame = 0;

		function recalc() {
			const card = node.firstElementChild as HTMLElement | null;

			if (!card) return;

			const height = Math.ceil(card.offsetHeight);

			const span = Math.max(1, Math.ceil((height + GAP) / ROW_H));

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
			destroy() {
				cancelAnimationFrame(frame);
				ro.disconnect();
			}
		};
	}

	// ─────────────────────────────────────────────────────────────
	// Column spans
	// ─────────────────────────────────────────────────────────────
	function colSpan(size: string): string {
		if (size === 'full')
			return 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5';
		if (size === 'lg') return 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-3';
		if (size === 'md') return 'col-span-1 md:col-span-2';
		return 'col-span-1';
	}

	// ─────────────────────────────────────────────────────────────
	// Drag state
	// ─────────────────────────────────────────────────────────────
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

	function handleDrop() {
		draggedId = null;
		dragOverId = null;

		onReorder?.([]);
	}

	function handleDragEnd() {
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
			Add widgets to customize your dashboard
		</p>
	</div>
{:else}
	<div
		class="grid grid-cols-1 pb-20 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
		style="grid-auto-rows: {ROW_H}px; column-gap: {GAP}px;"
	>
		{#each sortedWidgets as widget (widget.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="{widget.widget_type === 'note'
					? 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5'
					: colSpan(widget.position.size)} self-start transition-opacity duration-200
				{draggedId === widget.id ? 'opacity-50' : ''}
				{dragOverId === widget.id ? 'rounded-xl ring-2 ring-primary ring-offset-2' : ''}"
				use:masonryItem
				draggable={editMode}
				ondragstart={(e) => handleDragStart(e, widget.id)}
				ondragover={(e) => handleDragOver(e, widget.id)}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
				ondragend={handleDragEnd}
			>
				{#if widget.widget_type === 'note'}
					<Note
						showDate={false}
						showCategory={false}
						notes={[
							{
								id: 1,
								title: 'Quick Reminder',
								description: 'Push latest changes to GitHub before deployment.'
							}
						]}
					/>
				{:else if widget.widget_type === 'big-news'}
					<WidgetCard
						instance={{
							...widget,
							...headerConfig(widget)
						}}
						{editMode}
						{onRemove}
						{onUpdate}
						showHeader={true}
					>
						{#snippet headerRight()}
							<div class="flex gap-1.5">
								{#each bigNewsFilters as filter}
									<Button
										variant={bigNewsFilter === filter ? 'default' : 'ghost'}
										size="sm"
										onclick={() => (bigNewsFilter = filter)}
										class={[
											'rounded-full px-4 text-xs font-semibold tracking-wide transition-all',
											bigNewsFilter === filter
												? 'bg-[#6b38d4] text-white hover:bg-[#5a2dbb]'
												: 'bg-[#d3e4fe]/50 text-[#45464d] hover:bg-[#d3e4fe]'
										].join(' ')}
									>
										{filter}
									</Button>
								{/each}
							</div>
						{/snippet}
						{#snippet children()}
							<BigNews config={widget.custom_config ?? {}} bind:activeFilter={bigNewsFilter} />
						{/snippet}
					</WidgetCard>
				{:else}
					<WidgetCard
						instance={{
							...widget,
							...headerConfig(widget)
						}}
						{editMode}
						{onRemove}
						{onUpdate}
						showHeader={widget.widget_type !== 'calendar'}
					>
						{#snippet children()}
							{#if widget.widget_type === 'calendar'}
								<Calendar />
							{:else if widget.widget_type === 'quick-actions'}
								<QuickActions config={widget.custom_config ?? {}} />
							{:else if widget.widget_type === 'todo'}
								<Todo config={{}} bind:showInput={todoShowInput} />
							{:else if widget.widget_type === 'reminder'}
								<Reminder />
							{:else if widget.widget_type === 'profile-summary'}
								<ProfileSummary config={widget.custom_config ?? {}} />
							{:else if widget.widget_type === 'news'}
								<News config={widget.custom_config ?? {}} />
							{:else}
								<div
									class="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-400"
								>
									Unknown widget:
									{widget.widget_type}
								</div>
							{/if}
						{/snippet}
					</WidgetCard>
				{/if}
			</div>
		{/each}
	</div>
{/if}
