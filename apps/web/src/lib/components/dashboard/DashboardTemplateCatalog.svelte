<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Dialog from '$lib/components/shadcn/dialog/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Search, Plus, Loader2, LayoutDashboard, Pin } from '@lucide/svelte';
	import {
		loadTemplates,
		addDashboardFromTemplate,
		type DashboardTemplate
	} from '$lib/remote/templates.remote';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import type { UserProfileRecord } from '$lib/types/widgets';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const templatesQuery = loadTemplates();
	const templates = $derived((templatesQuery.current ?? []) as DashboardTemplate[]);

	let searchQuery = $state('');
	let adding = $state<string | null>(null);

	/** Unpinned dashboards the user can re-pin */
	const unpinnedDashboards = $derived(
		dashboard.profiles
			.filter((p) => !p.is_pinned && !p.is_default)
			.filter(
				(p) => !searchQuery || p.profile_name.toLowerCase().includes(searchQuery.toLowerCase())
			)
	);

	const filtered = $derived(
		templates.filter(
			(t) =>
				t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
				t.category.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	const grouped = $derived.by(() => {
		const map = new Map<string, DashboardTemplate[]>();
		for (const t of filtered) {
			const cat = t.category || 'Other';
			if (!map.has(cat)) map.set(cat, []);
			map.get(cat)!.push(t);
		}
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	});

	const showCustomOption = $derived(
		!searchQuery ||
			'custom dashboard'.includes(searchQuery.toLowerCase()) ||
			'blank'.includes(searchQuery.toLowerCase()) ||
			'empty'.includes(searchQuery.toLowerCase())
	);

	async function handleAdd(template: DashboardTemplate) {
		if (adding) return;
		adding = template.id;
		try {
			const profile = (await addDashboardFromTemplate({
				templateId: template.id
			})) as UserProfileRecord | undefined;
			if (profile?.id) {
				dashboard.addProfileFromTemplate(profile);
				open = false;
				goto(`/dashboard/${profile.id}`);
			}
		} catch (err) {
			console.error('Failed to create dashboard from template:', err);
		} finally {
			adding = null;
		}
	}

	async function handleAddBlank() {
		if (adding) return;
		adding = '__blank__';
		try {
			const profile = await dashboard.createProfile({
				name: 'New Dashboard',
				profileType: 'custom',
				profileIcon: 'LayoutDashboard',
				profileColor: 'oklch(0.7 0.15 250)'
			});
			if (profile?.id) {
				open = false;
				goto(`/dashboard/${profile.id}`);
			}
		} catch (err) {
			console.error('Failed to create blank dashboard:', err);
		} finally {
			adding = null;
		}
	}

	function handlePin(id: string) {
		dashboard.pinDashboard(id);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="max-w-lg gap-0 overflow-hidden border-border/40 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:rounded-2xl"
	>
		<!-- Header -->
		<div class="flex flex-col gap-3 border-b border-border/40 p-5">
			<Dialog.Header>
				<Dialog.Title class="text-lg font-semibold tracking-tight">Add Dashboard</Dialog.Title>
				<Dialog.Description class="text-sm text-muted-foreground">
					Create a new dashboard or pin an existing one.
				</Dialog.Description>
			</Dialog.Header>
			<div class="relative">
				<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search..."
					class="h-9 border-border/40 bg-muted/30 pl-9 text-sm transition-all focus:bg-background focus:ring-1 focus:ring-primary/20"
					bind:value={searchQuery}
				/>
			</div>
		</div>

		<!-- Scrollable Content -->
		<div class="max-h-[50vh] overflow-y-auto p-4">
			{#if templatesQuery.loading}
				<div class="flex h-32 items-center justify-center">
					<Loader2 class="size-5 animate-spin text-muted-foreground" />
				</div>
			{:else}
				<!-- Unpinned dashboards — re-pin section -->
				{#if unpinnedDashboards.length > 0}
					<div class="mb-4">
						<h3
							class="mb-2 text-[11px] font-bold tracking-widest text-muted-foreground/60 uppercase"
						>
							Your Dashboards
						</h3>
						<div class="space-y-1">
							{#each unpinnedDashboards as profile (profile.id)}
								<div
									class="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
								>
									<LayoutDashboard class="size-4 shrink-0 text-muted-foreground" />
									<span class="flex-1 truncate text-sm">{profile.profile_name}</span>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => handlePin(profile.id)}
										class="h-7 gap-1 rounded-full px-2.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
									>
										<Pin class="size-3" />
										Pin
									</Button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Create new -->
				<div class="mb-4">
					<h3 class="mb-2 text-[11px] font-bold tracking-widest text-muted-foreground/60 uppercase">
						Create New
					</h3>
					<div class="space-y-1">
						<!-- Blank dashboard -->
						{#if showCustomOption}
							<button
								type="button"
								disabled={!!adding}
								onclick={() => handleAddBlank()}
								class="flex w-full items-center gap-3 rounded-lg border border-dashed border-border/50 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
							>
								{#if adding === '__blank__'}
									<Loader2 class="size-4 shrink-0 animate-spin text-primary/60" />
								{:else}
									<div class="flex size-8 items-center justify-center rounded-md bg-muted/50">
										<Plus class="size-4 text-muted-foreground" />
									</div>
								{/if}
								<div class="flex-1">
									<p class="text-sm font-medium">Custom Dashboard</p>
									<p class="text-xs text-muted-foreground">Blank slate — add widgets later</p>
								</div>
							</button>
						{/if}

						<!-- Templates -->
						{#each grouped as [category, items] (category)}
							{#each items as template (template.id)}
								{@const isAdding = adding === template.id}
								<button
									type="button"
									disabled={!!adding}
									onclick={() => handleAdd(template)}
									class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
								>
									{#if isAdding}
										<Loader2 class="size-4 shrink-0 animate-spin text-primary/60" />
									{:else}
										<div class="flex size-8 items-center justify-center rounded-md bg-muted/40">
											<LayoutDashboard class="size-4 text-muted-foreground" />
										</div>
									{/if}
									<div class="flex-1">
										<p class="text-sm font-medium">{template.name}</p>
										<p class="line-clamp-1 text-xs text-muted-foreground">
											{template.description}
										</p>
									</div>
									<span
										class="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground"
									>
										{category}
									</span>
								</button>
							{/each}
						{/each}
					</div>
				</div>

				{#if grouped.length === 0 && !showCustomOption && unpinnedDashboards.length === 0}
					<div
						class="flex h-24 flex-col items-center justify-center gap-1 text-center text-muted-foreground"
					>
						<Search class="size-5 opacity-40" />
						<p class="text-sm">No results for "{searchQuery}"</p>
					</div>
				{/if}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
