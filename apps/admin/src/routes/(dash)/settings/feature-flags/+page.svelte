<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Table from '$lib/components/shadcn/table/index.js';
	import * as Dialog from '$lib/components/shadcn/dialog/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Textarea } from '$lib/components/shadcn/textarea/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { Switch } from '$lib/components/shadcn/switch/index.js';
	import { Loader2, Plus, Pencil, Trash2, Flag } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	import type { TagRule } from '@repo/shared/types';
	import TagRuleEditor from '$lib/components/tag-rule-editor.svelte';
	import { describeTagRule, type TagCatalogWithNamespace } from '$lib/utils/tag-helpers';
	import {
		getFeatureFlags,
		getTagCatalogForFlags,
		saveFeatureFlag,
		toggleFeatureFlag,
		deleteFeatureFlag
	} from './feature-flags.remote';

	const data = await getFeatureFlags();
	const catalogData = await getTagCatalogForFlags();

	type FeatureFlagRow = Record<string, any>;

	let flags = $derived<FeatureFlagRow[]>(data?.flags ?? []);
	let catalog = $derived<TagCatalogWithNamespace[]>(catalogData?.tags ?? []);

	let dialogOpen = $state(false);
	let editingFlag = $state<FeatureFlagRow | null>(null);
	let tagRule = $state<TagRule>({ groups: [] });

	function openCreate() {
		editingFlag = null;
		tagRule = { groups: [] };
		saveFeatureFlag.fields.set({
			id: '',
			flag_key: '',
			display_name: '',
			description: '',
			is_enabled: 'false',
			tag_rule: ''
		});
		dialogOpen = true;
	}

	function openEdit(flag: FeatureFlagRow) {
		editingFlag = flag;
		const existingRule = flag.tagRule as TagRule | null;
		tagRule = existingRule?.groups?.length ? existingRule : { groups: [] };
		saveFeatureFlag.fields.set({
			id: flag.id,
			flag_key: flag.flagKey,
			display_name: flag.displayName,
			description: flag.description || '',
			is_enabled: flag.isEnabled ? 'true' : 'false',
			tag_rule: tagRule.groups.length ? JSON.stringify(tagRule) : ''
		});
		dialogOpen = true;
	}

	async function handleDelete(flag: FeatureFlagRow) {
		if (!confirm(`Delete feature flag "${flag.flagKey}"?`)) return;
		try {
			await deleteFeatureFlag({ id: flag.id });
			toast.success('Feature flag deleted');
		} catch (e) {
			toast.error((e as Error).message || 'Failed to delete');
		}
	}

	async function handleToggle(flag: FeatureFlagRow) {
		try {
			await toggleFeatureFlag({ id: flag.id, is_enabled: !flag.isEnabled });
		} catch (e) {
			toast.error((e as Error).message || 'Failed to toggle');
		}
	}
</script>

<div class="container mx-auto max-w-6xl space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Feature Flags</h1>
			<p class="text-sm text-muted-foreground">
				Manage feature flags for page gating, feature access, and progressive rollouts
			</p>
		</div>
		<Button onclick={openCreate}>
			<Plus class="mr-2 h-4 w-4" />
			Add Flag
		</Button>
	</div>

	{#if flags.length > 0}
		<Card.Root>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-48">Flag Key</Table.Head>
							<Table.Head>Display Name</Table.Head>
							<Table.Head>Tag Rule</Table.Head>
							<Table.Head class="w-24 text-center">Restricted</Table.Head>
							<Table.Head class="w-24 text-right">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each flags as flag}
							<Table.Row>
								<Table.Cell>
									<Badge variant="outline" class="font-mono text-xs">
										{flag.flagKey}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									<div>
										<p class="text-sm font-medium">{flag.displayName}</p>
										{#if flag.description}
											<p class="text-xs text-muted-foreground">{flag.description}</p>
										{/if}
									</div>
								</Table.Cell>
								<Table.Cell class="text-sm text-muted-foreground">
									{flag.tagRule ? describeTagRule(flag.tagRule, false) : 'Everyone'}
								</Table.Cell>
								<Table.Cell class="text-center">
									<Switch checked={flag.isEnabled} onCheckedChange={() => handleToggle(flag)} />
								</Table.Cell>
								<Table.Cell class="text-right">
									<div class="flex items-center justify-end gap-1">
										<Button
											variant="ghost"
											size="icon"
											class="h-8 w-8"
											onclick={() => openEdit(flag)}
										>
											<Pencil class="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											class="h-8 w-8 text-destructive"
											onclick={() => handleDelete(flag)}
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<Flag class="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
				<p class="text-sm text-muted-foreground">No feature flags configured yet.</p>
				<Button variant="outline" size="sm" class="mt-3" onclick={openCreate}>
					Add First Flag
				</Button>
			</Card.Content>
		</Card.Root>
	{/if}
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{editingFlag ? 'Edit Feature Flag' : 'Create Feature Flag'}</Dialog.Title>
		</Dialog.Header>
		<form
			{...saveFeatureFlag.enhance(async ({ submit }) => {
				try {
					await submit().updates(getFeatureFlags);
					if (saveFeatureFlag.result?.success) {
						toast.success(editingFlag ? 'Feature flag updated' : 'Feature flag created');
						dialogOpen = false;
					} else if (saveFeatureFlag.result && 'error' in saveFeatureFlag.result) {
						toast.error(saveFeatureFlag.result.error ?? 'Failed to save');
					}
				} catch (e) {
					toast.error((e as Error).message || 'Failed to save feature flag');
				}
			})}
		>
			<input type="hidden" name="id" value={saveFeatureFlag.fields.id.value()} />
			<input type="hidden" name="flag_key" value={saveFeatureFlag.fields.flag_key.value()} />
			<input type="hidden" name="is_enabled" value={saveFeatureFlag.fields.is_enabled.value()} />
			<input type="hidden" name="tag_rule" value={saveFeatureFlag.fields.tag_rule.value()} />

			<div class="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
				<div class="grid gap-2">
					<Label for="flag_key">Flag Key</Label>
					<Input
						{...saveFeatureFlag.fields.flag_key.as('text')}
						placeholder="e.g. page:analytics or feature:dark-mode"
						disabled={!!editingFlag}
					/>
					<p class="text-xs text-muted-foreground">
						Use <code>page:</code> prefix for route gating, <code>feature:</code> for feature access
					</p>
				</div>

				<div class="grid gap-2">
					<Label for="display_name">Display Name</Label>
					<Input
						{...saveFeatureFlag.fields.display_name.as('text')}
						placeholder="e.g. Analytics Dashboard"
					/>
				</div>

				<div class="grid gap-2">
					<Label for="description">Description</Label>
					<Textarea
						{...saveFeatureFlag.fields.description.as('text')}
						placeholder="Optional description"
						rows={2}
					/>
				</div>

				<div class="flex items-center justify-between rounded-md border p-3">
					<div>
						<p class="text-sm font-medium">Restricted</p>
						<p class="text-xs text-muted-foreground">
							When ON, tag rules are enforced. When OFF, everyone can access.
						</p>
					</div>
					<Switch
						checked={saveFeatureFlag.fields.is_enabled.value() === 'true'}
						onCheckedChange={(v) => saveFeatureFlag.fields.is_enabled.set(v ? 'true' : 'false')}
					/>
				</div>

				<div class="grid gap-2">
					<Label>Tag Rule (who can access)</Label>
					<p class="text-xs text-muted-foreground">
						Leave empty to grant access to everyone when restricted
					</p>
					<TagRuleEditor
						rule={tagRule}
						{catalog}
						onchange={(r) => {
							tagRule = r;
							const hasContent = r.groups.some((g) => g.tags.length > 0);
							saveFeatureFlag.fields.tag_rule.set(hasContent ? JSON.stringify(r) : '');
						}}
					/>
				</div>
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (dialogOpen = false)} type="button">Cancel</Button>
				<Button type="submit" disabled={!!saveFeatureFlag.pending}>
					{#if saveFeatureFlag.pending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					{editingFlag ? 'Update' : 'Create'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
