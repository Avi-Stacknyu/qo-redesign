<script lang="ts">
	import { ChevronsUpDown, Check, Plus, Pencil, Trash2, Copy, Moon, Sun } from '@lucide/svelte';
	import { dashboard } from '$lib/state/dashboard.svelte';
	import { THEME_PRESETS } from '$lib/theme-presets';
	import { THEME_PRESET_LIST, type ThemeMode } from '$lib/types/theme';
	import type { UserProfileRecord } from '$lib/types/widgets';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import * as Dialog from '$lib/components/shadcn/dialog/index.js';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { cn } from '$lib/utils';
	import { useSidebar } from '$lib/components/shadcn/sidebar/index.js';

	const sidebar = useSidebar();

	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	let createDialogOpen = $state(false);
	let newProfileName = $state('');
	let newPreset = $state('orion');
	let newMode = $state<ThemeMode>('dark');
	let creating = $state(false);

	function getSwatchColors(presetId: string, mode: ThemeMode) {
		const preset = THEME_PRESETS[presetId];
		if (!preset) return { primary: 'oklch(0.5 0.1 250)', bg: 'oklch(0.2 0 0)' };
		return { primary: preset[mode].primary, bg: preset[mode].background };
	}

	function handleSwitch(profile: UserProfileRecord) {
		dashboard.switchProfile(profile.id);
	}

	function startRename(profile: UserProfileRecord) {
		renamingId = profile.id;
		renameValue = profile.profile_name;
	}

	function commitRename() {
		if (!renamingId || !renameValue.trim()) {
			renamingId = null;
			return;
		}
		dashboard.renameProfile(renamingId, renameValue.trim());
		renamingId = null;
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') commitRename();
		if (e.key === 'Escape') renamingId = null;
	}

	async function handleCreate() {
		if (!newProfileName.trim() || creating) return;
		creating = true;

		await dashboard.createProfile({
			name: newProfileName.trim(),
			profileType: 'personal',
			profileIcon: 'User',
			profileColor: 'oklch(0.7 0.15 250)',
			sourceProfileId: dashboard.activeProfileId ?? undefined
		});

		createDialogOpen = false;
		newProfileName = '';
		newPreset = 'orion';
		newMode = 'dark';
		creating = false;
	}

	function handleDelete(profileId: string) {
		dashboard.deleteProfile(profileId);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Sidebar.MenuButton
				{...props}
				size="lg"
				class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
			>
				{@const colors = getSwatchColors(
					dashboard.activeProfile?.theme_preset ?? 'orion',
					(dashboard.activeProfile?.theme_mode as ThemeMode) ?? 'dark'
				)}
				<div class="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
					<div
						class="size-6 rounded-full border border-sidebar-border/40 shadow-sm"
						style="background: conic-gradient(from 180deg, {colors.primary} 0deg, {colors.bg} 180deg, {colors.primary} 360deg);"
					></div>
				</div>
				<div
					class="grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden"
				>
					<span class="truncate font-medium">
						{dashboard.activeProfile?.profile_name ?? 'No Profile'}
					</span>
					<span class="truncate text-xs text-sidebar-foreground/60">
						{THEME_PRESET_LIST.find((p) => p.id === dashboard.activeProfile?.theme_preset)?.label ??
							'Default'}
					</span>
				</div>
				<ChevronsUpDown class="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
			</Sidebar.MenuButton>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content
		class="w-(--bits-dropdown-menu-anchor-width) min-w-64 rounded-xl border-border/60 bg-card/95 p-1 shadow-xl backdrop-blur"
		align="start"
		side={sidebar.isMobile ? 'bottom' : 'right'}
		sideOffset={4}
	>
		<DropdownMenu.Label class="px-2 py-1.5 text-xs text-muted-foreground">
			Profiles
		</DropdownMenu.Label>

		{#each dashboard.profiles as profile (profile.id)}
			{@const colors = getSwatchColors(profile.theme_preset, profile.theme_mode as ThemeMode)}
			{@const isActive = profile.id === dashboard.activeProfileId}
			<DropdownMenu.Item
				onSelect={() => {
					if (renamingId !== profile.id) handleSwitch(profile);
				}}
				class="group/item gap-2.5 rounded-lg p-2"
				disabled={false}
			>
				<!-- Swatch Circle -->
				<div
					class={cn(
						'flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-all',
						isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border/40'
					)}
				>
					<div
						class="size-full rounded-full"
						style="background: conic-gradient(from 180deg, {colors.primary} 0deg, {colors.bg} 180deg, {colors.primary} 360deg);"
					></div>
				</div>

				<!-- Name or Rename Input -->
				<div class="flex min-w-0 flex-1 flex-col">
					{#if renamingId === profile.id}
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							bind:value={renameValue}
							onblur={commitRename}
							onkeydown={handleRenameKeydown}
							autofocus
							class="h-6 w-full rounded border border-input bg-background px-1.5 text-sm ring-ring outline-none focus-visible:ring-1"
							onclick={(e) => e.stopPropagation()}
						/>
					{:else}
						<span class="truncate text-sm font-medium">{profile.profile_name}</span>
						<span class="truncate text-[11px] text-muted-foreground">
							{THEME_PRESET_LIST.find((p) => p.id === profile.theme_preset)?.label ??
								profile.theme_preset}
							· {profile.theme_mode}
						</span>
					{/if}
				</div>

				{#if isActive}
					<Check class="size-4 shrink-0 text-primary" />
				{/if}

				<!-- Inline actions (visible on hover) -->
				{#if renamingId !== profile.id}
					<div
						class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100"
					>
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								startRename(profile);
							}}
							class="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							title="Rename"
						>
							<Pencil class="size-3" />
						</button>
						{#if dashboard.profiles.length > 1}
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									handleDelete(profile.id);
								}}
								class="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
								title="Delete"
								disabled={false}
							>
								<Trash2 class="size-3" />
							</button>
						{/if}
					</div>
				{/if}
			</DropdownMenu.Item>
		{/each}

		<DropdownMenu.Separator />

		<DropdownMenu.Item
			onSelect={() => {
				createDialogOpen = true;
			}}
			class="gap-2 rounded-lg p-2"
		>
			<div
				class="flex size-7 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40"
			>
				<Plus class="size-3.5 text-muted-foreground" />
			</div>
			<span class="text-sm font-medium text-muted-foreground">New Profile</span>
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<!-- Create Profile Dialog -->
<Dialog.Root bind:open={createDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create Profile</Dialog.Title>
			<Dialog.Description>
				Copies your current widgets, layout, and settings. Pick a theme to start.
			</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-2">
			<div class="grid gap-2">
				<label for="profile-name" class="text-sm font-medium">Profile Name</label>
				<Input
					id="profile-name"
					bind:value={newProfileName}
					placeholder="Work, Personal, Trading..."
				/>
			</div>

			<!-- Theme Picker -->
			<div class="grid gap-2">
				<span class="text-sm font-medium">Theme</span>
				<div class="grid grid-cols-7 gap-1.5">
					{#each THEME_PRESET_LIST as preset (preset.id)}
						{@const presetData = THEME_PRESETS[preset.id]}
						{#if presetData}
							<button
								type="button"
								onclick={() => {
									newPreset = preset.id;
								}}
								class={cn(
									'relative flex aspect-square items-center justify-center rounded-full border-2 transition-all hover:scale-110',
									newPreset === preset.id
										? 'border-primary ring-2 ring-primary/20 ring-offset-1 ring-offset-background'
										: 'border-transparent hover:border-border'
								)}
								title={preset.label}
							>
								<div
									class="size-full rounded-full border border-border/20 shadow-sm"
									style="background-color: {presetData[newMode].primary}"
								></div>
								{#if newPreset === preset.id}
									<div class="absolute inset-0 flex items-center justify-center">
										<Check class="size-2.5 text-primary-foreground drop-shadow-md" />
									</div>
								{/if}
							</button>
						{/if}
					{/each}
				</div>
			</div>

			<!-- Mode Toggle -->
			<div class="flex items-center gap-3">
				<span class="text-sm font-medium">Mode</span>
				<div class="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-0.5">
					<button
						type="button"
						onclick={() => {
							newMode = 'light';
						}}
						class={cn(
							'inline-flex size-7 items-center justify-center rounded-full transition-all',
							newMode === 'light'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<Sun class="size-3.5" />
					</button>
					<button
						type="button"
						onclick={() => {
							newMode = 'dark';
						}}
						class={cn(
							'inline-flex size-7 items-center justify-center rounded-full transition-all',
							newMode === 'dark'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<Moon class="size-3.5" />
					</button>
				</div>
			</div>
		</div>
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => {
					createDialogOpen = false;
				}}>Cancel</Button
			>
			<Button onclick={handleCreate} disabled={!newProfileName.trim() || creating}>
				{#if creating}
					Creating...
				{:else}
					<Copy class="mr-2 size-4" />
					Create Profile
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
