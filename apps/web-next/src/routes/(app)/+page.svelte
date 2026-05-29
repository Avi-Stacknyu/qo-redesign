<script lang="ts">
	import { Check, LayoutGrid, Loader2, Palette, Plus, Settings2 } from '@lucide/svelte';
	import type { DashboardWidgetRow } from '@repo/db/types';
	import type { DataSourceCatalogItem } from '@repo/shared/types';
	import Shell from '$lib/components/Shell.svelte';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import WidgetCatalog from '$lib/components/dashboard/WidgetCatalog.svelte';
	import WidgetGrid from '$lib/components/dashboard/WidgetGrid.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { AppLayoutState } from '$lib/constants/data';
	import { loadCategories, loadWidgetCatalog } from '$lib/remote/dashboard.remote';
	import { loadDataSourcesCatalog } from '$lib/remote/widget-data.remote';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import { cn } from '$lib/utils';
	import { getContext, setContext } from 'svelte';
	import type { WidgetSize } from '$lib/types/widgets';

	let { data } = $props();

	const appLayoutState = getContext<AppLayoutState>('app-layout');
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
	let themeOpen = $state(false);
	let autoSeededProfileIds = $state<string[]>([]);

	const QUANT_DASHBOARD_WIDGETS: Array<{
		type: string;
		title: string;
		size: WidgetSize;
	}> = [
		{ type: 'todo', title: 'Todo List', size: 'md' },
		{ type: 'calendar', title: 'Calendar', size: 'sm' },
		{ type: 'reminders', title: 'Reminders', size: 'md' },
		{ type: 'quick-actions', title: 'Quick Actions', size: 'md' },
		{ type: 'profile-summary', title: 'Profile Summary', size: 'md' },
		{ type: 'news', title: 'News Feed', size: 'md' },
		{ type: 'note', title: 'Quick Notes', size: 'lg' },
		{ type: 'bank-accounts', title: 'Bank Accounts', size: 'md' }
	];

	function normalizeWidgetType(type: string | null | undefined) {
		if (type === 'reminder') return 'reminders';
		if (type === 'plaid') return 'bank-accounts';
		return type ?? '';
	}

	$effect(() => {
		dashboard.hydrateWidgets(data.layout, data.widgets);
	});

	$effect(() => {
		const profileId = dashboard.activeProfileId;
		const activeProfile = dashboard.activeProfile;

		if (!profileId || !dashboard.layout || !activeProfile) return;
		if (!(activeProfile.is_default || activeProfile.profile_type === 'personal')) return;
		if (autoSeededProfileIds.includes(profileId)) return;

		const existingTypes = new Set(
			dashboard.widgets.map((widget) => normalizeWidgetType(widget.widget_type))
		);
		const missingWidgets = QUANT_DASHBOARD_WIDGETS.filter(
			(widget) => !existingTypes.has(normalizeWidgetType(widget.type))
		);

		autoSeededProfileIds = [...autoSeededProfileIds, profileId];

		for (const widget of missingWidgets) {
			dashboard.addWidget(widget.type, widget.title, widget.size);
		}
	});

	const userName = $derived(data.user?.name || 'Trader');
	const activeProfileId = $derived(dashboard.activeProfileId);
	const dashboardSubtitle = $derived(
		dashboard.activeProfile
			? `${dashboard.widgets.length} widget${dashboard.widgets.length === 1 ? '' : 's'} on ${dashboard.activeProfile.profile_name}`
			: 'Shape your command center with the widgets that matter most.'
	);

	const currentDate = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	}).format(new Date());

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

<Shell pageTitle="Dashboard — Quant Orion" headerVerticalAlign="center">
	{#snippet header()}
		<div class="space-y-1.5">
			<h2 class="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
				{currentDate}
			</h2>
			<h1 class="max-w-3xl text-3xl leading-tight font-medium tracking-tight text-foreground lg:text-4xl">
				Welcome back, <span
					class="bg-linear-to-r from-primary to-secondary bg-clip-text font-semibold text-transparent"
					>{userName}</span
				>
			</h1>
			<p class="max-w-2xl text-sm leading-6 text-[#7B8794] md:text-[15px]">
				{dashboardSubtitle}
			</p>
		</div>
	{/snippet}

	{#snippet headerTabs()}
		<div class="min-w-0 flex-1 rounded-[26px] border border-white/70 bg-white/72 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl">
			<div class="flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{#each dashboard.profiles as profile (profile.id)}
					<button
						type="button"
						onclick={() => selectDashboard(profile.id)}
						title={profile.profile_name}
						aria-current={profile.id === activeProfileId ? 'page' : undefined}
						class={cn(
							'inline-flex h-10 shrink-0 items-center gap-2 rounded-[20px] px-4 text-sm font-medium transition-all',
							profile.id === activeProfileId
								? 'bg-[#111A2E] text-white shadow-[0_14px_30px_rgba(17,26,46,0.24)]'
								: 'text-[#6B7280] hover:bg-[#F3F6FB] hover:text-[#1F2937]'
						)}
					>
						<span
							class="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/70"
							style:background-color={profile.profile_color || 'var(--primary)'}
						></span>
						<span class="max-w-40 truncate">{profile.profile_name}</span>
					</button>
				{/each}

				<button
					type="button"
					onclick={() => (createDialogOpen = true)}
					class="inline-flex h-10 shrink-0 items-center gap-2 rounded-[20px] px-4 text-sm font-medium text-[#6B7280] transition-all hover:bg-[#F3F6FB] hover:text-[#1F2937]"
				>
					<Plus class="h-4 w-4" />
					<span>New</span>
				</button>
			</div>
		</div>
	{/snippet}

	{#snippet headerUtilities()}
		<div class="flex items-center gap-2">
			{#if dashboard.editMode}
				<div class="flex items-center gap-2 rounded-[22px] border border-white/70 bg-white/80 p-1.5 pl-4 text-[#25324B] shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl">
					<span class="text-xs font-semibold tracking-[0.16em] text-[#7B8794] uppercase">Editing</span>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (catalogOpen = true)}
						class="h-9 rounded-full px-4 text-xs font-semibold text-[#25324B] hover:bg-[#F3F6FB]"
					>
						<Plus class="mr-1 h-3.5 w-3.5" />
						Widget
					</Button>
					<Button
						size="sm"
						onclick={() => dashboard.exitEditMode()}
						disabled={dashboard.saving}
						class="h-9 rounded-full bg-[#111A2E] px-4 text-xs font-semibold text-white hover:bg-[#0A1120]"
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
					class="rounded-full border border-white/70 bg-white/82 text-[#6B7280] shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:bg-[#111A2E] hover:text-white"
					aria-label="Edit current dashboard"
					title="Edit current dashboard"
				>
					<Settings2 class="h-5 w-5" />
				</Button>
				<ThemeSelector bind:open={themeOpen}>
					{#snippet trigger()}
						<Button
							variant="outline"
							size="icon-lg"
							class="rounded-full border border-white/70 bg-white/82 text-[#6B7280] shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:bg-[#F3F6FB] hover:text-[#1F2937]"
							aria-label="Open theme picker"
							title="Open theme picker"
						>
							<Palette class="h-5 w-5" />
						</Button>
					{/snippet}
				</ThemeSelector>
			{/if}
		</div>
	{/snippet}

	<div
		class={cn(
			'transition-[margin] duration-300',
			appLayoutState.sidebarVisible ? 'ml-0' : '-ml-16 sm:-ml-18 lg:-ml-22'
		)}
	>
		<div class="relative mt-2">
			{#if dashboard.switching}
				<div class="absolute inset-0 z-10 flex items-center justify-center rounded-[2.25rem] bg-white/52 backdrop-blur-md">
					<div class="flex flex-col items-center gap-3 rounded-[28px] border border-white/80 bg-white/90 px-6 py-5 shadow-[0_20px_48px_rgba(15,23,42,0.12)]">
						<Loader2 class="h-5 w-5 animate-spin text-primary" />
						<span class="text-xs font-medium tracking-[0.16em] text-[#7B8794] uppercase">Loading dashboard</span>
					</div>
				</div>
			{/if}

			<div
				class={cn(
					'transition-all duration-300',
					dashboard.switching ? 'scale-[0.985] opacity-35 blur-[3px]' : 'scale-100 opacity-100 blur-0'
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
	</div>

	<WidgetCatalog
		bind:open={catalogOpen}
		onAdd={(type, title, size, category) => dashboard.addWidget(type, title, size, category)}
	/>
</Shell>

<Dialog.Root bind:open={createDialogOpen}>
	<Dialog.Content class="overflow-hidden rounded-[30px] border-white/70 bg-white/95 p-0 shadow-[0_32px_80px_rgba(15,23,42,0.18)] sm:max-w-lg">
		<div class="border-b border-[#E7EDF7] bg-linear-to-br from-[#F8FBFF] via-white to-[#F4F0FF] p-6 pr-14">
			<Dialog.Header>
				<Dialog.Title class="text-xl font-semibold tracking-tight text-[#25324B]">Create dashboard</Dialog.Title>
				<Dialog.Description class="text-sm leading-6 text-[#7B8794]">
					Start from your current layout, then customize widgets, colors, and data sources for that workspace.
				</Dialog.Description>
			</Dialog.Header>
		</div>

		<div class="grid gap-5 p-6">
			<div class="rounded-[24px] border border-[#E7EDF7] bg-[#F8FBFF] p-4">
				<p class="text-xs font-semibold tracking-[0.2em] text-[#98A2B3] uppercase">Source layout</p>
				<p class="mt-2 text-sm font-medium text-[#25324B]">
					{dashboard.activeProfile?.profile_name ?? 'Current dashboard'}
				</p>
				<p class="mt-1 text-xs text-[#7B8794]">
					Widgets, order, and card configuration will be duplicated into the new dashboard.
				</p>
			</div>

			<div class="space-y-2">
				<label for="dashboard-name" class="text-sm font-medium text-[#25324B]">Dashboard name</label>
				<Input
					id="dashboard-name"
					bind:value={newDashboardName}
					placeholder="Family office, Trading, Tasks..."
					class="h-11 rounded-2xl border-[#E7EDF7] bg-white"
				/>
			</div>
		</div>

		<Dialog.Footer class="border-t border-[#E7EDF7] bg-[#FBFCFF] p-4">
			<Button variant="outline" class="rounded-full border-[#D7DCE5]" onclick={() => (createDialogOpen = false)}>
				Cancel
			</Button>
			<Button
				class="rounded-full bg-[#111A2E] text-white hover:bg-[#0A1120]"
				onclick={createDashboard}
				disabled={!newDashboardName.trim() || creatingDashboard}
			>
				{#if creatingDashboard}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Create dashboard
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
