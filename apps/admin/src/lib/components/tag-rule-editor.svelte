<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import { Plus, Trash2, X, Tag, Bookmark, Save } from '@lucide/svelte';
	import type { TagRule, TagGroup } from '@repo/shared/types';
	type PresetItem = {
		id: string;
		name: string | null;
		description?: string | null;
		tagRule: unknown;
	};
	import {
		getNamespaceColor,
		describeTagRule,
		getTagNamespaceName,
		getFullTagString,
		type TagCatalogWithNamespace
	} from '$lib/utils/tag-helpers';

	let {
		rule = { groups: [] },
		catalog,
		onchange,
		disabled = false,
		presets = [],
		onloadpreset,
		onsavepreset
	}: {
		rule: TagRule;
		catalog: TagCatalogWithNamespace[];
		onchange: (rule: TagRule) => void;
		disabled?: boolean;
		presets?: PresetItem[];
		onloadpreset?: (preset: PresetItem) => void;
		onsavepreset?: (name: string) => void;
	} = $props();

	let groups = $state<TagGroup[]>([]);
	let showSavePreset = $state(false);
	let presetName = $state('');

	// Track the last rule identity we synced from, to avoid loops
	let lastRuleRef: TagRule | null = null;

	$effect(() => {
		// Only re-sync groups from the prop when the rule reference actually changes externally
		if (rule !== lastRuleRef) {
			lastRuleRef = rule;
			groups = (rule.groups ?? []).map((g) => ({ tags: [...g.tags] }));
		}
	});

	let preview = $derived(describeTagRule({ groups }, false));
	let hasPresets = $derived(presets.length > 0);
	let hasGroups = $derived(groups.some((g) => g.tags.length > 0));

	function emit() {
		onchange({ groups: groups.map((g) => ({ tags: [...g.tags] })) });
	}

	function addGroup() {
		groups = [...groups, { tags: [] }];
		emit();
	}

	function removeGroup(idx: number) {
		groups = groups.filter((_, i) => i !== idx);
		emit();
	}

	function addTagToGroup(groupIdx: number, tag: string) {
		const g = groups[groupIdx];
		if (g.tags.includes(tag)) return;
		groups[groupIdx] = { tags: [...g.tags, tag] };
		groups = [...groups];
		emit();
	}

	function removeTagFromGroup(groupIdx: number, tag: string) {
		groups[groupIdx] = { tags: groups[groupIdx].tags.filter((t) => t !== tag) };
		groups = [...groups];
		emit();
	}

	function availableTagsForGroup(groupIdx: number): TagCatalogWithNamespace[] {
		const used = new Set(groups[groupIdx]?.tags ?? []);
		return catalog.filter((t) => !used.has(getFullTagString(t)));
	}

	function handleSavePreset() {
		const trimmed = presetName.trim();
		if (!trimmed) return;
		onsavepreset?.(trimmed);
		presetName = '';
		showSavePreset = false;
	}
</script>

<div class="space-y-4" class:opacity-50={disabled} class:pointer-events-none={disabled}>
	<!-- Preset controls -->
	{#if hasPresets || onsavepreset}
		<div class="flex items-center gap-2">
			{#if hasPresets}
				<Select.Root
					type="single"
					onValueChange={(id) => {
						const p = presets.find((pr) => pr.id === id);
						if (p) onloadpreset?.(p);
					}}
				>
					<Select.Trigger class="h-8 w-48 text-xs">
						<Bookmark class="mr-1 h-3 w-3" />
						Load preset…
					</Select.Trigger>
					<Select.Content>
						{#each presets as preset}
							<Select.Item value={preset.id}>
								<span class="font-medium">{preset.name}</span>
								{#if preset.description}
									<span class="ml-2 text-xs text-muted-foreground">{preset.description}</span>
								{/if}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
			{#if onsavepreset && hasGroups}
				{#if showSavePreset}
					<div class="flex items-center gap-1.5">
						<Input
							class="h-8 w-36 text-xs"
							placeholder="Preset name…"
							bind:value={presetName}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleSavePreset();
								}
							}}
						/>
						<Button
							variant="outline"
							size="sm"
							type="button"
							class="h-8"
							onclick={handleSavePreset}
							disabled={!presetName.trim()}
						>
							<Save class="mr-1 h-3 w-3" />
							Save
						</Button>
						<Button
							variant="ghost"
							size="sm"
							type="button"
							class="h-8"
							onclick={() => (showSavePreset = false)}
						>
							<X class="h-3 w-3" />
						</Button>
					</div>
				{:else}
					<Button
						variant="ghost"
						size="sm"
						type="button"
						class="h-8 text-xs"
						onclick={() => (showSavePreset = true)}
					>
						<Save class="mr-1 h-3 w-3" />
						Save as preset
					</Button>
				{/if}
			{/if}
		</div>
	{/if}

	{#if groups.length === 0}
		<div class="rounded-lg border border-dashed p-6 text-center">
			<Tag class="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
			<p class="text-sm text-muted-foreground">
				No tag restrictions. Add a group to control visibility.
			</p>
		</div>
	{:else}
		{#each groups as group, groupIdx}
			{#if groupIdx > 0}
				<div class="flex items-center gap-3">
					<div class="h-px flex-1 bg-border"></div>
					<span
						class="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-600"
					>
						OR
					</span>
					<div class="h-px flex-1 bg-border"></div>
				</div>
			{/if}

			<div class="rounded-lg border bg-card p-4">
				<div class="mb-3 flex items-center justify-between">
					<p class="text-xs font-medium text-muted-foreground">
						Group {groupIdx + 1}
						{#if group.tags.length > 1}
							<span class="ml-1 text-muted-foreground/60">— user needs ALL tags</span>
						{/if}
					</p>
					<div class="flex items-center gap-2">
						<Select.Root
							type="single"
							onValueChange={(v) => {
								if (v) addTagToGroup(groupIdx, v);
							}}
						>
							<Select.Trigger class="h-8 w-36 text-xs">
								<Plus class="mr-1 h-3 w-3" />
								Add tag
							</Select.Trigger>
							<Select.Content>
								{@const available = availableTagsForGroup(groupIdx)}
								{#each available as tag}
									{@const nsName = getTagNamespaceName(tag)}
									<Select.Item value="{nsName}:{tag.tag}">
										<span class="mr-2 text-xs text-muted-foreground">{nsName}:</span>
										{tag.tag}
									</Select.Item>
								{/each}
								{#if available.length === 0}
									<div class="px-2 py-1.5 text-sm text-muted-foreground">All tags used</div>
								{/if}
							</Select.Content>
						</Select.Root>
						<Button
							variant="ghost"
							size="icon"
							type="button"
							class="h-7 w-7 text-muted-foreground hover:text-destructive"
							onclick={() => removeGroup(groupIdx)}
						>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>

				{#if group.tags.length === 0}
					<p class="text-xs text-muted-foreground italic">Empty group — add tags above</p>
				{:else}
					<div class="flex flex-wrap items-center gap-2">
						{#each group.tags as tag, tagIdx}
							{#if tagIdx > 0}
								<span class="text-[10px] font-semibold text-muted-foreground">AND</span>
							{/if}
							{@const entry = catalog.find((c) => getFullTagString(c) === tag)}
							{@const nsName = entry ? getTagNamespaceName(entry) : (tag.split(':')[0] ?? '')}
							<Badge variant="outline" class="{getNamespaceColor(nsName)} gap-1 pr-1">
								{tag}
								<button
									type="button"
									class="ml-1 rounded-sm p-0.5 hover:bg-foreground/10"
									onclick={() => removeTagFromGroup(groupIdx, tag)}
								>
									<X class="h-3 w-3" />
								</button>
							</Badge>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	{/if}

	<Button variant="outline" size="sm" type="button" onclick={addGroup} {disabled}>
		<Plus class="mr-2 h-4 w-4" />
		Add Group
	</Button>

	{#if groups.length > 0}
		<div class="rounded-lg bg-muted/50 p-3">
			<p class="text-xs font-medium text-muted-foreground">Preview</p>
			<p class="text-sm">{preview}</p>
		</div>
	{/if}
</div>
