<script lang="ts">
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import { Label } from '$lib/components/shadcn/label';
	import type { AiAgentModelRow, AiToolRow } from '@repo/db/types';

	let {
		modelOptions,
		toolOptions,
		selectedModels = $bindable(),
		selectedTools = $bindable(),
		modelsHiddenValue,
		toolsHiddenValue
	}: {
		modelOptions: AiAgentModelRow[];
		toolOptions: AiToolRow[];
		selectedModels: string[];
		selectedTools: string[];
		modelsHiddenValue: string;
		toolsHiddenValue: string;
	} = $props();

	function toggleModel(id: string) {
		selectedModels = selectedModels.includes(id)
			? selectedModels.filter((m) => m !== id)
			: [...selectedModels, id];
	}

	function toggleTool(id: string) {
		selectedTools = selectedTools.includes(id)
			? selectedTools.filter((t) => t !== id)
			: [...selectedTools, id];
	}
</script>

<div class="grid gap-2">
	<Label>Allowed Models</Label>
	<p class="text-xs text-muted-foreground">Empty = all models allowed</p>
	<div class="max-h-48 space-y-2 overflow-y-auto rounded-md border p-4">
		{#each modelOptions as model}
			<div class="flex items-center space-x-2">
				<Checkbox
					id={'model-' + model.id}
					checked={selectedModels.includes(model.id)}
					onCheckedChange={() => toggleModel(model.id)}
				/>
				<Label for={'model-' + model.id} class="cursor-pointer font-normal">
					{model.displayName}
					<span class="text-xs text-muted-foreground">({model.modelId})</span>
				</Label>
			</div>
		{/each}
		{#if modelOptions.length === 0}
			<p class="text-sm text-muted-foreground">No models available.</p>
		{/if}
	</div>
	<input type="hidden" name="allowed_models" value={modelsHiddenValue} />
</div>

<div class="grid gap-2">
	<Label>Allowed Tools</Label>
	<p class="text-xs text-muted-foreground">Empty = all tools allowed</p>
	<div class="max-h-48 space-y-2 overflow-y-auto rounded-md border p-4">
		{#each toolOptions as tool}
			<div class="flex items-center space-x-2">
				<Checkbox
					id={'tool-' + tool.id}
					checked={selectedTools.includes(tool.id)}
					onCheckedChange={() => toggleTool(tool.id)}
				/>
				<Label for={'tool-' + tool.id} class="cursor-pointer font-normal">
					{tool.displayName}
					<span class="text-xs text-muted-foreground">({tool.toolKey})</span>
				</Label>
			</div>
		{/each}
		{#if toolOptions.length === 0}
			<p class="text-sm text-muted-foreground">No tools available.</p>
		{/if}
	</div>
	<input type="hidden" name="allowed_tools" value={toolsHiddenValue} />
</div>
