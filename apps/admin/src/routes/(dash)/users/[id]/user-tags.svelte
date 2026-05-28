<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import { X, Tag, Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import {
		getNamespaceColor,
		getFullTagString,
		getTagNamespaceName,
		type TagCatalogWithNamespace
	} from '$lib/utils/tag-helpers';

	import { getUserTags, getTagCatalogForUser, updateUserTagsAction } from './user-details.remote';

	let { userId }: { userId: string } = $props();

	const tagsQuery = getUserTags();
	const catalogQuery = getTagCatalogForUser();
	const tagsData = $derived(tagsQuery.current);
	const catalogData = $derived(catalogQuery.current);

	let catalog = $derived<TagCatalogWithNamespace[]>(catalogData ?? []);
	let tags = $state<string[]>([]);
	let recordId = $state<string | null>(null);
	let isSaving = $state(false);
	let dirty = $state(false);

	$effect(() => {
		tags = [...(tagsData?.tags ?? [])];
		recordId = tagsData?.recordId ?? null;
		dirty = false;
	});

	let availableTags = $derived(catalog.filter((c) => !tags.includes(getFullTagString(c))));

	function addTag(tag: string) {
		if (!tags.includes(tag)) {
			tags = [...tags, tag];
			dirty = true;
		}
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
		dirty = true;
	}

	async function save() {
		isSaving = true;
		try {
			await updateUserTagsAction({ userId, tags, recordId });
			toast.success('User tags updated');
			dirty = false;
			await invalidateAll();
		} catch (e) {
			toast.error((e as Error).message || 'Failed to update tags');
		} finally {
			isSaving = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="pb-3">
		<Card.Title class="flex items-center gap-2 text-sm font-medium">
			<Tag class="h-4 w-4" />
			User Tags
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<!-- Info Box -->
		<div
			class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground"
		>
			<p class="mb-1 text-sm font-medium text-blue-600">About user tags</p>
			<p class="mb-1">
				Tags here are <strong>admin-assigned</strong> — they combine with plan tags and onboarding-detected
				tags to form the user's full tag set.
			</p>
			<p>
				Use <code class="rounded bg-muted px-1">segment:vip</code> or
				<code class="rounded bg-muted px-1">segment:beta</code> for special access. Geo and role tags
				are typically auto-assigned during onboarding.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<Select.Root
				type="single"
				onValueChange={(v) => {
					if (v) addTag(v);
				}}
			>
				<Select.Trigger class="w-48">
					<Tag class="mr-2 h-3.5 w-3.5" />
					Add tag…
				</Select.Trigger>
				<Select.Content>
					{#each availableTags as tag}
						{@const nsName = getTagNamespaceName(tag)}
						<Select.Item value="{nsName}:{tag.tag}">
							<span class="mr-2 text-xs text-muted-foreground">{nsName}:</span>
							{tag.tag}
						</Select.Item>
					{/each}
					{#if availableTags.length === 0}
						<div class="px-2 py-1.5 text-sm text-muted-foreground">No tags available</div>
					{/if}
				</Select.Content>
			</Select.Root>

			{#if dirty}
				<Button size="sm" onclick={save} disabled={isSaving}>
					{#if isSaving}
						<Loader2 class="mr-1 h-3.5 w-3.5 animate-spin" />
					{/if}
					Save
				</Button>
			{/if}
		</div>

		{#if tags.length > 0}
			<div class="flex flex-wrap gap-1.5">
				{#each tags as tag}
					{@const entry = catalog.find((c) => getFullTagString(c) === tag)}
					{@const nsName = entry ? getTagNamespaceName(entry) : (tag.split(':')[0] ?? '')}
					<Badge variant="outline" class="{getNamespaceColor(nsName)} gap-1 pr-1 text-[10px]">
						{tag}
						<button
							type="button"
							class="ml-0.5 rounded-sm p-0.5 hover:bg-foreground/10"
							onclick={() => removeTag(tag)}
						>
							<X class="h-2.5 w-2.5" />
						</button>
					</Badge>
				{/each}
			</div>
		{:else}
			<p class="text-xs text-muted-foreground">No tags assigned</p>
		{/if}
	</Card.Content>
</Card.Root>
