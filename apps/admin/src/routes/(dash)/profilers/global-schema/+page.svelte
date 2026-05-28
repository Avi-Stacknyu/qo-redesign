<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Input } from '$lib/components/shadcn/input';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import * as Tabs from '$lib/components/shadcn/tabs';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Database from '@lucide/svelte/icons/database';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Save from '@lucide/svelte/icons/save';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import SchemaSectionEditor from './schema-section-editor.svelte';
	import type { SchemaSection } from './schema-section-editor.svelte';
	import {
		activateGlobalSchema,
		deleteGlobalSchema,
		getGlobalSchemas,
		saveGlobalSchema
	} from './global-schema.remote';

	type GlobalSchemaRecord = {
		id: string;
		name: string | null;
		description: string | null;
		schema: unknown;
		version: string | number | null;
		isActive: boolean | null;
		created: string | null;
		updated: string | null;
	};

	let { data } = $props();

	const schemasQuery = getGlobalSchemas();
	let schemas = $derived(
		(schemasQuery.current as GlobalSchemaRecord[] | undefined) ?? data.schemas
	);
	let activeSchema = $derived(schemas.find((schema) => schema.isActive));
	let latestVersion = $derived(
		schemas.reduce((max, schema) => Math.max(max, Number(schema.version) || 0), 0)
	);

	function schemaSections(schema: GlobalSchemaRecord | undefined) {
		if (!schema?.schema) return [];
		const raw = schema.schema;
		return Array.isArray(raw) ? (raw as SchemaSection[]) : [];
	}

	let parsedSections = $derived.by(() => {
		return schemaSections(activeSchema);
	});

	// Editor state
	let editing = $state(false);
	let isNew = $state(false);
	let editorMode = $state<'visual' | 'json'>('visual');
	let editName = $state('');
	let editDescription = $state('');
	let editSections = $state<SchemaSection[]>([]);
	let editingId = $state<string | undefined>(undefined);
	let jsonText = $state('');
	let jsonError = $state('');
	let saving = $state(false);

	function startEdit(schema = activeSchema) {
		if (!schema) return;
		editing = true;
		isNew = false;
		editingId = schema.id;
		editName = schema.name || '';
		editDescription = schema.description || '';
		editSections = structuredClone(schemaSections(schema));
		jsonText = JSON.stringify(editSections, null, 2);
		jsonError = '';
		editorMode = 'visual';
	}

	function startCreate() {
		editing = true;
		isNew = true;
		editingId = undefined;
		editName = '';
		editDescription = '';
		editSections = [];
		jsonText = '[]';
		jsonError = '';
		editorMode = 'visual';
	}

	function cancelEdit() {
		editing = false;
		isNew = false;
		editingId = undefined;
	}

	function onVisualChange(sections: SchemaSection[]) {
		editSections = sections;
		jsonText = JSON.stringify(sections, null, 2);
		jsonError = '';
	}

	function onJsonChange(text: string) {
		jsonText = text;
		try {
			const parsed = JSON.parse(text);
			if (!Array.isArray(parsed)) {
				jsonError = 'Schema must be an array of sections';
				return;
			}
			editSections = parsed;
			jsonError = '';
		} catch {
			jsonError = 'Invalid JSON';
		}
	}

	async function handleSave() {
		if (!editName.trim()) {
			toast.error('Name is required');
			return;
		}
		if (jsonError) {
			toast.error('Fix JSON errors before saving');
			return;
		}
		saving = true;
		try {
			const result = await saveGlobalSchema({
				id: editingId,
				name: editName,
				description: editDescription,
				schema: editSections,
				version: String(latestVersion)
			});
			if (result && typeof result === 'object' && 'success' in result) {
				if (result.success) {
					await schemasQuery.refresh();
					toast.success(isNew ? 'Schema created' : 'Schema updated');
					editing = false;
					isNew = false;
				} else {
					toast.error((result as { error?: string }).error || 'Save failed');
				}
			}
		} catch (e) {
			toast.error((e as Error).message || 'Something went wrong');
		} finally {
			saving = false;
		}
	}

	async function handleActivate(schema: GlobalSchemaRecord) {
		if (schema.isActive) return;
		try {
			const result = await activateGlobalSchema(schema.id);
			if (result.success) {
				await schemasQuery.refresh();
				toast.success('Schema version activated');
			} else {
				toast.error(result.error || 'Activation failed');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Activation failed');
		}
	}

	async function handleDelete(schema: GlobalSchemaRecord) {
		if (schema.isActive) {
			toast.error('Activate another version before deleting this one');
			return;
		}
		if (!confirm(`Delete schema version "${schema.name || schema.id}"?`)) return;

		try {
			const result = await deleteGlobalSchema(schema.id);
			if (result.success) {
				await schemasQuery.refresh();
				toast.success('Schema version deleted');
			} else {
				toast.error(result.error || 'Delete failed');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Delete failed');
		}
	}
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="flex items-center gap-3">
		<a href="/profilers" class="text-muted-foreground hover:text-foreground">
			<ArrowLeft class="size-4" />
		</a>
		<div class="flex-1">
			<h1 class="text-2xl font-semibold tracking-tight">Global Profile Schema</h1>
			<p class="text-sm text-muted-foreground">
				Single source of truth for profile structure, completion tracking, and markdown rendering.
			</p>
		</div>
		{#if !editing}
			<div class="flex items-center gap-2">
				{#if activeSchema}
					<Button variant="outline" size="sm" class="gap-1.5" onclick={() => startEdit()}>
						<Pencil class="size-3.5" />
						Edit
					</Button>
				{/if}
				<Button variant="default" size="sm" class="gap-1.5" onclick={startCreate}>
					<Plus class="size-3.5" />
					New Version
				</Button>
			</div>
		{/if}
	</div>

	{#if editing}
		<!-- Editor -->
		<div class="space-y-4 rounded-lg border border-border/40 bg-card/50 p-4">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold">
					{isNew ? 'Create New Schema Version' : 'Edit Schema'}
				</h2>
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						class="gap-1 text-muted-foreground"
						onclick={cancelEdit}
						disabled={saving}
					>
						<X class="size-3.5" />
						Cancel
					</Button>
					<Button
						variant="default"
						size="sm"
						class="gap-1"
						onclick={handleSave}
						disabled={saving || !!jsonError}
					>
						<Save class="size-3.5" />
						{saving ? 'Saving…' : 'Save'}
					</Button>
				</div>
			</div>

			<!-- Name & Description -->
			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label class="text-xs">Name</Label>
					<Input bind:value={editName} placeholder="e.g. Default Schema v2" class="h-8 text-sm" />
				</div>
				<div class="grid gap-1.5">
					<Label class="text-xs">Description</Label>
					<Input bind:value={editDescription} placeholder="Brief description" class="h-8 text-sm" />
				</div>
			</div>

			<!-- Visual / JSON Toggle -->
			<Tabs.Root bind:value={editorMode}>
				<Tabs.List class="w-fit">
					<Tabs.Trigger value="visual">Visual Editor</Tabs.Trigger>
					<Tabs.Trigger value="json">JSON</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="visual" class="pt-3">
					<SchemaSectionEditor bind:sections={editSections} onchange={onVisualChange} />
				</Tabs.Content>
				<Tabs.Content value="json" class="pt-3">
					<div class="space-y-2">
						<Textarea
							value={jsonText}
							oninput={(e) => onJsonChange((e.target as HTMLTextAreaElement).value)}
							rows={20}
							class="font-mono text-xs"
							placeholder="[]"
						/>
						{#if jsonError}
							<p class="text-xs text-destructive">{jsonError}</p>
						{/if}
					</div>
				</Tabs.Content>
			</Tabs.Root>
		</div>
	{:else if !activeSchema}
		<div class="rounded-lg border border-border/40 bg-card/50 py-10 text-center">
			<Database class="mx-auto mb-3 size-8 text-muted-foreground/50" />
			<p class="text-sm text-muted-foreground">
				No active global schema found. Click "New Version" to create one.
			</p>
		</div>
	{:else}
		<!-- Read-only view -->
		<div class="space-y-3 rounded-lg border border-border/40 bg-card/50 p-4">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-sm font-medium">{activeSchema.name}</h2>
					<p class="text-xs text-muted-foreground">{activeSchema.description}</p>
				</div>
				<div class="flex items-center gap-2">
					<Badge variant="outline">v{activeSchema.version}</Badge>
					{#if activeSchema.isActive}
						<Badge variant="default" class="bg-emerald-600">Active</Badge>
					{/if}
				</div>
			</div>
		</div>

		<div class="space-y-3">
			<h3 class="text-sm font-medium text-muted-foreground">
				Sections ({parsedSections.length})
			</h3>
			{#each parsedSections as section, i (section.section_id ?? i)}
				<div class="rounded-lg border border-border/30 bg-card/40 p-3">
					<div class="mb-2 flex items-center gap-2">
						<span class="text-xs font-medium text-foreground">{section.label}</span>
						<span class="text-[11px] text-muted-foreground">({section.section_id})</span>
						<span class="ml-auto text-[11px] text-muted-foreground">
							order: {section.order} · {section.fields?.length ?? 0} fields
						</span>
					</div>
					{#if section.fields?.length}
						<div class="space-y-0.5">
							{#each section.fields as field (field.key)}
								<div class="flex items-center gap-2 px-2 py-0.5 text-xs">
									<span class="w-32 shrink-0 font-medium text-foreground">{field.label}</span>
									<span class="text-muted-foreground">{field.key}</span>
									<Badge variant="outline" class="ml-auto text-[10px]">{field.type}</Badge>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if schemas.length > 1}
			<div class="space-y-3 rounded-lg border border-border/40 bg-card/50 p-4">
				<div>
					<h3 class="text-sm font-medium">Schema Versions</h3>
					<p class="text-xs text-muted-foreground">Activate, edit, or remove inactive versions.</p>
				</div>

				<div class="space-y-2">
					{#each schemas as schema (schema.id)}
						<div class="flex items-center gap-3 rounded-md border border-border/30 px-3 py-2">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="truncate text-sm font-medium">{schema.name}</span>
									<Badge variant="outline">v{schema.version}</Badge>
									{#if schema.isActive}
										<Badge variant="default" class="bg-emerald-600">Active</Badge>
									{/if}
								</div>
								<p class="truncate text-xs text-muted-foreground">{schema.description}</p>
							</div>

							<Button variant="outline" size="sm" class="gap-1.5" onclick={() => startEdit(schema)}>
								<Pencil class="size-3.5" />
								Edit
							</Button>
							{#if !schema.isActive}
								<Button
									variant="outline"
									size="sm"
									class="gap-1.5"
									onclick={() => handleActivate(schema)}
								>
									<CheckCircle2 class="size-3.5" />
									Activate
								</Button>
								<Button
									variant="ghost"
									size="sm"
									class="size-8 p-0 text-muted-foreground hover:text-destructive"
									onclick={() => handleDelete(schema)}
								>
									<Trash2 class="size-3.5" />
									<span class="sr-only">Delete</span>
								</Button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
