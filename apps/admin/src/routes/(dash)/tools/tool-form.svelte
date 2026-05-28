<script lang="ts">
	import { Input } from '$lib/components/shadcn/input';
	import { Button } from '$lib/components/shadcn/button';
	import * as Select from '$lib/components/shadcn/select';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import { Switch } from '$lib/components/shadcn/switch';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { saveTool } from './tool.remote';
	import { toast } from 'svelte-sonner';
	import { AiToolCategory, AiToolType, type AiProviderRow, type AiToolRow } from '@repo/db/types';

	import { invalidateAll } from '$app/navigation';

	type ToolRow = AiToolRow & { expand: { provider?: AiProviderRow } };

	let { tool, providers, onsuccess } = $props<{
		tool: ToolRow | null;
		providers: AiProviderRow[];
		onsuccess?: () => void;
	}>();

	$effect(() => {
		if (tool) {
			saveTool.fields.set({
				id: tool.id,
				display_name: tool.displayName,
				tool_key: tool.toolKey,
				description: tool.description,
				category: tool.category,
				tool_type: tool.toolType,
				sdk_tool_name: tool.sdkToolName,
				provider: tool.provider,
				docs_url: tool.docsUrl,
				icon: tool.icon,
				is_active: tool.isActive ?? true,
				is_enabled: tool.isEnabled ?? true,
				config_schema: JSON.stringify(tool.configSchema ?? {}, null, 2),
				default_config: JSON.stringify(tool.defaultConfig ?? {}, null, 2),
				execution_config: JSON.stringify(tool.executionConfig ?? {}, null, 2)
			});
		} else {
			saveTool.fields.set({
				id: '',
				display_name: '',
				tool_key: '',
				description: '',
				category: undefined,
				tool_type: AiToolType.builtin,
				sdk_tool_name: undefined,
				provider: undefined,
				docs_url: undefined,
				icon: undefined,
				is_active: true,
				is_enabled: true,
				config_schema: '{}',
				default_config: '{}',
				execution_config: '{}'
			});
		}
	});
</script>

<form
	{...saveTool.enhance(async ({ submit }) => {
		try {
			await submit();
			await invalidateAll();

			if (saveTool.result?.success) {
				toast.success('Tool saved successfully');
				onsuccess?.();
			} else if (saveTool.result && 'error' in saveTool.result) {
				toast.error('Failed to save tool: ' + saveTool.result.error);
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save tool');
		}
	})}
	class="space-y-4 py-4"
>
	{#if saveTool.result && 'error' in saveTool.result}
		<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
			{saveTool.result.error}
		</div>
	{/if}
	<input type="hidden" name="id" value={saveTool.fields.id.value()} />

	<div class="grid gap-2">
		<Label for="display_name">Display Name</Label>
		<Input {...saveTool.fields.display_name.as('text')} placeholder="e.g. Web Search" />
		{#each saveTool.fields.display_name.issues() as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<div class="grid gap-2">
		<Label for="tool_key">Tool Key (ID)</Label>
		<Input {...saveTool.fields.tool_key.as('text')} placeholder="e.g. display_chart" />
		{#each saveTool.fields.tool_key.issues() as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="grid gap-2">
			<Label for="tool_type">Type</Label>
			<Select.Root
				type="single"
				value={saveTool.fields.tool_type.value()}
				onValueChange={(v) => saveTool.fields.tool_type.set(v as AiToolType)}
			>
				<Select.Trigger>
					{saveTool.fields.tool_type.value()}
				</Select.Trigger>
				<Select.Content>
					{#each Object.values(AiToolType) as type}
						<Select.Item value={type}>{type}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<input type="hidden" name="tool_type" value={saveTool.fields.tool_type.value()} />
		</div>

		<div class="grid gap-2">
			<Label for="category">Category</Label>
			<Select.Root
				type="single"
				value={saveTool.fields.category.value()}
				onValueChange={(v) => saveTool.fields.category.set(v as AiToolCategory)}
			>
				<Select.Trigger>
					{saveTool.fields.category.value() || 'Select category'}
				</Select.Trigger>
				<Select.Content>
					{#each Object.values(AiToolCategory) as category}
						<Select.Item value={category}>{category}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<input type="hidden" name="category" value={saveTool.fields.category.value()} />
		</div>
	</div>

	<div class="grid gap-2">
		<Label for="sdk_tool_name">SDK Tool Name</Label>
		<Input
			{...saveTool.fields.sdk_tool_name.as('text')}
			id="sdk_tool_name"
			placeholder="e.g. web_search"
		/>
		<p class="text-xs text-muted-foreground">Optional for builtin tools.</p>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="grid gap-2">
			<Label for="provider">Provider</Label>
			<Select.Root
				type="single"
				value={saveTool.fields.provider.value()}
				onValueChange={(v) => saveTool.fields.provider.set(v)}
			>
				<Select.Trigger>
					{providers.find((p: AiProviderRow) => p.id === saveTool.fields.provider.value())
						?.displayName || 'No provider'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">No provider</Select.Item>
					{#each providers as provider}
						<Select.Item value={provider.id}>{provider.displayName}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<input type="hidden" name="provider" value={saveTool.fields.provider.value()} />
		</div>
		<div class="grid gap-2">
			<Label for="docs_url">Docs URL</Label>
			<Input {...saveTool.fields.docs_url.as('text')} id="docs_url" placeholder="https://..." />
		</div>
	</div>

	<div class="grid gap-2">
		<Label for="icon">Icon</Label>
		<Input {...saveTool.fields.icon.as('text')} id="icon" placeholder="lucide:tool" />
	</div>

	<div class="grid gap-2">
		<Label for="description">Description</Label>
		<Textarea
			{...saveTool.fields.description.as('text')}
			placeholder="Description of what this tool does..."
		/>
	</div>

	<div class="grid gap-2">
		<Label for="config_schema">Config Schema (JSON)</Label>
		<Textarea {...saveTool.fields.config_schema.as('text')} class="font-mono text-xs" rows={5} />
	</div>

	<div class="grid gap-2">
		<Label for="default_config">Default Config (JSON)</Label>
		<Textarea {...saveTool.fields.default_config.as('text')} class="font-mono text-xs" rows={5} />
	</div>

	<div class="grid gap-2">
		<Label for="execution_config">Execution Config (JSON)</Label>
		<Textarea {...saveTool.fields.execution_config.as('text')} class="font-mono text-xs" rows={5} />
	</div>

	<div class="flex items-center space-x-2">
		<Switch
			id="is_active"
			checked={saveTool.fields.is_active.value()}
			onCheckedChange={(v) => saveTool.fields.is_active.set(v)}
		/>
		<Label for="is_active">Active</Label>
		<input class="hidden" {...saveTool.fields.is_active.as('checkbox')} />
	</div>

	<div class="flex items-center space-x-2">
		<Switch
			id="is_enabled"
			checked={saveTool.fields.is_enabled.value()}
			onCheckedChange={(v) => saveTool.fields.is_enabled.set(v)}
		/>
		<Label for="is_enabled">Enabled</Label>
		<input class="hidden" {...saveTool.fields.is_enabled.as('checkbox')} />
	</div>

	<div class="flex justify-end">
		<Button type="submit" disabled={!!saveTool.pending} aria-busy={!!saveTool.pending}>
			{#if saveTool.pending}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				{tool ? 'Update' : 'Create'} Tool
			{/if}
		</Button>
	</div>
</form>
