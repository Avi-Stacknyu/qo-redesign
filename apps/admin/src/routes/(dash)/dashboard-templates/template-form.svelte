<script lang="ts">
	import { Input } from '$lib/components/shadcn/input';
	import { Button } from '$lib/components/shadcn/button';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import TagRuleEditor from '$lib/components/tag-rule-editor.svelte';
	import { saveTemplate, getTagCatalogForTemplates, type TemplateRow } from './template.remote';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { TagRule } from '@repo/shared/types';

	let { template, onsuccess }: { template: TemplateRow | null; onsuccess?: () => void } = $props();

	const catalogQuery = getTagCatalogForTemplates();
	let catalog = $derived(catalogQuery.current ?? []);
	let tagRule = $state<TagRule>({ groups: [] });

	$effect(() => {
		if (template) {
			const existingRule = template.tagRule as TagRule | null | undefined;
			const resolved = existingRule && existingRule.groups?.length ? existingRule : { groups: [] };
			tagRule = resolved;
			saveTemplate.fields.set({
				id: template.id,
				name: template.name,
				description: template.description || '',
				category: template.category || '',
				icon: template.icon || '',
				is_active: template.isActive,
				default_widgets: JSON.stringify(template.defaultWidgets ?? [], null, 2),
				tag_rule: resolved.groups.length ? JSON.stringify(resolved) : ''
			});
		} else {
			tagRule = { groups: [] };
			saveTemplate.fields.set({
				id: '',
				name: '',
				description: '',
				category: '',
				icon: '',
				is_active: true,
				default_widgets: '[]',
				tag_rule: ''
			});
		}
	});
</script>

<form
	{...saveTemplate.enhance(async ({ submit }) => {
		try {
			await submit();
			await invalidateAll();
			if (saveTemplate.result?.success) {
				toast.success(template ? 'Template updated' : 'Template created');
				onsuccess?.();
			} else if (saveTemplate.result && 'error' in saveTemplate.result) {
				toast.error('Failed to save template: ' + saveTemplate.result.error);
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save template');
		}
	})}
	class="space-y-4 py-4"
>
	<input type="hidden" name="id" value={saveTemplate.fields.id.value()} />
	<input type="hidden" name="default_widgets" value={saveTemplate.fields.default_widgets.value()} />
	<input type="hidden" name="tag_rule" value={saveTemplate.fields.tag_rule.value()} />

	<div class="space-y-2">
		<Label for="name">Name</Label>
		<Input {...saveTemplate.fields.name.as('text')} placeholder="e.g. Investor Dashboard" />
		{#each saveTemplate.fields.name.issues() as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<div class="space-y-2">
		<Label for="description">Description</Label>
		<Textarea
			{...saveTemplate.fields.description.as('text')}
			placeholder="Brief description of this template"
			rows={2}
		/>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-2">
			<Label for="category">Category</Label>
			<Input {...saveTemplate.fields.category.as('text')} placeholder="e.g. finance, crypto" />
		</div>
		<div class="space-y-2">
			<Label for="icon">Icon</Label>
			<Input {...saveTemplate.fields.icon.as('text')} placeholder="e.g. chart-line" />
		</div>
	</div>

	<div class="flex items-center gap-2">
		<Checkbox
			id="is_active"
			checked={!!saveTemplate.fields.is_active.value()}
			onCheckedChange={(v) => saveTemplate.fields.is_active.set(!!v)}
		/>
		<input
			type="hidden"
			name="is_active"
			value={saveTemplate.fields.is_active.value() ? 'true' : 'false'}
		/>
		<Label for="is_active">Active</Label>
	</div>

	{#if template}
		<div class="rounded-lg border border-border/40 bg-muted/30 p-3">
			<p class="text-sm text-muted-foreground">
				Widgets are configured in the visual editor. Click the template name in the table to open
				it.
			</p>
		</div>
	{/if}

	{#if catalog.length > 0}
		<div class="space-y-2">
			<Label>Tag Rule (Optional Access Gating)</Label>
			<p class="text-xs text-muted-foreground">
				Restrict this template to users matching specific tags. Leave empty for no restriction.
			</p>
			<TagRuleEditor
				rule={tagRule}
				{catalog}
				onchange={(r) => {
					tagRule = r;
					saveTemplate.fields.tag_rule.set(r.groups.length ? JSON.stringify(r) : '');
				}}
			/>
		</div>
	{/if}

	<div class="flex justify-end gap-2 pt-2">
		<Button type="submit" disabled={!!saveTemplate.pending} aria-busy={!!saveTemplate.pending}>
			{#if saveTemplate.pending}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				{template ? 'Update' : 'Create'}
			{/if}
		</Button>
	</div>
</form>
