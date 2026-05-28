<script lang="ts">
	import { page } from '$app/state';
	import { Loader2 } from '@lucide/svelte';
	import { setContext } from 'svelte';

	import WidgetGrid from '$lib/components/dashboard/WidgetGrid.svelte';

	type DashboardWidget = {
		id: string;
		widget_type: string;
		position: {
			order: number;
			size: string;
		};
		custom_config?: Record<string, unknown>;
		[key: string]: unknown;
	};

	type WidgetUpdate = Record<string, unknown>;

	type Props = {
		widgets?: DashboardWidget[];
		editMode?: boolean;
		switching?: boolean;
		onReorder?: (widgets: DashboardWidget[]) => void;
		onRemove?: (id: string) => void;
		onUpdate?: (id: string, updates: WidgetUpdate) => void;
	};

	const defaultWidgets: DashboardWidget[] = [
		{
			id: '1',
			widget_type: 'todo',
			position: {
				order: 1,
				size: 'md'
			},
			custom_config: {}
		},
		{
			id: '2',
			widget_type: 'calendar',
			position: {
				order: 2,
				size: 'sm'
			},
			custom_config: {}
		},
		{
			id: '3',
			widget_type: 'reminder',
			position: {
				order: 3,
				size: 'md'
			},
			custom_config: {}
		},
		{
			id: '4',
			widget_type: 'quick-actions',
			position: {
				order: 4,
				size: 'md'
			},
			custom_config: {}
		},
		{
			id: '5',
			widget_type: 'profile-summary',
			position: {
				order: 5,
				size: 'md'
			},
			custom_config: {}
		},
		{
			id: '6',
			widget_type: 'news',
			position: {
				order: 6,
				size: 'md'
			},
			custom_config: {}
		},
		{
			id: '7',
			widget_type: 'note',
			position: {
				order: 7,
				size: 'md'
			},
			custom_config: {}
		},
		{
			id: '8',
			widget_type: 'plaid',
			position: {
				order: 8,
				size: 'md'
			},
			custom_config: {}
		},
		{
			id: '9',
			widget_type: 'big-news',
			position: {
				order: 9,
				size: 'full'
			},
			custom_config: {}
		}
	];

	let {
		widgets = defaultWidgets,
		editMode = false,
		switching = false,
		onReorder,
		onRemove,
		onUpdate
	}: Props = $props();

	const categories = [
		{ value: 'productivity', label: 'Productivity' },
		{ value: 'finance', label: 'Finance' },
		{ value: 'personal', label: 'Personal' }
	];

	const dataSources = [
		{ value: 'manual', label: 'Manual', type: 'local' },
		{ value: 'api', label: 'API', type: 'remote' }
	];

	const widgetCatalogMap = new Map();

	setContext('widgetOptions', {
		get categories() {
			return categories;
		},
		get dataSources() {
			return dataSources;
		}
	});

	setContext('widgetCatalog', {
		get map() {
			return widgetCatalogMap;
		},
		get list() {
			return [];
		}
	});

	function cloneWidgets(items: DashboardWidget[]) {
		return items.map((widget) => ({
			...widget,
			position: { ...widget.position },
			custom_config: { ...(widget.custom_config ?? {}) }
		}));
	}

	let dashboard = $state({
		editMode: false,
		saving: false,
		switching: false,
		widgets: cloneWidgets(defaultWidgets),

		enterEditMode() {
			dashboard.editMode = true;
		},

		exitEditMode() {
			dashboard.editMode = false;
		},

		addWidget() {},

		removeWidget(id: string) {
			dashboard.widgets = dashboard.widgets.filter((widget) => widget.id !== id);
		},

		updateWidget(id: string, updates: WidgetUpdate) {
			dashboard.widgets = dashboard.widgets.map((widget) =>
				widget.id === id ? { ...widget, ...updates } : widget
			);
		},

		reorderWidgets(nextWidgets: DashboardWidget[]) {
			if (nextWidgets.length > 0) {
				dashboard.widgets = cloneWidgets(nextWidgets);
			}
		}
	});

	$effect(() => {
		dashboard.widgets = cloneWidgets(widgets);
		dashboard.editMode = editMode;
		dashboard.switching = switching;
	});

	function handleReorder(nextWidgets: DashboardWidget[]) {
		dashboard.reorderWidgets(nextWidgets);
		onReorder?.(nextWidgets);
	}

	function handleRemove(id: string) {
		dashboard.removeWidget(id);
		onRemove?.(id);
	}

	function handleUpdate(id: string, updates: WidgetUpdate) {
		dashboard.updateWidget(id, updates);
		onUpdate?.(id, updates);
	}
</script>

<div class="relative">
	{#if dashboard.switching}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm"
		>
			<div class="flex flex-col items-center gap-3">
				<div class="relative">
					<div class="absolute inset-0 animate-ping rounded-full bg-primary/20"></div>

					<div class="relative rounded-full bg-primary/10 p-3">
						<Loader2 class="size-5 animate-spin text-primary" />
					</div>
				</div>

				<span class="text-xs font-medium tracking-wide text-muted-foreground">
					Loading {page.url.pathname.split('/')[1] || 'dashboard'}...
				</span>
			</div>
		</div>
	{/if}

	<div
		class={`transition-all duration-300 ${
			dashboard.switching ? 'scale-[0.98] opacity-40 blur-[2px]' : 'blur-0 scale-100 opacity-100'
		}`}
	>
		<WidgetGrid
			widgets={dashboard.widgets}
			editMode={dashboard.editMode}
			onReorder={handleReorder}
			onRemove={handleRemove}
			onUpdate={handleUpdate}
		/>
	</div>
</div>
