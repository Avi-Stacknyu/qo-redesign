<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import * as Sheet from '$lib/components/shadcn/sheet/index.js';
	import * as Collapsible from '$lib/components/shadcn/collapsible/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { Loader2, ChevronDown, AlertTriangle } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';

	import type { TagRule } from '@repo/shared/types';
	import {
		getNamespaceColor,
		describeTagRule,
		getFullTagString,
		type TagCatalogWithNamespace
	} from '$lib/utils/tag-helpers';
	import TagRuleEditor from '$lib/components/tag-rule-editor.svelte';

	type PreviewItem = { id: string; name: string | null; tags: string[] };
	type PresetItem = { id: string; name: string | null; tagRule: unknown };

	let {
		open = $bindable(false),
		selectedCount,
		selectedIds,
		entityLabel = 'item',
		catalog,
		presets = [],
		loadPreviews,
		onApply,
		onSavePreset
	}: {
		open: boolean;
		selectedCount: number;
		selectedIds: string[];
		entityLabel?: string;
		catalog: TagCatalogWithNamespace[];
		presets?: PresetItem[];
		loadPreviews: (ids: string[]) => Promise<PreviewItem[]>;
		onApply: (ids: string[], tagRule: TagRule, mode: 'replace' | 'append') => Promise<void>;
		onSavePreset?: (name: string, tagRule: TagRule) => Promise<void>;
	} = $props();

	let tagRule = $state<TagRule>({ groups: [] });
	let mode = $state<'replace' | 'append'>('replace');
	let isSaving = $state(false);
	let showConfirm = $state(false);
	let previewOpen = $state(false);
	let previews = $state<PreviewItem[]>([]);
	let isLoadingPreview = $state(false);

	$effect(() => {
		if (!open) {
			tagRule = { groups: [] };
			mode = 'replace';
			showConfirm = false;
			previews = [];
			return;
		}
		if (selectedIds.length > 0) {
			untrack(() => fetchPreviews());
		}
	});

	async function fetchPreviews() {
		isLoadingPreview = true;
		try {
			previews = await loadPreviews(selectedIds);
		} catch {
			previews = [];
		} finally {
			isLoadingPreview = false;
		}
	}

	let hasGroups = $derived(tagRule.groups.some((g) => g.tags.length > 0));

	function requestApply() {
		if (!hasGroups) {
			toast.error('Add at least one tag group');
			return;
		}
		showConfirm = true;
	}

	async function confirmApply() {
		isSaving = true;
		try {
			await onApply(selectedIds, tagRule, mode);
			toast.success(
				`Tag rule ${mode === 'append' ? 'appended to' : 'set on'} ${selectedCount} ${entityLabel}(s)`
			);
			tagRule = { groups: [] };
			showConfirm = false;
			open = false;
			await invalidateAll();
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Failed to update tags');
		} finally {
			isSaving = false;
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content class="admin-sheet-panel flex flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
		<Sheet.Header class="p-6">
			<Sheet.Title>Bulk Set Tag Rule</Sheet.Title>
			<Sheet.Description>{selectedCount} {entityLabel}(s) selected</Sheet.Description>
		</Sheet.Header>

		<div class="admin-form-stack flex-1 overflow-y-auto p-6 pt-0">
			<!-- Preview -->
			<Collapsible.Root bind:open={previewOpen}>
				<Collapsible.Trigger
					class="flex w-full items-center justify-between rounded-lg border p-3 text-sm font-medium hover:bg-muted/50"
				>
					Selected {entityLabel}s ({selectedCount})
					<ChevronDown class="h-4 w-4 transition-transform {previewOpen ? 'rotate-180' : ''}" />
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
						{#if isLoadingPreview}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 class="h-3 w-3 animate-spin" />
								Loading…
							</div>
						{:else}
							{#each previews as item}
								<div class="flex flex-col gap-1 border-b pb-2 last:border-0 last:pb-0">
									<p class="text-sm font-medium">{item.name}</p>
									{#if item.tags.length > 0}
										<div class="flex flex-wrap gap-1">
											{#each item.tags as tag}
												{@const entry = catalog.find(
													(c) => getFullTagString(c) === tag || c.tag === tag
												)}
												{@const nsName = entry
													? (entry.expand?.namespace?.name ?? '')
													: (tag.split(':')[0] ?? '')}
												<Badge
													variant="outline"
													class="{getNamespaceColor(nsName)} px-1.5 py-0 text-[10px]"
												>
													{tag}
												</Badge>
											{/each}
										</div>
									{:else}
										<p class="text-xs text-muted-foreground">No tags</p>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</Collapsible.Content>
			</Collapsible.Root>

			<!-- Mode selector -->
			<div class="space-y-2">
				<Label class="text-sm font-medium">Mode</Label>
				<div class="flex gap-2">
					<Button
						size="sm"
						variant={mode === 'replace' ? 'default' : 'outline'}
						onclick={() => (mode = 'replace')}
					>
						Replace
					</Button>
					<Button
						size="sm"
						variant={mode === 'append' ? 'default' : 'outline'}
						onclick={() => (mode = 'append')}
					>
						Append
					</Button>
				</div>
			</div>

			<!-- Info Box -->
			<div
				class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground"
			>
				<p class="mb-1.5 text-sm font-medium text-blue-600">How bulk tag rules work</p>
				{#if mode === 'replace'}
					<p>
						Build a tag rule with OR/AND groups below. This rule will <strong>replace</strong> the
						existing tag rule on all selected {entityLabel}s.
					</p>
				{:else}
					<p>
						Build a tag rule with OR/AND groups below. These groups will be <strong>appended</strong
						>
						to the existing tag rule on each selected {entityLabel}. Existing groups are preserved.
					</p>
				{/if}
			</div>

			<!-- TagRule Editor -->
			<TagRuleEditor
				rule={tagRule}
				{catalog}
				onchange={(r) => (tagRule = r)}
				{presets}
				onloadpreset={(p) => (tagRule = (p.tagRule as TagRule) ?? { groups: [] })}
				onsavepreset={onSavePreset
					? async (name) => {
							try {
								await onSavePreset!(name, tagRule);
								toast.success(`Preset "${name}" saved`);
								await invalidateAll();
							} catch {
								toast.error('Failed to save preset');
							}
						}
					: undefined}
			/>

			<!-- Confirmation -->
			{#if showConfirm}
				<div class="space-y-3 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-4">
					<p class="text-sm font-semibold">Confirm Action</p>
					<p class="text-sm text-muted-foreground">
						{mode === 'append' ? 'Append tag groups to' : 'Set tag rule on'}
						<strong>{selectedCount}</strong>
						{entityLabel}(s)?
					</p>
					<div class="rounded-md bg-muted/50 p-2 text-xs">
						{describeTagRule(tagRule, false)}
					</div>
					{#if mode === 'replace'}
						<div
							class="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive"
						>
							<AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
							This will replace the existing tag rule on each selected {entityLabel}.
						</div>
					{/if}
					<div class="flex gap-2">
						<Button size="sm" onclick={confirmApply} disabled={isSaving}>
							{#if isSaving}
								<Loader2 class="mr-2 h-3 w-3 animate-spin" />
							{/if}
							{isSaving ? 'Applying…' : 'Confirm'}
						</Button>
						<Button
							size="sm"
							variant="outline"
							onclick={() => (showConfirm = false)}
							disabled={isSaving}
						>
							Cancel
						</Button>
					</div>
				</div>
			{/if}
		</div>

		{#if !showConfirm}
			<div class="border-t p-6">
				<Button onclick={requestApply} disabled={isSaving || !hasGroups} class="w-full">
					{mode === 'append' ? 'Append Tag Groups' : 'Set Tag Rule'}
				</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
