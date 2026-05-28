<script lang="ts">
	import WidgetGrid from '$lib/components/dashboard/WidgetGrid.svelte';
	import WidgetCatalog from '$lib/components/dashboard/WidgetCatalog.svelte';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { loadCategories, loadWidgetCatalog } from '$lib/remote/dashboard.remote';
	import { loadDataSourcesCatalog } from '$lib/remote/widget-data.remote';
	import type { DashboardWidgetRow } from '@repo/db/types';
	import type { DataSourceCatalogItem } from '@repo/shared/types';
	import { Plus, Check, Settings2, Palette, Loader2 } from '@lucide/svelte';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';

	let {
		pageTitle,
		header
	}: {
		pageTitle: string;
		header: Snippet;
	} = $props();

	// ── Widget Options Context ───────────────────────────────────────────────────
	const categoriesQuery = loadCategories();
	let categories: { value: string; label: string }[] = $derived(
		Array.isArray(categoriesQuery.current) ? categoriesQuery.current : []
	);

	// ── Data Sources Catalog (dynamic from worker) ───────────────────────────────
	const dataSourcesQuery = loadDataSourcesCatalog();
	let rawDataSources: DataSourceCatalogItem[] = $derived(
		Array.isArray(dataSourcesQuery.current) ? dataSourcesQuery.current : []
	);
	let dataSources = $derived(
		rawDataSources.map((s) => ({
			value: s.source_id,
			label: s.label,
			type: s.type
		}))
	);

	// ── Widget Catalog Context (DB-driven) ───────────────────────────────────────
	const catalogQuery = loadWidgetCatalog();
	let catalogRecords: DashboardWidgetRow[] = $derived(
		Array.isArray(catalogQuery.current) ? catalogQuery.current : []
	);
	let widgetCatalogMap = $derived(new Map(catalogRecords.map((r) => [r.widgetType, r])));

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
			return catalogRecords;
		}
	});

	// ── Local UI state ───────────────────────────────────────────────────────────
	let catalogOpen = $state(false);
	let themeOpen = $state(false);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="relative min-h-[calc(100vh-4rem)] w-full">
	<!-- Header Section -->
	<div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
		{@render header()}

		<!-- Action Bar -->
		<div class="flex items-center gap-2">
			{#if dashboard.editMode}
				<div
					class="flex animate-in items-center gap-2 rounded-full border border-primary/20 bg-primary/10 p-1 pr-1 pl-3 backdrop-blur-sm fade-in slide-in-from-right-4"
				>
					<span class="text-xs font-medium text-primary">Editing Layout</span>
					<div class="h-4 w-px bg-primary/20"></div>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (catalogOpen = true)}
						class="h-7 gap-1.5 rounded-full text-xs font-medium text-primary hover:bg-primary/20 hover:text-primary"
					>
						<Plus class="size-3.5" />
						Add Widget
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => dashboard.exitEditMode()}
						disabled={dashboard.saving}
						class="h-7 rounded-full bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90"
					>
						{#if dashboard.saving}
							<Loader2 class="mr-1.5 size-3.5 animate-spin" />
							Saving
						{:else}
							<Check class="mr-1.5 size-3.5" />
							Done
						{/if}
					</Button>
				</div>
			{:else}
				<Button
					variant="secondary"
					size="sm"
					class="h-9 gap-2 rounded-full border border-border/40 bg-muted/50 text-muted-foreground backdrop-blur-md transition-all hover:bg-accent hover:text-accent-foreground"
					onclick={() => dashboard.enterEditMode()}
				>
					<Settings2 class="size-3.5" />
					Customize
				</Button>
				<ThemeSelector bind:open={themeOpen}>
					{#snippet trigger()}
						<Button
							variant="outline"
							size="sm"
							class="h-9 gap-2 rounded-full border-border/40 bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
						>
							<Palette class="size-3.5" />
						</Button>
					{/snippet}
				</ThemeSelector>
			{/if}
		</div>
	</div>

	<!-- Widget Grid -->
	<div class="relative">
		{#if dashboard.switching}
			<div
				class="absolute inset-0 z-10 flex animate-in items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm duration-200 fade-in"
			>
				<div class="flex flex-col items-center gap-3">
					<div class="relative">
						<div class="absolute inset-0 animate-ping rounded-full bg-primary/20"></div>
						<div class="relative rounded-full bg-primary/10 p-3">
							<Loader2 class="size-5 animate-spin text-primary" />
						</div>
					</div>
					<span class="text-xs font-medium tracking-wide text-muted-foreground"
						>Loading dashboard…</span
					>
				</div>
			</div>
		{/if}
		<div
			class="transition-all duration-300 {dashboard.switching
				? 'scale-[0.98] opacity-40 blur-[2px]'
				: 'blur-0 scale-100 opacity-100'}"
		>
			<WidgetGrid
				widgets={dashboard.widgets}
				editMode={dashboard.editMode}
				onReorder={(positions) => dashboard.reorderWidgets(positions)}
				onRemove={(id) => dashboard.removeWidget(id)}
				onUpdate={(id, updates) => dashboard.updateWidget(id, updates)}
			/>
		</div>
	</div>

	<WidgetCatalog
		bind:open={catalogOpen}
		onAdd={(type, title, size, category) => dashboard.addWidget(type, title, size, category)}
	/>
</div>
