<script lang="ts">
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import WidgetGrid from '$lib/components/dashboard/WidgetGrid.svelte';
	import WidgetCatalog from '$lib/components/dashboard/WidgetCatalog.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { loadCategories, loadWidgetCatalog } from '$lib/remote/dashboard.remote';
	import { loadDataSourcesCatalog } from '$lib/remote/widget-data.remote';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import { cn } from '$lib/utils';
	import type { DashboardWidgetRow } from '@repo/db/types';
	import type { DataSourceCatalogItem } from '@repo/shared/types';
	import { Check, LayoutGrid, Loader2, Plus, Settings2 } from '@lucide/svelte';
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';

	let {
		pageTitle,
		header
	}: {
		pageTitle: string;
		header: Snippet;
	} = $props();

	const categoriesQuery = loadCategories();
	const dataSourcesQuery = loadDataSourcesCatalog();
	const catalogQuery = loadWidgetCatalog();

	let categories: { value: string; label: string }[] = $derived(
		Array.isArray(categoriesQuery.current) ? categoriesQuery.current : []
	);
	let rawDataSources: DataSourceCatalogItem[] = $derived(
		Array.isArray(dataSourcesQuery.current) ? dataSourcesQuery.current : []
	);
	let dataSources = $derived(
		rawDataSources.map((source) => ({
			value: source.source_id,
			label: source.label,
			type: source.type
		}))
	);
	let catalogRecords: DashboardWidgetRow[] = $derived(
		Array.isArray(catalogQuery.current) ? catalogQuery.current : []
	);
	let widgetCatalogMap = $derived(new Map(catalogRecords.map((record) => [record.widgetType, record])));

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
		},
		get loading() {
			return catalogQuery.loading;
		}
	});

	let catalogOpen = $state(false);
	let createDialogOpen = $state(false);
	let newDashboardName = $state('');
	let creatingDashboard = $state(false);

	const activeProfileId = $derived(dashboard.activeProfileId);

	function selectDashboard(profileId: string) {
		dashboard.switchProfile(profileId);
	}

	async function createDashboard() {
		const name = newDashboardName.trim();
		if (!name || creatingDashboard) return;
		creatingDashboard = true;
		try {
			await dashboard.createProfile({
				name,
				profileType: 'custom',
				profileIcon: 'LayoutGrid',
				profileColor: 'var(--primary)',
				sourceProfileId: dashboard.activeProfileId ?? undefined
			});
			newDashboardName = '';
			createDialogOpen = false;
		} finally {
			creatingDashboard = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="relative min-h-[calc(100vh-4rem)] w-full">
	<div class="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,46rem)] xl:items-end">
		<div class="min-w-0 flex-1">
			{@render header()}
		</div>

		<div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
			<div class="min-w-0 flex-1 rounded-2xl border border-border/60 bg-card/75 p-1 shadow-xs backdrop-blur-xl">
				<div class="flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{#each dashboard.profiles as profile (profile.id)}
					<button
						type="button"
						onclick={() => selectDashboard(profile.id)}
						title={profile.profile_name}
						aria-current={profile.id === activeProfileId ? 'page' : undefined}
						class={cn(
							'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-all',
							profile.id === activeProfileId
								? 'bg-primary text-primary-foreground shadow-sm'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground'
						)}
					>
						<span
							class="h-2 w-2 shrink-0 rounded-full ring-1 ring-background/80"
							style:background-color={profile.profile_color || 'var(--primary)'}
						></span>
						<span class="max-w-36 truncate">{profile.profile_name}</span>
					</button>
				{/each}
				<button
					type="button"
					onclick={() => (createDialogOpen = true)}
					class="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
				>
					<Plus class="h-4 w-4" />
					<span class="hidden sm:inline">New</span>
				</button>
				</div>
			</div>

			<div class="flex items-center gap-2">
				{#if dashboard.editMode}
					<div class="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/85 p-1 pl-3 text-foreground shadow-xs">
						<span class="text-xs font-semibold">Editing layout</span>
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (catalogOpen = true)}
							class="h-8 rounded-xl px-3 text-xs font-semibold"
						>
							<Plus class="mr-1 h-3.5 w-3.5" />
							Widget
						</Button>
						<Button
							size="sm"
							onclick={() => dashboard.exitEditMode()}
							disabled={dashboard.saving}
							class="h-8 rounded-xl px-3 text-xs font-semibold"
						>
							{#if dashboard.saving}
								<Loader2 class="mr-1 h-3.5 w-3.5 animate-spin" />
								Saving
							{:else}
								<Check class="mr-1 h-3.5 w-3.5" />
								Done
							{/if}
						</Button>
					</div>
				{:else}
					<Button
						variant="secondary"
						size="icon-lg"
						onclick={() => dashboard.enterEditMode()}
						class="rounded-2xl border border-border/60 bg-card/85 text-muted-foreground shadow-xs hover:bg-primary hover:text-primary-foreground"
						aria-label="Edit current dashboard"
						title="Edit current dashboard"
					>
						<Settings2 class="h-5 w-5" />
					</Button>
					<ThemeSelector />
				{/if}
			</div>
		</div>
	</div>

	<div class="relative">
		{#if dashboard.switching}
			<div class="absolute inset-0 z-10 flex items-center justify-center rounded-[2rem] bg-background/70 backdrop-blur-sm">
				<div class="flex flex-col items-center gap-3 rounded-3xl border border-border/60 bg-card/95 px-6 py-5 shadow-lg">
					<Loader2 class="h-5 w-5 animate-spin text-primary" />
					<span class="text-xs font-medium tracking-wide text-muted-foreground">Loading dashboard...</span>
				</div>
			</div>
		{/if}
		<div
			class={cn(
				'transition-all duration-300',
				dashboard.switching ? 'scale-[0.98] opacity-40 blur-[2px]' : 'scale-100 opacity-100 blur-0'
			)}
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

<Dialog.Root bind:open={createDialogOpen}>
	<Dialog.Content class="overflow-hidden p-0 sm:max-w-lg">
		<div class="border-b border-border/60 bg-linear-to-br from-muted/70 via-card to-card p-6 pr-14">
			<Dialog.Header>
				<Dialog.Title class="text-xl font-semibold tracking-tight">Create dashboard</Dialog.Title>
				<Dialog.Description class="text-sm leading-6 text-muted-foreground">
					Start with a copy of your current layout, then edit widgets and cards for that dashboard.
				</Dialog.Description>
			</Dialog.Header>
		</div>

		<div class="grid gap-5 p-6">
			<div class="rounded-3xl border border-border/60 bg-background/70 p-4">
				<p class="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">Source layout</p>
				<p class="mt-2 text-sm font-medium text-foreground">
					{dashboard.activeProfile?.profile_name ?? 'Current dashboard'}
				</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Widgets, ordering, and card configuration will be duplicated.
				</p>
			</div>

			<div class="space-y-2">
				<label for="dashboard-name" class="text-sm font-medium text-foreground">Dashboard name</label>
				<Input
					id="dashboard-name"
					bind:value={newDashboardName}
					placeholder="Family office, Trading, Tasks..."
					class="h-11 rounded-2xl bg-background/70"
				/>
			</div>
		</div>

		<Dialog.Footer class="border-t border-border/60 bg-muted/20 p-4">
			<Button variant="outline" onclick={() => (createDialogOpen = false)}>Cancel</Button>
			<Button onclick={createDashboard} disabled={!newDashboardName.trim() || creatingDashboard}>
				{#if creatingDashboard}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Create dashboard
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
