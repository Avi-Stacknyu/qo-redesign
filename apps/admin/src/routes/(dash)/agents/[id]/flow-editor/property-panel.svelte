<script lang="ts">
	/**
	 * Property Panel for Flow Editor
	 * Handles configuration for all node types with dynamic forms based on:
	 * - Model options_schema (from ai_agent_models)
	 * - Tool config_schema (from ai_tools)
	 * - Knowledge base file selection (from ai_system_uploads)
	 */
	import type { Node } from '@xyflow/svelte';
	import type { AllNodeData } from './nodes';
	import type { StartNodeData } from './nodes/start-node.svelte';
	import type { LLMNodeData } from './nodes/llm-node.svelte';
	import type { ClassifierNodeData } from './nodes/classifier-node.svelte';
	import type { EndNodeData } from './nodes/end-node.svelte';
	import type {
		ModelWithProvider,
		Tool,
		SystemUpload,
		Prompt,
		InjectableAttribute
	} from '$lib/remote/agent.remote';

	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import Settings from '@lucide/svelte/icons/settings';
	import FileText from '@lucide/svelte/icons/file-text';
	import Bot from '@lucide/svelte/icons/bot';
	import Wrench from '@lucide/svelte/icons/wrench';
	import X from '@lucide/svelte/icons/x';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Variable from '@lucide/svelte/icons/variable';

	import { Input } from '$lib/components/shadcn/input';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import { Button } from '$lib/components/shadcn/button';
	import { Separator } from '$lib/components/shadcn/separator';
	import * as Select from '$lib/components/shadcn/select';
	import * as Collapsible from '$lib/components/shadcn/collapsible';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import { Switch } from '$lib/components/shadcn/switch';
	import SchemaForm from './schema-form.svelte';

	interface Props {
		node: Node<AllNodeData>;
		availableModels: ModelWithProvider[];
		availableTools: Tool[];
		systemUploads: SystemUpload[];
		availablePrompts: Prompt[];
		injectableAttributes: InjectableAttribute[];
		onUpdate: (data: Partial<AllNodeData>) => void;
		onDelete: () => void;
	}

	let {
		node,
		availableModels,
		availableTools,
		systemUploads,
		availablePrompts,
		injectableAttributes,
		onUpdate,
		onDelete
	}: Props = $props();

	// ============================================================================
	// Node Type (handles undefined)
	// ============================================================================

	let nodeType = $derived(node.type ?? '');

	/** Local toggle state for "Pin to specific model" — true when user enables pin before selecting a model. */
	let pinModelEnabled = $state(false);

	// Sync local pin state when the selected node changes
	$effect(() => {
		const data = node.data as LLMNodeData;
		pinModelEnabled = !!data?.model_id;
	});

	// ============================================================================
	// Typed Data Getters
	// ============================================================================

	function getStartData(): StartNodeData {
		return node.data as StartNodeData;
	}

	function getLLMData(): LLMNodeData {
		return node.data as LLMNodeData;
	}

	function getClassifierData(): ClassifierNodeData {
		return node.data as ClassifierNodeData;
	}

	function getEndData(): EndNodeData {
		return node.data as EndNodeData;
	}

	// ============================================================================
	// Model & Tool Helpers
	// ============================================================================

	function getSelectedModel(modelId: string | undefined): ModelWithProvider | null {
		if (!modelId) return null;
		return availableModels.find((m) => m.id === modelId) ?? null;
	}

	function getProviderName(model: ModelWithProvider): string {
		return model.expand?.provider?.displayName ?? model.provider ?? '';
	}

	/**
	 * Filter tools by model support
	 * Each model has a `supportedTools` array containing tool IDs
	 * Only show tools that the selected model supports
	 */
	function getToolsForModel(modelId: string | undefined): Tool[] {
		if (!modelId) return availableTools; // Show all if no model selected
		const model = availableModels.find((m) => m.id === modelId);
		if (!model || !model.supportedTools || model.supportedTools.length === 0) {
			return availableTools; // Show all if model has no tool restrictions
		}
		// Filter to only tools supported by this model
		return availableTools.filter((tool) => model.supportedTools?.includes(tool.id));
	}

	let toolsByCategory = $derived.by(() => {
		const groups: Record<string, Tool[]> = {};
		// Get the selected model from LLM node if that's what we're editing
		const llmData = nodeType === 'llm' ? getLLMData() : null;
		const filteredTools = llmData ? getToolsForModel(llmData.model_id) : availableTools;

		for (const tool of filteredTools) {
			const category = tool.category ?? 'other';
			if (!groups[category]) groups[category] = [];
			groups[category].push(tool);
		}
		return groups;
	});

	// ============================================================================
	// Common Label State
	// ============================================================================

	let label = $state('');

	$effect(() => {
		label = node.data.label ?? '';
	});

	function updateLabel() {
		onUpdate({ label });
	}

	// ============================================================================
	// Knowledge Base Helpers (Start Node)
	// ============================================================================

	function toggleKnowledgeFile(fileId: string) {
		const data = getStartData();
		const currentFiles = data.knowledge_base ?? [];
		const newFiles = currentFiles.includes(fileId)
			? currentFiles.filter((f) => f !== fileId)
			: [...currentFiles, fileId];
		onUpdate({ knowledge_base: newFiles } as Partial<AllNodeData>);
	}

	// ============================================================================
	// Tools Helpers (LLM Node)
	// ============================================================================

	function toggleTool(toolId: string) {
		const data = getLLMData();
		const currentTools = data.tools ?? [];
		const newTools = currentTools.includes(toolId)
			? currentTools.filter((t) => t !== toolId)
			: [...currentTools, toolId];
		onUpdate({ tools: newTools } as Partial<AllNodeData>);
	}

	function updateToolParams(toolId: string, params: Record<string, unknown>) {
		const data = getLLMData();
		const currentParams = data.tool_params ?? {};
		onUpdate({
			tool_params: {
				...currentParams,
				[toolId]: params
			}
		} as Partial<AllNodeData>);
	}

	// ============================================================================
	// Category Helpers (Classifier Node)
	// ============================================================================

	function addCategory() {
		const data = getClassifierData();
		const categories = data.categories ?? [];
		const newId = `cat_${Date.now()}`;
		onUpdate({
			categories: [
				...categories,
				{ id: newId, label: `Category ${categories.length + 1}`, description: '' }
			]
		} as Partial<AllNodeData>);
	}

	function updateCategory(index: number, updates: Partial<ClassifierNodeData['categories'][0]>) {
		const data = getClassifierData();
		const categories = [...(data.categories ?? [])];
		categories[index] = { ...categories[index], ...updates };
		onUpdate({ categories } as Partial<AllNodeData>);
	}

	function removeCategory(index: number) {
		const data = getClassifierData();
		const categories = (data.categories ?? []).filter((_, i) => i !== index);
		onUpdate({ categories } as Partial<AllNodeData>);
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Header -->
	<div class="flex shrink-0 items-center justify-between border-b px-5 py-3.5">
		<div class="flex items-center gap-2">
			<Settings class="h-4 w-4 text-muted-foreground" />
			<h3 class="text-sm font-semibold capitalize">{nodeType} Node</h3>
		</div>
		<Badge variant="outline" class="text-xs">{node.id}</Badge>
	</div>

	<!-- Scrollable Content -->
	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="space-y-5 p-5">
			<!-- Common: Label -->
			<div class="space-y-2">
				<Label for="label">Label</Label>
				<Input id="label" bind:value={label} onblur={updateLabel} placeholder="Node label" />
			</div>

			<Separator />

			<!-- ================================================================ -->
			<!-- START NODE -->
			<!-- ================================================================ -->
			{#if nodeType === 'start'}
				{@const data = getStartData()}

				<!-- System Prompt -->
				<div class="space-y-2">
					<Label for="systemPrompt">System Prompt</Label>
					<Textarea
						id="systemPrompt"
						value={data.system_prompt ?? ''}
						onblur={(e) => onUpdate({ system_prompt: e.currentTarget.value })}
						placeholder="You are a helpful financial advisor assistant..."
						rows={6}
					/>
					<p class="text-xs text-muted-foreground">
						Applied to the first LLM node unless overridden
					</p>
				</div>

				<!-- Attribute Injection Helper -->
				{#if injectableAttributes.length > 0}
					<Collapsible.Root>
						<Collapsible.Trigger
							class="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50"
						>
							<div class="flex items-center gap-2">
								<Variable class="h-4 w-4" />
								<span>Dynamic Attributes</span>
							</div>
							<Badge variant="secondary" class="text-xs">
								{injectableAttributes.length} available
							</Badge>
						</Collapsible.Trigger>
						<Collapsible.Content class="mt-3 space-y-3 rounded-md border p-4">
							<p class="text-xs text-muted-foreground">
								Insert <code class="rounded bg-muted px-1">{'{{attribute}}'}</code> placeholders into
								prompts. Values are resolved at runtime from user data.
							</p>
							<div class="mt-2 max-h-56 space-y-1 overflow-y-auto">
								{#each injectableAttributes as attr}
									<button
										type="button"
										class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted/50"
										onclick={() => {
											// Copy placeholder to clipboard
											navigator.clipboard.writeText(`{{${attr.attribute_key}}}`);
											const toast = document.createElement('div');
											toast.className =
												'fixed bottom-4 right-4 bg-foreground text-background px-3 py-2 rounded-md text-sm z-50';
											toast.textContent = `Copied {{${attr.attribute_key}}} to clipboard`;
											document.body.appendChild(toast);
											setTimeout(() => toast.remove(), 2000);
										}}
										title="Click to copy placeholder"
									>
										<div>
											<div class="font-mono text-xs text-primary">
												{'{{' + attr.attribute_key + '}}'}
											</div>
											<div class="text-xs text-muted-foreground">{attr.display_name}</div>
										</div>
										<Badge variant="outline" class="text-xs">
											{attr.source_type}
										</Badge>
									</button>
								{/each}
							</div>
							<p class="text-xs text-muted-foreground">
								Click to copy • Paste into system prompt above
							</p>
						</Collapsible.Content>
					</Collapsible.Root>
				{/if}

				<!-- RAG / Knowledge Base Toggle -->
				<div class="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
					<div class="flex items-center gap-2">
						<FileText class="h-4 w-4 text-muted-foreground" />
						<Label for="ragEnabled" class="text-sm font-medium">Enable Knowledge Base + RAG</Label>
					</div>
					<Switch
						id="ragEnabled"
						checked={data.rag_enabled ?? true}
						onCheckedChange={(v) => onUpdate({ rag_enabled: v })}
					/>
				</div>

				<!-- Knowledge Base Files -->
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<FileText class="h-4 w-4 text-muted-foreground" />
						<Label>Knowledge Base</Label>
					</div>
					<p class="text-xs text-muted-foreground">Select files to include as agent context</p>
					<div class="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
						{#if systemUploads.length > 0}
							{#each systemUploads as file}
								{@const isSelected = (data.knowledge_base ?? []).includes(file.id)}
								<div class="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
									<Checkbox
										id={file.id}
										checked={isSelected}
										onCheckedChange={() => toggleKnowledgeFile(file.id)}
									/>
									<Label for={file.id} class="flex-1 cursor-pointer text-sm font-normal">
										<div class="truncate">{file.name}</div>
										<div class="text-xs text-muted-foreground">
											{file.type} • {(file.size / 1024).toFixed(1)} KB
										</div>
									</Label>
								</div>
							{/each}
						{:else}
							<p class="py-4 text-center text-sm text-muted-foreground">
								No system files available
							</p>
						{/if}
					</div>
					{#if (data.knowledge_base ?? []).length > 0}
						<Badge variant="secondary" class="text-xs">
							{(data.knowledge_base ?? []).length} file(s) selected
						</Badge>
					{/if}
				</div>

				<!-- File Enricher Template (Advanced) -->
				<Collapsible.Root>
					<Collapsible.Trigger
						class="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
					>
						<span>Advanced Settings</span>
						<Plus class="h-4 w-4" />
					</Collapsible.Trigger>
					<Collapsible.Content class="mt-2 space-y-2">
						<Label for="fileEnricher" class="text-xs">File Enricher Template</Label>
						<Textarea
							id="fileEnricher"
							value={data.file_enricher_template ?? ''}
							onblur={(e) => onUpdate({ file_enricher_template: e.currentTarget.value })}
							placeholder="The user uploaded 'filename': content"
							rows={3}
							class="font-mono text-xs"
						/>
					</Collapsible.Content>
				</Collapsible.Root>

				<!-- Context Management -->
				<Collapsible.Root>
					<Collapsible.Trigger
						class="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50"
					>
						<div class="flex items-center gap-2">
							<MessageSquare class="h-4 w-4" />
							<span>Context Management</span>
						</div>
						{#if data.context_management?.enabled}
							<Badge variant="secondary" class="text-xs">
								{data.context_management.strategy === 'sliding_window'
									? 'window'
									: 'window + summary'}
							</Badge>
						{:else}
							<Settings class="h-4 w-4" />
						{/if}
					</Collapsible.Trigger>
					<Collapsible.Content class="mt-2 space-y-3 rounded-md border p-3">
						<div class="flex items-center justify-between">
							<Label for="contextEnabled" class="text-sm">Enable Context Management</Label>
							<Switch
								id="contextEnabled"
								checked={data.context_management?.enabled ?? false}
								onCheckedChange={(v) =>
									onUpdate({
										context_management: {
											enabled: v,
											strategy: data.context_management?.strategy ?? 'sliding_window',
											sliding_window_size: data.context_management?.sliding_window_size ?? 10
										}
									})}
							/>
						</div>
						<p class="text-xs text-muted-foreground">
							Manage conversation context for long chats. A hard limit of 150 messages is always
							enforced.
						</p>

						{#if data.context_management?.enabled}
							<div class="space-y-3">
								<!-- Strategy -->
								<div class="space-y-1">
									<Label class="text-xs">Strategy</Label>
									<Select.Root
										type="single"
										value={data.context_management.strategy}
										onValueChange={(v) => {
											const strategy = v as 'sliding_window' | 'hybrid';
											const update: typeof data.context_management = {
												...data.context_management!,
												strategy
											};
											// Pre-select first available model/prompt when switching to hybrid
											if (
												strategy === 'hybrid' &&
												!data.context_management?.summarization?.model_id
											) {
												update.summarization = {
													trigger_threshold:
														data.context_management?.summarization?.trigger_threshold ?? 5,
													model_id: availableModels[0]?.id ?? '',
													prompt_key: availablePrompts[0]?.promptKey ?? ''
												};
											}
											onUpdate({ context_management: update });
										}}
									>
										<Select.Trigger class="w-full text-sm">
											{data.context_management.strategy === 'sliding_window'
												? 'Sliding Window'
												: 'Sliding Window + Summary'}
										</Select.Trigger>
										<Select.Content>
											<Select.Item value="sliding_window">Sliding Window</Select.Item>
											<Select.Item value="hybrid">Sliding Window + Summary</Select.Item>
										</Select.Content>
									</Select.Root>
									<p class="text-xs text-muted-foreground">
										{#if data.context_management.strategy === 'sliding_window'}
											Keep only the last N messages, drop older ones
										{:else}
											Keep last N messages + auto-summarize older messages
										{/if}
									</p>
								</div>

								<!-- Sliding Window Size -->
								<div class="space-y-1">
									<Label for="windowSize" class="text-xs">Window Size (messages)</Label>
									<Input
										id="windowSize"
										type="number"
										min={2}
										max={50}
										value={data.context_management.sliding_window_size}
										onblur={(e) =>
											onUpdate({
												context_management: {
													...data.context_management!,
													sliding_window_size: parseInt(e.currentTarget.value) || 10
												}
											})}
									/>
								</div>

								<!-- Summarization Config (for hybrid strategy) -->
								{#if data.context_management.strategy === 'hybrid'}
									<Separator />
									<p class="text-xs font-medium">Summarization Settings</p>

									<div class="space-y-1">
										<Label for="triggerThreshold" class="text-xs">Trigger Threshold</Label>
										<Input
											id="triggerThreshold"
											type="number"
											min={1}
											max={50}
											value={data.context_management.summarization?.trigger_threshold ?? 5}
											onblur={(e) =>
												onUpdate({
													context_management: {
														...data.context_management!,
														summarization: {
															trigger_threshold: parseInt(e.currentTarget.value) || 5,
															model_id: data.context_management?.summarization?.model_id ?? '',
															prompt_key: data.context_management?.summarization?.prompt_key ?? ''
														}
													}
												})}
										/>
										<p class="text-xs text-muted-foreground">
											Messages beyond window before summarizing
										</p>
									</div>

									<div class="space-y-1">
										<Label class="text-xs">Summarization Model</Label>
										<Select.Root
											type="single"
											value={data.context_management.summarization?.model_id ?? ''}
											onValueChange={(v) =>
												onUpdate({
													context_management: {
														...data.context_management!,
														summarization: {
															...data.context_management?.summarization,
															trigger_threshold:
																data.context_management?.summarization?.trigger_threshold ?? 5,
															model_id: v,
															prompt_key: data.context_management?.summarization?.prompt_key ?? ''
														}
													}
												})}
										>
											<Select.Trigger class="w-full text-sm">
												{#if data.context_management.summarization?.model_id}
													{@const model = availableModels.find(
														(m) => m.id === data.context_management?.summarization?.model_id
													)}
													{model?.displayName ?? 'Select model'}
												{:else}
													<span class="text-muted-foreground">Select model</span>
												{/if}
											</Select.Trigger>
											<Select.Content>
												{#each availableModels as model}
													<Select.Item value={model.id}>
														{model.displayName}
													</Select.Item>
												{/each}
											</Select.Content>
										</Select.Root>
									</div>

									<div class="space-y-1">
										<Label class="text-xs">Summarization Prompt</Label>
										<Select.Root
											type="single"
											value={data.context_management.summarization?.prompt_key ?? ''}
											onValueChange={(v) =>
												onUpdate({
													context_management: {
														...data.context_management!,
														summarization: {
															...data.context_management?.summarization,
															trigger_threshold:
																data.context_management?.summarization?.trigger_threshold ?? 5,
															model_id: data.context_management?.summarization?.model_id ?? '',
															prompt_key: v
														}
													}
												})}
										>
											<Select.Trigger class="w-full text-sm">
												{#if data.context_management.summarization?.prompt_key}
													{@const prompt = availablePrompts.find(
														(p) =>
															p.promptKey === data.context_management?.summarization?.prompt_key
													)}
													{prompt?.displayName ?? data.context_management.summarization.prompt_key}
												{:else}
													<span class="text-muted-foreground">Select prompt</span>
												{/if}
											</Select.Trigger>
											<Select.Content>
												{#each availablePrompts as prompt}
													<Select.Item value={prompt.promptKey ?? ''}>
														<div class="flex flex-col">
															<span>{prompt.displayName}</span>
															<span class="text-xs text-muted-foreground">
																{prompt.promptKey}
															</span>
														</div>
													</Select.Item>
												{/each}
											</Select.Content>
										</Select.Root>
										<p class="text-xs text-muted-foreground">
											Prompt template for summarizing conversation history
										</p>
									</div>
								{/if}
							</div>
						{/if}
					</Collapsible.Content>
				</Collapsible.Root>
			{/if}

			<!-- ================================================================ -->
			<!-- LLM NODE -->
			<!-- ================================================================ -->
			{#if nodeType === 'llm'}
				{@const data = getLLMData()}
				{@const selectedModel = getSelectedModel(data.model_id)}

				<!-- Model Selection -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Bot class="h-4 w-4 text-muted-foreground" />
							<Label>Pin to specific model</Label>
						</div>
						<Switch
							checked={pinModelEnabled}
							onCheckedChange={(v) => {
								pinModelEnabled = !!v;
								if (!v) {
									onUpdate({ model_id: undefined, model_name: undefined });
								}
							}}
						/>
					</div>
					{#if !pinModelEnabled}
						<p class="text-xs text-muted-foreground">
							Uses the user's selected model at runtime (user preference → system default).
						</p>
					{:else}
						<Select.Root
							type="single"
							value={data.model_id ?? ''}
							onValueChange={(v) => {
								const model = availableModels.find((m) => m.id === v);
								// Filter out tools that the new model doesn't support
								const currentTools = data.tools ?? [];
								const supportedTools = model?.supportedTools ?? [];
								const filteredTools =
									supportedTools.length > 0
										? currentTools.filter((toolId) => supportedTools.includes(toolId))
										: currentTools;
								onUpdate({
									model_id: v,
									model_name: model?.displayName ?? v,
									tools: filteredTools
								});
							}}
						>
							<Select.Trigger class="w-full">
								{#if selectedModel}
									<div class="flex items-center gap-2">
										<span>{selectedModel.displayName}</span>
										<span class="text-xs text-muted-foreground">
											({getProviderName(selectedModel)})
										</span>
									</div>
								{:else}
									<span class="text-muted-foreground">Select a model</span>
								{/if}
							</Select.Trigger>
							<Select.Content>
								{#each availableModels as model}
									<Select.Item value={model.id}>
										<div class="flex flex-col">
											<span>{model.displayName}</span>
											<span class="text-xs text-muted-foreground">
												{getProviderName(model)} • {model.modelId}
											</span>
										</div>
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						{#if selectedModel}
							<div class="flex flex-wrap gap-1">
								{#if selectedModel.contextWindow}
									<Badge variant="outline" class="text-xs">
										{(Number(selectedModel.contextWindow) / 1000).toFixed(0)}K ctx
									</Badge>
								{/if}
								{#if selectedModel.maxOutputTokens}
									<Badge variant="outline" class="text-xs">
										{(Number(selectedModel.maxOutputTokens) / 1000).toFixed(0)}K out
									</Badge>
								{/if}
							</div>
						{/if}
					{/if}
				</div>

				<!-- Model Options (Dynamic from options_schema) -->
				{#if selectedModel?.optionsSchema}
					<Collapsible.Root open>
						<Collapsible.Trigger
							class="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50"
						>
							<span>Model Options</span>
							<Settings class="h-4 w-4" />
						</Collapsible.Trigger>
						<Collapsible.Content class="mt-3 rounded-md border p-4">
							<SchemaForm
								schema={selectedModel.optionsSchema}
								values={data.provider_options ?? {}}
								onUpdate={(v) => onUpdate({ provider_options: v })}
								compact
							/>
						</Collapsible.Content>
					</Collapsible.Root>
				{/if}

				<!-- System Prompt Override -->
				<div class="space-y-2">
					<Label for="llmSystemPrompt">System Prompt (Override)</Label>
					<Textarea
						id="llmSystemPrompt"
						value={data.system_prompt ?? ''}
						onblur={(e) => onUpdate({ system_prompt: e.currentTarget.value })}
						placeholder="Leave empty to use Start node prompt..."
						rows={4}
					/>
				</div>

				<!-- Attribute Injection Helper for LLM Node -->
				{#if injectableAttributes.length > 0}
					<Collapsible.Root>
						<Collapsible.Trigger
							class="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50"
						>
							<div class="flex items-center gap-2">
								<Variable class="h-4 w-4" />
								<span>Dynamic Attributes</span>
							</div>
							<Badge variant="secondary" class="text-xs">
								{injectableAttributes.length} available
							</Badge>
						</Collapsible.Trigger>
						<Collapsible.Content class="mt-3 space-y-3 rounded-md border p-4">
							<p class="text-xs text-muted-foreground">
								Insert <code class="rounded bg-muted px-1">{'{{attribute}}'}</code> placeholders. Values
								are resolved at runtime.
							</p>
							<div class="mt-2 max-h-48 space-y-1 overflow-y-auto">
								{#each injectableAttributes as attr}
									<button
										type="button"
										class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted/50"
										onclick={() => {
											navigator.clipboard.writeText(`{{${attr.attribute_key}}}`);
											const toast = document.createElement('div');
											toast.className =
												'fixed bottom-4 right-4 bg-foreground text-background px-3 py-2 rounded-md text-sm z-50';
											toast.textContent = `Copied {{${attr.attribute_key}}} to clipboard`;
											document.body.appendChild(toast);
											setTimeout(() => toast.remove(), 2000);
										}}
										title="Click to copy placeholder"
									>
										<div>
											<div class="font-mono text-xs text-primary">
												{'{{' + attr.attribute_key + '}}'}
											</div>
											<div class="text-xs text-muted-foreground">{attr.display_name}</div>
										</div>
										<Badge variant="outline" class="text-xs">
											{attr.category}
										</Badge>
									</button>
								{/each}
							</div>
						</Collapsible.Content>
					</Collapsible.Root>
				{/if}

				<!-- Tools Selection -->
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<Wrench class="h-4 w-4 text-muted-foreground" />
						<Label>Tools</Label>
					</div>
					<p class="text-xs text-muted-foreground">
						{#if selectedModel}
							Showing tools supported by {selectedModel.displayName}
						{:else}
							Select a model to see compatible tools
						{/if}
					</p>
					<div class="mt-2 max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
						{#each Object.entries(toolsByCategory) as [category, tools]}
							<div>
								<p class="mb-1 text-xs font-medium text-muted-foreground capitalize">{category}</p>
								<div class="space-y-1">
									{#each tools as tool}
										{@const isSelected = (data.tools ?? []).includes(tool.id)}
										<div class="flex items-center gap-2">
											<Checkbox
												id={`tool-${tool.id}`}
												checked={isSelected}
												onCheckedChange={() => toggleTool(tool.id)}
											/>
											<Label
												for={`tool-${tool.id}`}
												class="flex-1 cursor-pointer text-sm font-normal"
											>
												{tool.displayName}
											</Label>
											{#if isSelected && tool.configSchema}
												<Button variant="ghost" size="icon" class="h-6 w-6" title="Configure tool">
													<Settings class="h-3 w-3" />
												</Button>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/each}
						{#if availableTools.length === 0}
							<p class="text-center text-sm text-muted-foreground">No tools available</p>
						{/if}
					</div>
					{#if (data.tools ?? []).length > 0}
						<Badge variant="secondary" class="text-xs">
							{(data.tools ?? []).length} tool(s) selected
						</Badge>
					{/if}
				</div>

				<!-- Tool Configurations (for selected SDK tools with config_schema, not builtin) -->
				{#each data.tools ?? [] as toolId}
					{@const tool = availableTools.find((t) => t.id === toolId)}
					{#if tool?.configSchema && tool.toolType !== 'builtin'}
						<Collapsible.Root>
							<Collapsible.Trigger
								class="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50"
							>
								<span>{tool.displayName} Config</span>
								<Settings class="h-4 w-4" />
							</Collapsible.Trigger>
							<Collapsible.Content class="mt-3 rounded-md border p-4">
								<SchemaForm
									schema={tool.configSchema}
									values={(data.tool_params?.[toolId] ?? tool.defaultConfig ?? {}) as Record<
										string,
										unknown
									>}
									onUpdate={(v) => updateToolParams(toolId, v)}
									compact
								/>
							</Collapsible.Content>
						</Collapsible.Root>
					{/if}
				{/each}
			{/if}

			<!-- ================================================================ -->
			<!-- CLASSIFIER NODE -->
			<!-- ================================================================ -->
			{#if nodeType === 'classifier'}
				{@const data = getClassifierData()}
				{@const selectedModel = getSelectedModel(data.model_id)}

				<!-- Classifier Type -->
				<div class="space-y-2">
					<Label>Classifier Type</Label>
					<Select.Root
						type="single"
						value={data.classifier_type ?? 'llm'}
						onValueChange={(v) => onUpdate({ classifier_type: v as 'llm' | 'keyword' | 'regex' })}
					>
						<Select.Trigger class="w-full">
							{data.classifier_type ?? 'llm'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="llm">LLM Classification</Select.Item>
							<Select.Item value="keyword">Keyword Matching</Select.Item>
							<Select.Item value="regex">Regex Pattern</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<!-- Model Selection (for LLM type) -->
				{#if data.classifier_type === 'llm' || !data.classifier_type}
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<Bot class="h-4 w-4 text-muted-foreground" />
							<Label>Classification Model</Label>
						</div>
						<Select.Root
							type="single"
							value={data.model_id ?? ''}
							onValueChange={(v) => {
								const model = availableModels.find((m) => m.id === v);
								onUpdate({ model_id: v, model_name: model?.displayName ?? v });
							}}
						>
							<Select.Trigger class="w-full">
								{#if selectedModel}
									<span>{selectedModel.displayName}</span>
								{:else}
									<span class="text-muted-foreground">Select a model (or use default)</span>
								{/if}
							</Select.Trigger>
							<Select.Content>
								{#each availableModels as model}
									<Select.Item value={model.id}>
										{model.displayName}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<p class="text-xs text-muted-foreground">Leave empty to use a fast default model</p>
					</div>

					<!-- Classification Prompt -->
					<div class="space-y-2">
						<Label for="classificationPrompt">Classification Prompt</Label>
						<Textarea
							id="classificationPrompt"
							value={data.classification_prompt ?? ''}
							onblur={(e) => onUpdate({ classification_prompt: e.currentTarget.value })}
							placeholder="Classify the user request into categories..."
							rows={4}
						/>
						<p class="text-xs text-muted-foreground">
							Use {'{{message}}'} for user input. Categories will be appended.
						</p>
					</div>
				{/if}

				<!-- Categories -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label>Categories</Label>
						<Button variant="outline" size="sm" class="h-7 gap-1 text-xs" onclick={addCategory}>
							<Plus class="h-3 w-3" />
							Add
						</Button>
					</div>
					<div class="space-y-2">
						{#each data.categories ?? [] as category, index}
							<div class="space-y-2 rounded-md border p-2">
								<div class="flex items-center gap-2">
									<Input
										value={category.label}
										onblur={(e) => updateCategory(index, { label: e.currentTarget.value })}
										class="flex-1 text-sm"
										placeholder="Category name"
									/>
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8"
										onclick={() => removeCategory(index)}
									>
										<X class="h-4 w-4" />
									</Button>
								</div>
								<Input
									value={category.description ?? ''}
									onblur={(e) => updateCategory(index, { description: e.currentTarget.value })}
									class="text-xs"
									placeholder="e.g. Questions about account balance, payments..."
								/>
								<p class="text-xs text-muted-foreground">
									Helps LLM understand when to route to this category
								</p>
								{#if data.classifier_type === 'keyword'}
									<Input
										value={(category.keywords ?? []).join(', ')}
										onblur={(e) =>
											updateCategory(index, {
												keywords: e.currentTarget.value
													.split(',')
													.map((k: string) => k.trim())
													.filter(Boolean)
											})}
										class="text-xs"
										placeholder="Keywords (comma-separated)"
									/>
								{/if}
								{#if data.classifier_type === 'regex'}
									<Input
										value={category.pattern ?? ''}
										onblur={(e) => updateCategory(index, { pattern: e.currentTarget.value })}
										class="font-mono text-xs"
										placeholder="Regex pattern"
									/>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- Prompt Preview (LLM only) -->
				{#if data.classifier_type === 'llm' || !data.classifier_type}
					{@const categoryDescriptions = (data.categories ?? [])
						.map((c) => `- ${c.id}: ${c.description || c.label}`)
						.join('\n')}
					{@const previewPrompt =
						data.classification_prompt ||
						`Classify the following input into one of these categories:\n${categoryDescriptions}\n\nInput: {{user_message}}\n\nRespond with ONLY the category id.`}
					<Collapsible.Root>
						<Collapsible.Trigger
							class="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
						>
							<span>Preview Generated Prompt</span>
							<Settings class="h-4 w-4" />
						</Collapsible.Trigger>
						<Collapsible.Content class="mt-2">
							<pre
								class="max-h-56 overflow-auto rounded-md border bg-muted/30 p-2 text-xs leading-relaxed whitespace-pre-wrap">{previewPrompt}</pre>
						</Collapsible.Content>
					</Collapsible.Root>
				{/if}

				<!-- Confidence Threshold -->
				{#if data.classifier_type === 'llm' || !data.classifier_type}
					<div class="space-y-2">
						<Label for="confidence" class="text-xs">Confidence Threshold</Label>
						<Input
							id="confidence"
							type="number"
							min={0}
							max={1}
							step={0.1}
							value={data.confidence_threshold ?? 0.7}
							onblur={(e) => onUpdate({ confidence_threshold: parseFloat(e.currentTarget.value) })}
						/>
					</div>
				{/if}

				<!-- How It Works Info Block -->
				<div class="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
					<p class="mb-2 text-xs font-medium text-blue-400">How Classification Works</p>
					<div class="space-y-2 text-xs text-muted-foreground">
						<p>The classifier builds a prompt using your categories:</p>
						<pre
							class="rounded bg-muted/50 p-2 leading-relaxed whitespace-pre-wrap">Classify the following input into one of these categories:
- cat_1: {'<description or label>'}
- cat_2: {'<description or label>'}

Input: {'<user message>'}

Respond with ONLY the category id.</pre>
						<p class="text-xs italic">
							💡 Add descriptions to help the LLM understand when to route to each category.
						</p>
					</div>
				</div>
			{/if}

			<!-- ================================================================ -->
			<!-- END NODE -->
			<!-- ================================================================ -->
			{#if nodeType === 'end'}
				{@const data = getEndData()}

				<!-- End Type -->
				<div class="space-y-2">
					<Label>End Type</Label>
					<Select.Root
						type="single"
						value={data.end_type ?? 'success'}
						onValueChange={(v) => onUpdate({ end_type: v as 'success' | 'error' | 'handoff' })}
					>
						<Select.Trigger class="w-full">
							{data.end_type ?? 'success'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="success">Success</Select.Item>
							<Select.Item value="error">Error</Select.Item>
							<Select.Item value="handoff">Handoff</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<!-- Response Template -->
				<div class="space-y-2">
					<Label for="responseTemplate">Response Template</Label>
					<Textarea
						id="responseTemplate"
						value={data.response_template ?? ''}
						onblur={(e) => onUpdate({ response_template: e.currentTarget.value })}
						placeholder="Response output goes here"
						rows={3}
						class="font-mono text-sm"
					/>
					<p class="text-xs text-muted-foreground">
						Use {'{{response}}'} for the final output
					</p>
				</div>

				{#if data.end_type === 'error'}
					<div class="space-y-2">
						<Label for="errorMessage">Error Message</Label>
						<Input
							id="errorMessage"
							value={data.error_message ?? ''}
							onblur={(e) => onUpdate({ error_message: e.currentTarget.value })}
							placeholder="An error occurred"
						/>
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Footer: Delete Button -->
	<div class="shrink-0 border-t p-5">
		<Button variant="destructive" class="w-full" onclick={onDelete}>
			<Trash2 class="mr-2 h-4 w-4" />
			Delete Node
		</Button>
	</div>
</div>
