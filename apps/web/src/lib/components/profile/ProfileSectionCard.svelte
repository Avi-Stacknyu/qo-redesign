<script lang="ts">
	import {
		Home,
		Target,
		TrendingUp,
		Landmark,
		Receipt,
		Sunset,
		Shield,
		Scroll,
		Sliders,
		User,
		MapPin,
		DollarSign,
		Scale,
		Clock,
		MoreHorizontal,
		Pencil,
		Trash2,
		Check,
		X,
		Loader2,
		ChevronDown,
		Brain,
		Settings
	} from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog/index.js';
	import { toast } from 'svelte-sonner';
	import { applyProfileFieldValue } from '$lib/data/profile-ui';
	import {
		updateProfileField,
		deleteProfileField,
		loadStructuredProfile
	} from '$lib/remote/profile-data.remote';
	import type { ProfileSection, ProfileField } from '$lib/data/profile-types';

	let { section }: { section: ProfileSection } = $props();

	const iconMap: Record<string, typeof Home> = {
		home: Home,
		target: Target,
		'trending-up': TrendingUp,
		landmark: Landmark,
		receipt: Receipt,
		sunset: Sunset,
		shield: Shield,
		scroll: Scroll,
		sliders: Sliders,
		user: User,
		users: User,
		'map-pin': MapPin,
		'dollar-sign': DollarSign,
		scale: Scale,
		clock: Clock,
		brain: Brain,
		settings: Settings,
		wallet: DollarSign,
		'bar-chart-3': TrendingUp,
		briefcase: Target,
		heart: Target,
		globe: Landmark,
		'book-open': Scroll,
		'graduation-cap': Scroll,
		calendar: Clock,
		'piggy-bank': DollarSign,
		'credit-card': DollarSign,
		activity: TrendingUp,
		layers: Sliders,
		'message-square': MoreHorizontal,
		zap: TrendingUp,
		flag: Target,
		star: Target
	};

	let expanded = $state(false);
	let editingKey = $state<string | null>(null);
	let editValue = $state('');
	let deleteTarget = $state<ProfileField | null>(null);
	let deleteDialogOpen = $state(false);
	let isDeleting = $state(false);
	let isSaving = $state(false);
	const profileQuery = loadStructuredProfile();

	let IconComponent = $derived(iconMap[section.icon] ?? MoreHorizontal);
	let allFields = $derived([
		...section.fields.filter((f) => f.isSchema),
		...section.fields.filter((f) => !f.isSchema)
	]);
	let filledCount = $derived(allFields.filter((f) => f.value.trim()).length);
	let totalCount = $derived(allFields.length);
	let completionPct = $derived(totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 100);
	let barColor = $derived(
		completionPct >= 70 ? 'bg-emerald-500' : completionPct >= 30 ? 'bg-amber-500' : 'bg-red-400'
	);
	let ringColor = $derived(
		completionPct >= 70
			? 'text-emerald-500'
			: completionPct >= 30
				? 'text-amber-500'
				: 'text-red-400'
	);

	function startEdit(field: ProfileField) {
		editingKey = field.key;
		editValue = field.value;
	}

	function cancelEdit() {
		editingKey = null;
		editValue = '';
	}

	async function saveEdit() {
		if (editingKey === null || isSaving) return;
		isSaving = true;
		try {
			const key = editingKey;
			const value = editValue.trim();
			const updatedAt = new Date().toISOString();
			await updateProfileField({ sectionId: section.sectionId, fieldKey: key, value }).updates(
				profileQuery.withOverride((profile) =>
					applyProfileFieldValue(profile, {
						sectionId: section.sectionId,
						fieldKey: key,
						value,
						updatedAt
					})
				)
			);
			cancelEdit();
			toast.success('Field updated');
		} catch {
			toast.error('Failed to update field');
		} finally {
			isSaving = false;
		}
	}

	function promptDelete(field: ProfileField) {
		deleteTarget = field;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		isDeleting = true;
		try {
			const key = deleteTarget.key;
			deleteDialogOpen = false;
			deleteTarget = null;
			await deleteProfileField({ sectionId: section.sectionId, fieldKey: key }).updates(
				loadStructuredProfile()
			);
			toast.success('Field deleted');
		} catch {
			toast.error('Failed to delete field');
		} finally {
			isDeleting = false;
		}
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') saveEdit();
		if (e.key === 'Escape') cancelEdit();
	}

	function toggleExpand() {
		if (editingKey) return;
		expanded = !expanded;
	}
</script>

{#snippet fieldRow(field: ProfileField)}
	{#if editingKey === field.key}
		<div class="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
			<span class="w-[30%] shrink-0 text-xs text-muted-foreground">{field.label}</span>
			<Input
				bind:value={editValue}
				class="h-7 flex-1 border-border/40 bg-background text-xs"
				disabled={isSaving}
				onkeydown={handleEditKeydown}
			/>
			<button
				class="rounded p-1 text-muted-foreground hover:text-foreground"
				onclick={cancelEdit}
				disabled={isSaving}
			>
				<X class="size-3.5" />
			</button>
			<button
				class="rounded p-1 text-primary hover:text-primary/80"
				onclick={saveEdit}
				disabled={isSaving}
			>
				{#if isSaving}
					<Loader2 class="size-3.5 animate-spin" />
				{:else}
					<Check class="size-3.5" />
				{/if}
			</button>
		</div>
	{:else}
		<div
			class="group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-muted/30"
			role="button"
			tabindex="0"
			onclick={() => startEdit(field)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') startEdit(field);
			}}
		>
			<span class="w-[30%] shrink-0 truncate text-xs text-muted-foreground">{field.label}</span>
			{#if field.value.trim()}
				<span class="min-w-0 flex-1 truncate text-xs text-foreground">{field.value}</span>
			{:else}
				<span class="min-w-0 flex-1 text-xs text-muted-foreground/40 italic">—</span>
			{/if}
			<div
				class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
			>
				<Pencil class="size-3 text-muted-foreground" />
				{#if field.value.trim()}
					<button
						class="rounded p-0.5 text-muted-foreground hover:text-destructive"
						onclick={(e) => {
							e.stopPropagation();
							promptDelete(field);
						}}
						title="Delete"
					>
						<Trash2 class="size-3" />
					</button>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

<!-- Card -->
<div>
	<button
		class={cn(
			'group relative w-full overflow-hidden text-left transition-all duration-200',
			expanded
				? 'rounded-t-2xl border border-b-0 border-primary/25 bg-card/70 shadow-sm'
				: 'rounded-2xl border border-border/25 bg-card/40 hover:border-border/40 hover:bg-card/60'
		)}
		onclick={toggleExpand}
	>
		<div class="flex items-center gap-4 p-4 sm:p-5">
			<!-- Circular progress indicator -->
			<div class="relative flex size-14 shrink-0 items-center justify-center sm:size-16">
				<svg class="size-full -rotate-90" viewBox="0 0 36 36">
					<circle
						cx="18"
						cy="18"
						r="15.5"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						class="text-muted/30"
					/>
					<circle
						cx="18"
						cy="18"
						r="15.5"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-dasharray="97.4"
						stroke-dashoffset={97.4 - (97.4 * completionPct) / 100}
						stroke-linecap="round"
						class={ringColor}
					/>
				</svg>
				<div class="absolute inset-0 flex items-center justify-center">
					<IconComponent class="size-4 text-foreground/70 sm:size-5" />
				</div>
			</div>

			<!-- Info -->
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<h3 class="truncate text-sm font-semibold text-foreground sm:text-base">
						{section.label}
					</h3>
					{#if completionPct === 100}
						<Check class="size-3.5 shrink-0 text-emerald-500" />
					{/if}
				</div>
				<div class="mt-1 flex items-center gap-3">
					<span class={cn('text-lg font-bold tabular-nums sm:text-xl', ringColor)}>
						{completionPct}%
					</span>
				</div>
				<div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/30">
					<div
						class={cn('h-full rounded-full transition-all duration-500', barColor)}
						style="width: {completionPct}%"
					></div>
				</div>
			</div>

			<ChevronDown
				class={cn(
					'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
					expanded && 'rotate-180'
				)}
			/>
		</div>
	</button>

	<!-- Expanded field list -->
	{#if expanded}
		<div
			class="rounded-b-2xl border border-t-0 border-primary/25 bg-card/70 px-2 pb-2 sm:px-3 sm:pb-3"
		>
			{#if allFields.length === 0}
				<p class="py-6 text-center text-xs text-muted-foreground/50">No fields yet</p>
			{:else}
				<div class="space-y-0.5">
					{#each allFields as field (field.key)}
						{@render fieldRow(field)}
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Field?</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete "{deleteTarget?.label ?? ''}"? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)} disabled={isDeleting}>
				Cancel
			</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={isDeleting}>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
