<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import { Input } from '$lib/components/shadcn/input';
	import { Label } from '$lib/components/shadcn/label';
	import * as Select from '$lib/components/shadcn/select';
	import { Switch } from '$lib/components/shadcn/switch';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import type { AiProviderRow, AiToolRow, ConfigTagCatalogRow } from '@repo/db/types';
	import type { TagRule } from '@repo/shared/types';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { toast } from 'svelte-sonner';
	import { saveAiAgentModel } from './model.remote';
	import TagRuleEditor from '$lib/components/tag-rule-editor.svelte';
	import type { ModelEditorData } from './model-page-data';

	type SaveModelResult = {
		success?: boolean;
		error?: string;
	};

	import { invalidateAll } from '$app/navigation';

	let {
		model,
		providerOptions,
		toolOptions,
		catalogOptions = [],
		onsuccess
	} = $props<{
		model: ModelEditorData | null;
		providerOptions: AiProviderRow[];
		toolOptions: AiToolRow[];
		catalogOptions?: ConfigTagCatalogRow[];
		onsuccess?: () => void;
	}>();

	let selectedTools = $state<string[]>([]);
	let tagRule: TagRule = $state({ groups: [] });
	let saveResult = $derived((saveAiAgentModel.result ?? null) as SaveModelResult | null);

	const optionsSchemaPlaceholder = '{ "type": "object", "properties": {} }';
	const defaultOptionsPlaceholder = '{ "temperature": 0.2 }';
	const capabilitiesPlaceholder = '{ "supports_tools": true }';

	function getProviderLabel(providerId: string) {
		const provider = providerOptions.find((p: AiProviderRow) => p.id === providerId);
		if (!provider) return providerId || 'Select a provider';
		return provider.displayName ?? provider.providerKey;
	}

	function asBoolean(value: string | boolean | undefined): boolean {
		return value === true || value === 'true';
	}

	/** Safely convert a Drizzle numeric() string or PB number to a JS number */
	function toNum(v: unknown): number | undefined {
		if (v == null || v === '') return undefined;
		const n = Number(v);
		return Number.isFinite(n) ? n : undefined;
	}

	$effect(() => {
		if (model) {
			selectedTools = [...model.supportedToolIds];
			const modelTagRule = model.tagRule as TagRule | null | undefined;
			const resolvedTagRule =
				modelTagRule && modelTagRule.groups?.length ? modelTagRule : { groups: [] };
			tagRule = resolvedTagRule;
			saveAiAgentModel.fields.set({
				id: model.id,
				display_name: model.displayName ?? '',
				model_id: model.modelId ?? '',
				provider: model.provider,
				description: model.description ?? '',
				context_window: toNum(model.contextWindow),
				max_output_tokens: toNum(model.maxOutputTokens),
				is_active: model.isActive ?? true,
				is_enabled: model.isEnabled ?? true,
				is_system_default: model.isSystemDefault ?? false,
				supported_tools: JSON.stringify(model.supportedToolIds),
				options_schema: model.optionsSchema ? JSON.stringify(model.optionsSchema, null, 2) : '',
				default_options: model.defaultOptions ? JSON.stringify(model.defaultOptions, null, 2) : '',
				capabilities: model.capabilities ? JSON.stringify(model.capabilities, null, 2) : '',
				tag_rule: resolvedTagRule.groups.length ? JSON.stringify(resolvedTagRule) : ''
			});
		} else {
			selectedTools = [];
			tagRule = { groups: [] };
			saveAiAgentModel.fields.set({
				id: '',
				display_name: '',
				model_id: '',
				provider: providerOptions[0]?.id ?? '',
				description: '',
				context_window: undefined,
				max_output_tokens: undefined,
				is_active: true,
				is_enabled: true,
				is_system_default: false,
				supported_tools: '[]',
				options_schema: '',
				default_options: '',
				capabilities: '',
				tag_rule: ''
			});
		}
	});

	function toggleTool(toolId: string) {
		if (selectedTools.includes(toolId)) {
			selectedTools = selectedTools.filter((id) => id !== toolId);
		} else {
			selectedTools = [...selectedTools, toolId];
		}
		saveAiAgentModel.fields.supported_tools.set(JSON.stringify(selectedTools));
	}
</script>

<form
	{...saveAiAgentModel.enhance(async ({ submit }) => {
		try {
			await submit();
			await invalidateAll();

			if (saveResult?.success) {
				toast.success('Model saved successfully');
				onsuccess?.();
			} else if (saveResult?.error) {
				toast.error('Failed to save model: ' + saveResult.error);
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save model');
		}
	})}
	class="space-y-4 px-4"
>
	{#if saveResult?.error}
		<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
			{saveResult.error}
		</div>
	{/if}

	<input type="hidden" name="id" value={saveAiAgentModel.fields.id.value()} />

	<div class="grid gap-2">
		<Label for="display_name">Display Name</Label>
		<Input {...saveAiAgentModel.fields.display_name.as('text')} placeholder="e.g. GPT-4 Turbo" />
		{#each saveAiAgentModel.fields.display_name.issues() as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<div class="grid gap-2">
		<Label for="provider">Provider</Label>
		<Select.Root
			type="single"
			value={saveAiAgentModel.fields.provider.value()}
			onValueChange={(v) => saveAiAgentModel.fields.provider.set(v)}
		>
			<Select.Trigger>
				{getProviderLabel(saveAiAgentModel.fields.provider.value() ?? '')}
			</Select.Trigger>
			<Select.Content>
				{#each providerOptions as provider}
					<Select.Item value={provider.id}>
						{provider.displayName} ({provider.providerKey})
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<input type="hidden" name="provider" value={saveAiAgentModel.fields.provider.value()} />
	</div>

	<div class="grid gap-2">
		<Label for="model_id">Model ID</Label>
		<Input {...saveAiAgentModel.fields.model_id.as('text')} placeholder="e.g. gpt-4.1-mini" />
		{#each saveAiAgentModel.fields.model_id.issues() as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="grid gap-2">
			<Label for="context_window">Context Window</Label>
			<Input {...saveAiAgentModel.fields.context_window.as('number')} min="1" step="1" />
		</div>
		<div class="grid gap-2">
			<Label for="max_output_tokens">Max Output Tokens</Label>
			<Input {...saveAiAgentModel.fields.max_output_tokens.as('number')} min="1" step="1" />
		</div>
	</div>

	<div class="grid gap-2">
		<Label>Supported Tools</Label>
		<div class="max-h-48 space-y-2 overflow-y-auto rounded-md border p-4">
			{#each toolOptions as tool}
				<div class="flex items-center space-x-2">
					<Checkbox
						id={tool.id}
						checked={selectedTools.includes(tool.id)}
						onCheckedChange={() => toggleTool(tool.id)}
					/>
					<Label for={tool.id} class="cursor-pointer font-normal">
						{tool.displayName}
						<span class="text-xs text-muted-foreground">({tool.toolKey})</span>
					</Label>
				</div>
			{/each}
			{#if toolOptions.length === 0}
				<p class="text-sm text-muted-foreground">No tools available.</p>
			{/if}
		</div>
		<input
			type="hidden"
			name="supported_tools"
			value={saveAiAgentModel.fields.supported_tools.value()}
		/>
	</div>

	<div class="grid gap-2">
		<Label for="description">Description</Label>
		<Textarea
			{...saveAiAgentModel.fields.description.as('text')}
			placeholder="Description of this agent model configuration..."
		/>
	</div>

	<div class="grid gap-2">
		<Label for="options_schema">Options Schema (JSON)</Label>
		<Textarea
			{...saveAiAgentModel.fields.options_schema.as('text')}
			placeholder={optionsSchemaPlaceholder}
			rows={6}
		/>
	</div>

	<div class="grid gap-2">
		<Label for="default_options">Default Options (JSON)</Label>
		<Textarea
			{...saveAiAgentModel.fields.default_options.as('text')}
			placeholder={defaultOptionsPlaceholder}
			rows={5}
		/>
	</div>

	<div class="grid gap-2">
		<Label for="capabilities">Capabilities (JSON)</Label>
		<Textarea
			{...saveAiAgentModel.fields.capabilities.as('text')}
			placeholder={capabilitiesPlaceholder}
			rows={5}
		/>
	</div>

	<div class="flex items-center justify-between rounded-md border p-3">
		<div>
			<p class="text-sm font-medium">Active</p>
			<p class="text-xs text-muted-foreground">Model exists and is manageable in admin</p>
		</div>
		<div class="flex items-center gap-2">
			<Switch
				id="is_active"
				checked={asBoolean(saveAiAgentModel.fields.is_active.value())}
				onCheckedChange={(v) => saveAiAgentModel.fields.is_active.set(v)}
			/>
			<input
				type="hidden"
				name="is_active"
				value={asBoolean(saveAiAgentModel.fields.is_active.value()) ? 'true' : 'false'}
			/>
		</div>
	</div>

	<div class="flex items-center justify-between rounded-md border p-3">
		<div>
			<p class="text-sm font-medium">Enabled for Users</p>
			<p class="text-xs text-muted-foreground">Shows in client-side model picker when active</p>
		</div>
		<div class="flex items-center gap-2">
			<Switch
				id="is_enabled"
				checked={asBoolean(saveAiAgentModel.fields.is_enabled.value())}
				onCheckedChange={(v) => saveAiAgentModel.fields.is_enabled.set(v)}
			/>
			<input
				type="hidden"
				name="is_enabled"
				value={asBoolean(saveAiAgentModel.fields.is_enabled.value()) ? 'true' : 'false'}
			/>
		</div>
	</div>

	<div
		class="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-50/5 p-3"
	>
		<div>
			<p class="text-sm font-medium">System Default</p>
			<p class="text-xs text-muted-foreground">Fallback model when user has no preference</p>
		</div>
		<div class="flex items-center gap-2">
			<Switch
				id="is_system_default"
				checked={asBoolean(saveAiAgentModel.fields.is_system_default.value())}
				onCheckedChange={(v) => saveAiAgentModel.fields.is_system_default.set(v)}
			/>
			<input
				type="hidden"
				name="is_system_default"
				value={asBoolean(saveAiAgentModel.fields.is_system_default.value()) ? 'true' : 'false'}
			/>
		</div>
	</div>

	{#if catalogOptions.length > 0}
		<div class="grid gap-2">
			<Label>Tag Rule (Optional Access Gating)</Label>
			<p class="text-xs text-muted-foreground">
				Restrict this model to users matching specific tags. Leave empty for no restriction.
			</p>
			<TagRuleEditor
				rule={tagRule}
				catalog={catalogOptions}
				onchange={(r) => {
					tagRule = r;
					saveAiAgentModel.fields.tag_rule.set(r.groups.length ? JSON.stringify(r) : '');
				}}
			/>
		</div>
	{/if}
	<input type="hidden" name="tag_rule" value={saveAiAgentModel.fields.tag_rule.value()} />

	<div class="flex justify-end">
		<Button
			type="submit"
			disabled={!!saveAiAgentModel.pending}
			aria-busy={!!saveAiAgentModel.pending}
		>
			{#if saveAiAgentModel.pending}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				{model ? 'Update' : 'Create'} Model
			{/if}
		</Button>
	</div>
</form>
