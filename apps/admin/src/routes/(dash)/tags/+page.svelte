<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Table from '$lib/components/shadcn/table/index.js';
	import * as Dialog from '$lib/components/shadcn/dialog/index.js';
	import * as Tabs from '$lib/components/shadcn/tabs/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Textarea } from '$lib/components/shadcn/textarea/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import { Checkbox } from '$lib/components/shadcn/checkbox/index.js';
	import { Loader2, Plus, Pencil, Trash2, Tag, Info, Palette } from '@lucide/svelte';
	import TagInstructions from './tag-instructions.svelte';
	import { toast } from 'svelte-sonner';
	import { setNamespaceColors } from '$lib/utils/tag-helpers';
	import {
		getTagCatalog,
		getTagNamespaces,
		saveTag,
		deleteTagAction,
		saveNamespace,
		deleteNamespaceAction,
		type TagWithNamespace
	} from './tags.remote';

	// Namespace data
	const namespaces = (await getTagNamespaces()) ?? [];
	type NamespaceRow = (typeof namespaces)[number];

	// Populate namespace color cache for use by other components
	$effect(() => {
		if (namespaces.length > 0) {
			setNamespaceColors(namespaces as any);
		}
	});

	// Tag data
	const tagsData = await getTagCatalog();
	let tags = $derived<TagWithNamespace[]>(tagsData?.tags ?? []);

	// Group tags by namespace ID
	let groupedTags = $derived(
		tags.reduce(
			(acc, tag) => {
				const nsId = tag.namespace ?? '';
				if (!acc[nsId]) acc[nsId] = [];
				acc[nsId].push(tag);
				return acc;
			},
			{} as Record<string, TagWithNamespace[]>
		)
	);

	// Tag dialog state
	let tagDialogOpen = $state(false);
	let editingTag = $state<TagWithNamespace | null>(null);

	// Namespace dialog state
	let nsDialogOpen = $state(false);
	let editingNs = $state<NamespaceRow | null>(null);

	const colorOptions = [
		{ value: 'purple-500', label: 'Purple' },
		{ value: 'blue-500', label: 'Blue' },
		{ value: 'amber-500', label: 'Amber' },
		{ value: 'emerald-500', label: 'Emerald' },
		{ value: 'rose-500', label: 'Rose' },
		{ value: 'cyan-500', label: 'Cyan' },
		{ value: 'orange-500', label: 'Orange' },
		{ value: 'gray-500', label: 'Gray' }
	];

	function getColorClass(colorClass: string): string {
		return `bg-${colorClass}/10 text-${colorClass}`;
	}

	// Tag CRUD
	function openCreateTag() {
		editingTag = null;
		saveTag.fields.set({
			id: '',
			tag: '',
			namespace: namespaces[0]?.id ?? '',
			description: ''
		});
		tagDialogOpen = true;
	}

	function openEditTag(tag: TagWithNamespace) {
		editingTag = tag;
		saveTag.fields.set({
			id: tag.id,
			tag: tag.tag ?? '',
			namespace: tag.namespace ?? '',
			description: tag.description || ''
		});
		tagDialogOpen = true;
	}

	async function handleDeleteTag(tag: TagWithNamespace) {
		const nsName = tag.expand?.namespace?.name ?? 'unknown';
		if (!confirm(`Delete tag "${nsName}:${tag.tag}"?`)) return;
		try {
			await deleteTagAction({ id: tag.id });
			toast.success('Tag deleted');
		} catch (e) {
			toast.error((e as Error).message || 'Failed to delete');
		}
	}

	// Namespace CRUD
	function openCreateNs() {
		editingNs = null;
		saveNamespace.fields.set({
			id: '',
			name: '',
			display_name: '',
			color_class: 'gray-500',
			icon: '',
			description: '',
			is_assignable_onboarding: 'false',
			is_user_editable: 'false',
			sort_order: String(namespaces.length)
		});
		nsDialogOpen = true;
	}

	function openEditNs(ns: NamespaceRow) {
		editingNs = ns;
		saveNamespace.fields.set({
			id: ns.id,
			name: ns.name ?? '',
			display_name: ns.displayName ?? '',
			color_class: ns.colorClass ?? 'gray-500',
			icon: ns.icon || '',
			description: ns.description || '',
			is_assignable_onboarding: ns.isAssignableOnboarding ? 'true' : 'false',
			is_user_editable: ns.isUserEditable ? 'true' : 'false',
			sort_order: ns.sortOrder != null ? String(ns.sortOrder) : '0'
		});
		nsDialogOpen = true;
	}

	async function handleDeleteNs(ns: NamespaceRow) {
		const tagCount = groupedTags[ns.id]?.length ?? 0;
		if (tagCount > 0) {
			toast.error(`Cannot delete namespace with ${tagCount} tag(s). Delete tags first.`);
			return;
		}
		if (!confirm(`Delete namespace "${ns.displayName}"?`)) return;
		try {
			await deleteNamespaceAction({ id: ns.id });
			toast.success('Namespace deleted');
		} catch (e) {
			toast.error((e as Error).message || 'Failed to delete');
		}
	}
</script>

<div class="container mx-auto max-w-6xl space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Tag Catalog</h1>
			<p class="text-sm text-muted-foreground">
				Manage tags and namespaces for agent visibility, plan gating, and user segmentation
			</p>
		</div>
		<Button onclick={openCreateTag}>
			<Plus class="mr-2 h-4 w-4" />
			Add Tag
		</Button>
	</div>

	<Tabs.Root value="catalog">
		<Tabs.List>
			<Tabs.Trigger value="catalog"><Tag class="mr-1.5 h-4 w-4" />Catalog</Tabs.Trigger>
			<Tabs.Trigger value="namespaces"><Palette class="mr-1.5 h-4 w-4" />Namespaces</Tabs.Trigger>
			<Tabs.Trigger value="instructions"><Info class="mr-1.5 h-4 w-4" />How It Works</Tabs.Trigger>
		</Tabs.List>

		<!-- Tags Catalog Tab -->
		<Tabs.Content value="catalog" class="mt-4 space-y-6">
			{#each namespaces as ns (ns.id)}
				{@const nsTags = groupedTags[ns.id] || []}
				{#if nsTags.length > 0}
					<Card.Root>
						<Card.Header>
							<Card.Title class="flex items-center gap-2">
								<Badge class={getColorClass(ns.colorClass ?? 'gray-500')}>{ns.displayName}</Badge>
								<span class="text-sm font-normal text-muted-foreground">({nsTags.length} tags)</span
								>
							</Card.Title>
						</Card.Header>
						<Card.Content class="p-0">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head class="w-48">Tag</Table.Head>
										<Table.Head>Description</Table.Head>
										<Table.Head class="w-24 text-right">Actions</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each nsTags as tag (tag.id)}
										<Table.Row>
											<Table.Cell>
												<Badge variant="outline" class={getColorClass(ns.colorClass ?? 'gray-500')}>
													{ns.name}:{tag.tag}
												</Badge>
											</Table.Cell>
											<Table.Cell class="text-sm text-muted-foreground">
												{tag.description || '—'}
											</Table.Cell>
											<Table.Cell class="text-right">
												<div class="flex items-center justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8"
														onclick={() => openEditTag(tag)}
													>
														<Pencil class="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-destructive"
														onclick={() => handleDeleteTag(tag)}
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
				{/if}
			{/each}

			{#if tags.length === 0}
				<Card.Root>
					<Card.Content class="py-12 text-center">
						<Tag class="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
						<p class="text-sm text-muted-foreground">No tags configured yet.</p>
						<Button variant="outline" size="sm" class="mt-3" onclick={openCreateTag}
							>Add First Tag</Button
						>
					</Card.Content>
				</Card.Root>
			{/if}
		</Tabs.Content>

		<!-- Namespaces Tab -->
		<Tabs.Content value="namespaces" class="mt-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between">
					<Card.Title>Tag Namespaces</Card.Title>
					<Button size="sm" onclick={openCreateNs}>
						<Plus class="mr-2 h-4 w-4" />
						Add Namespace
					</Button>
				</Card.Header>
				<Card.Content class="p-0">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-32">Name</Table.Head>
								<Table.Head class="w-32">Display</Table.Head>
								<Table.Head class="w-24">Color</Table.Head>
								<Table.Head>Description</Table.Head>
								<Table.Head class="w-32 text-center">Onboarding</Table.Head>
								<Table.Head class="w-32 text-center">User Edit</Table.Head>
								<Table.Head class="w-24 text-right">Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each namespaces as ns (ns.id)}
								<Table.Row>
									<Table.Cell class="font-mono text-sm">{ns.name}</Table.Cell>
									<Table.Cell>{ns.displayName}</Table.Cell>
									<Table.Cell>
										<Badge class={getColorClass(ns.colorClass ?? 'gray-500')}>{ns.colorClass}</Badge
										>
									</Table.Cell>
									<Table.Cell class="text-sm text-muted-foreground"
										>{ns.description || '—'}</Table.Cell
									>
									<Table.Cell class="text-center"
										>{ns.isAssignableOnboarding ? '✓' : '—'}</Table.Cell
									>
									<Table.Cell class="text-center">{ns.isUserEditable ? '✓' : '—'}</Table.Cell>
									<Table.Cell class="text-right">
										<div class="flex items-center justify-end gap-1">
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8"
												onclick={() => openEditNs(ns)}
											>
												<Pencil class="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 text-destructive"
												onclick={() => handleDeleteNs(ns)}
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
		</Tabs.Content>

		<Tabs.Content value="instructions" class="mt-4">
			<TagInstructions />
		</Tabs.Content>
	</Tabs.Root>
</div>

<!-- Tag Dialog -->
<Dialog.Root bind:open={tagDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{editingTag ? 'Edit Tag' : 'Create Tag'}</Dialog.Title>
		</Dialog.Header>
		<form
			{...saveTag.enhance(async ({ submit }) => {
				try {
					await submit().updates(getTagCatalog);
					if (saveTag.result?.success) {
						toast.success(editingTag ? 'Tag updated' : 'Tag created');
						tagDialogOpen = false;
					} else if (saveTag.result && 'error' in saveTag.result) {
						toast.error(saveTag.result.error ?? 'Failed to save');
					}
				} catch (e) {
					toast.error((e as Error).message || 'Failed to save tag');
				}
			})}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={saveTag.fields.id.value()} />
			<input type="hidden" name="namespace" value={saveTag.fields.namespace.value()} />

			<div class="grid gap-2">
				<Label for="tag">Tag</Label>
				<Input {...saveTag.fields.tag.as('text')} placeholder="e.g. pro, in, doctor, vip" />
			</div>

			<div class="grid gap-2">
				<Label>Namespace</Label>
				<Select.Root
					type="single"
					value={saveTag.fields.namespace.value()}
					onValueChange={(v) => {
						if (v) saveTag.fields.namespace.set(v);
					}}
				>
					<Select.Trigger>
						{namespaces.find((n) => n.id === saveTag.fields.namespace.value())?.displayName ||
							'Select namespace'}
					</Select.Trigger>
					<Select.Content>
						{#each namespaces as ns (ns.id)}
							<Select.Item value={ns.id}>{ns.displayName}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="grid gap-2">
				<Label for="tagDescription">Description</Label>
				<Textarea
					{...saveTag.fields.description.as('text')}
					id="tagDescription"
					placeholder="Optional description"
					rows={2}
				/>
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={() => (tagDialogOpen = false)} type="button"
					>Cancel</Button
				>
				<Button type="submit" disabled={!!saveTag.pending}>
					{#if saveTag.pending}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{editingTag ? 'Update' : 'Create'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Namespace Dialog -->
<Dialog.Root bind:open={nsDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{editingNs ? 'Edit Namespace' : 'Create Namespace'}</Dialog.Title>
		</Dialog.Header>
		<form
			{...saveNamespace.enhance(async ({ submit }) => {
				try {
					await submit().updates(getTagNamespaces);
					if (saveNamespace.result?.success) {
						toast.success(editingNs ? 'Namespace updated' : 'Namespace created');
						nsDialogOpen = false;
					} else if (saveNamespace.result && 'error' in saveNamespace.result) {
						toast.error(saveNamespace.result.error ?? 'Failed to save');
					}
				} catch (e) {
					toast.error((e as Error).message || 'Failed to save namespace');
				}
			})}
			class="grid gap-4"
		>
			<input type="hidden" name="id" value={saveNamespace.fields.id.value()} />
			<input type="hidden" name="color_class" value={saveNamespace.fields.color_class.value()} />
			<input
				type="hidden"
				name="is_assignable_onboarding"
				value={saveNamespace.fields.is_assignable_onboarding.value()}
			/>
			<input
				type="hidden"
				name="is_user_editable"
				value={saveNamespace.fields.is_user_editable.value()}
			/>
			<input type="hidden" name="sort_order" value={saveNamespace.fields.sort_order.value()} />

			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label for="nsName">Name (key)</Label>
					<Input
						{...saveNamespace.fields.name.as('text')}
						id="nsName"
						placeholder="e.g. tier, geo"
						disabled={!!editingNs}
					/>
					<p class="text-xs text-muted-foreground">Lowercase, no spaces</p>
				</div>
				<div class="grid gap-2">
					<Label for="nsDisplayName">Display Name</Label>
					<Input
						{...saveNamespace.fields.display_name.as('text')}
						id="nsDisplayName"
						placeholder="e.g. Tier, Geography"
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label>Color</Label>
					<Select.Root
						type="single"
						value={saveNamespace.fields.color_class.value()}
						onValueChange={(v) => {
							if (v) saveNamespace.fields.color_class.set(v);
						}}
					>
						<Select.Trigger>
							<Badge class={getColorClass(saveNamespace.fields.color_class.value())}
								>{saveNamespace.fields.color_class.value()}</Badge
							>
						</Select.Trigger>
						<Select.Content>
							{#each colorOptions as c (c.value)}
								<Select.Item value={c.value}>
									<Badge class={getColorClass(c.value)}>{c.label}</Badge>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="grid gap-2">
					<Label for="nsIcon">Icon (optional)</Label>
					<Input
						{...saveNamespace.fields.icon.as('text')}
						id="nsIcon"
						placeholder="e.g. Shield, Globe"
					/>
				</div>
			</div>

			<div class="grid gap-2">
				<Label for="nsDescription">Description</Label>
				<Textarea
					{...saveNamespace.fields.description.as('text')}
					id="nsDescription"
					placeholder="What this namespace is used for"
					rows={2}
				/>
			</div>

			<div class="flex items-center gap-6">
				<label class="flex items-center gap-2">
					<Checkbox
						checked={saveNamespace.fields.is_assignable_onboarding.value() === 'true'}
						onCheckedChange={(v) =>
							saveNamespace.fields.is_assignable_onboarding.set(v ? 'true' : 'false')}
					/>
					<span class="text-sm">Assignable during onboarding</span>
				</label>
				<label class="flex items-center gap-2">
					<Checkbox
						checked={saveNamespace.fields.is_user_editable.value() === 'true'}
						onCheckedChange={(v) => saveNamespace.fields.is_user_editable.set(v ? 'true' : 'false')}
					/>
					<span class="text-sm">User can self-assign</span>
				</label>
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={() => (nsDialogOpen = false)} type="button"
					>Cancel</Button
				>
				<Button type="submit" disabled={!!saveNamespace.pending}>
					{#if saveNamespace.pending}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{editingNs ? 'Update' : 'Create'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
