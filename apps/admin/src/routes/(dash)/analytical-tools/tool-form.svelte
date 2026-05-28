<script lang="ts">
	import { Input } from '$lib/components/shadcn/input';
	import { Button } from '$lib/components/shadcn/button';
	import * as Select from '$lib/components/shadcn/select';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import TagRuleEditor from '$lib/components/tag-rule-editor.svelte';
	import IconPicker from '$lib/components/icon-picker.svelte';
	import { saveTool, getTagCatalogForTools } from './tool.remote';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { AnalyticalToolCategory, type AnalyticalToolRow } from '@repo/db/types';
	import type { TagRule } from '@repo/shared/types';

	type ToolRow = AnalyticalToolRow;

	const CATEGORY_OPTIONS = Object.values(AnalyticalToolCategory);

	let { tool, onsuccess }: { tool: ToolRow | null; onsuccess?: () => void } = $props();

	const catalogQuery = getTagCatalogForTools();
	let catalog = $derived(catalogQuery.current ?? []);
	let tagRule = $state<TagRule>({ groups: [] });

	$effect(() => {
		const t = tool;
		untrack(() => {
			if (t) {
				const existingRule = t.tagRule as TagRule | null | undefined;
				const resolved =
					existingRule && existingRule.groups?.length ? existingRule : { groups: [] };
				tagRule = resolved;
				saveTool.fields.set({
					id: t.id,
					tool_key: t.toolKey,
					display_name: t.displayName,
					description: t.description || '',
					category: t.category || '',
					icon: t.icon || '',
					computation_type: t.computationType || 'worker',
					is_active: t.isActive,
					input_schema: JSON.stringify(t.inputSchema ?? [], null, 2),
					output_config: JSON.stringify(t.outputConfig ?? {}, null, 2),
					tag_rule: resolved.groups.length ? JSON.stringify(resolved) : ''
				});
			} else {
				tagRule = { groups: [] };
				saveTool.fields.set({
					id: '',
					tool_key: '',
					display_name: '',
					description: '',
					category: '',
					icon: '',
					computation_type: 'worker',
					is_active: true,
					input_schema: '[]',
					output_config: '{}',
					tag_rule: ''
				});
			}
		});
	});
</script>

<form
	{...saveTool.enhance(async ({ submit }) => {
		try {
			await submit();
			await invalidateAll();
			if (saveTool.result?.success) {
				toast.success(tool ? 'Tool updated' : 'Tool created');
				onsuccess?.();
			} else if (saveTool.result && 'error' in saveTool.result) {
				toast.error('Failed to save tool: ' + saveTool.result.error);
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save tool');
		}
	})}
	class="space-y-5 py-4"
>
	<input type="hidden" name="id" value={saveTool.fields.id.value()} />
	<input type="hidden" name="input_schema" value={saveTool.fields.input_schema.value()} />
	<input type="hidden" name="output_config" value={saveTool.fields.output_config.value()} />
	<input type="hidden" name="tag_rule" value={saveTool.fields.tag_rule.value()} />
	<input type="hidden" name="computation_type" value={saveTool.fields.computation_type.value()} />

	<!-- Section: Identity -->
	<fieldset class="space-y-3 rounded-lg border border-border/50 p-4">
		<legend class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>Identity</legend
		>

		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-2">
				<Label for="display_name">Display Name</Label>
				<Input
					{...saveTool.fields.display_name.as('text')}
					placeholder="e.g. Portfolio Risk Analyzer"
				/>
				{#each saveTool.fields.display_name.issues() as issue}
					<p class="text-sm text-destructive">{issue.message}</p>
				{/each}
			</div>
			<div class="space-y-2">
				<Label for="tool_key">Tool Key</Label>
				<Input
					{...saveTool.fields.tool_key.as('text')}
					placeholder="e.g. portfolio-risk-analyzer"
				/>
				{#each saveTool.fields.tool_key.issues() as issue}
					<p class="text-sm text-destructive">{issue.message}</p>
				{/each}
			</div>
		</div>

		<div class="space-y-2">
			<Label for="description">Description</Label>
			<Textarea
				{...saveTool.fields.description.as('text')}
				placeholder="Brief description of what this tool does"
				rows={2}
			/>
		</div>
	</fieldset>

	<!-- Section: Classification -->
	<fieldset class="space-y-3 rounded-lg border border-border/50 p-4">
		<legend class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>Classification</legend
		>

		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-2">
				<Label for="category">Category</Label>
				<Select.Root
					type="single"
					value={saveTool.fields.category.value() || ''}
					onValueChange={(v) => saveTool.fields.category.set(v)}
				>
					<Select.Trigger id="category">
						{saveTool.fields.category.value() || 'Select…'}
					</Select.Trigger>
					<Select.Content>
						{#each CATEGORY_OPTIONS as cat}
							<Select.Item value={cat}>{cat}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="category" value={saveTool.fields.category.value()} />
			</div>
			<div class="space-y-2">
				<Label>Icon</Label>
				<IconPicker
					value={saveTool.fields.icon.value() || ''}
					onchange={(v) => saveTool.fields.icon.set(v)}
				/>
				<input type="hidden" name="icon" value={saveTool.fields.icon.value()} />
			</div>
		</div>

		<div class="flex items-center gap-2">
			<Checkbox
				id="is_active"
				checked={!!saveTool.fields.is_active.value()}
				onCheckedChange={(v) => saveTool.fields.is_active.set(!!v)}
			/>
			<input
				type="hidden"
				name="is_active"
				value={saveTool.fields.is_active.value() ? 'true' : 'false'}
			/>
			<Label for="is_active">Active</Label>
		</div>
	</fieldset>

	<!-- Section: Schemas -->
	<fieldset class="space-y-3 rounded-lg border border-border/50 p-4">
		<legend class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>Schemas</legend
		>

		<div class="space-y-2">
			<Label for="input_schema_editor">Input Schema (JSON)</Label>
			<p class="text-xs text-muted-foreground">
				Array of field descriptors: key, label, type, required, options, validation.
			</p>
			<Textarea
				id="input_schema_editor"
				value={saveTool.fields.input_schema.value()}
				oninput={(e) => saveTool.fields.input_schema.set(e.currentTarget.value)}
				rows={8}
				class="font-mono text-xs"
				placeholder={'[{"key": "holdings", "label": "Holdings", "type": "array", "required": true}]'}
			/>
		</div>

		<div class="space-y-2">
			<Label for="output_config_editor">Output Config (JSON)</Label>
			<p class="text-xs text-muted-foreground">
				Describes expected output: suggested_charts, primary_output, columns.
			</p>
			<Textarea
				id="output_config_editor"
				value={saveTool.fields.output_config.value()}
				oninput={(e) => saveTool.fields.output_config.set(e.currentTarget.value)}
				rows={6}
				class="font-mono text-xs"
				placeholder={'{"suggested_charts": ["pie", "bar"], "primary_output": "metrics"}'}
			/>
		</div>
	</fieldset>

	<!-- Section: Access Control -->
	{#if catalog.length > 0}
		<fieldset class="space-y-3 rounded-lg border border-border/50 p-4">
			<legend class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
				>Access Control</legend
			>

			<div class="space-y-2">
				<Label>Tag Rule (Optional)</Label>
				<p class="text-xs text-muted-foreground">
					Restrict this tool to users matching specific tags. Leave empty for no restriction.
				</p>
				<TagRuleEditor
					rule={tagRule}
					{catalog}
					onchange={(r) => {
						tagRule = r;
						saveTool.fields.tag_rule.set(r.groups.length ? JSON.stringify(r) : '');
					}}
				/>
			</div>
		</fieldset>
	{/if}

	<div class="flex justify-end gap-2 pt-2">
		<Button type="submit" disabled={!!saveTool.pending} aria-busy={!!saveTool.pending}>
			{#if saveTool.pending}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				{tool ? 'Update' : 'Create'}
			{/if}
		</Button>
	</div>
</form>
