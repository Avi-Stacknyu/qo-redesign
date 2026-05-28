<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Input } from '$lib/components/shadcn/input';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Badge } from '$lib/components/shadcn/badge';
	import * as Select from '$lib/components/shadcn/select';
	import { ArrowLeft, Play, Loader2, History, FlaskConical } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { runTool } from '$lib/remote/tools.remote';
	import { invalidateAll } from '$app/navigation';
	import type { ToolInputField, ToolExecutionResult } from '@repo/shared/types';

	let { data } = $props();

	let tool = $derived(data.tool);
	let inputSchema = $derived((tool.input_schema ?? []) as ToolInputField[]);
	let pastResults = $derived(data.pastResults);

	let inputValues = $state<Record<string, unknown>>({});
	let running = $state(false);
	let result = $state<ToolExecutionResult | null>(null);
	let showHistory = $state(false);

	// Initialize defaults from schema
	$effect(() => {
		const defaults: Record<string, unknown> = {};
		for (const field of inputSchema) {
			defaults[field.key] = field.defaultValue ?? '';
		}
		inputValues = defaults;
	});

	async function handleRun() {
		running = true;
		result = null;
		try {
			const response = await runTool({
				toolKey: tool.tool_key,
				inputParams: inputValues
			});
			if (response.success && response.result) {
				result = response.result as ToolExecutionResult;
				toast.success('Analysis complete');
				await invalidateAll();
			} else {
				toast.error(response.error || 'Tool execution failed');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Tool execution failed');
		} finally {
			running = false;
		}
	}

	function renderFieldValue(key: string): string {
		const val = inputValues[key];
		if (val === undefined || val === null) return '';
		return String(val);
	}
</script>

<div class="relative mx-auto w-full max-w-7xl">
	<!-- Header -->
	<div class="mb-8 flex items-center gap-3">
		<Button variant="ghost" size="sm" href="/tools">
			<ArrowLeft class="size-4" />
		</Button>
		<div class="flex-1">
			<div class="flex items-center gap-2">
				<h1 class="text-3xl font-light tracking-tight text-foreground lg:text-4xl">
					{tool.display_name}
				</h1>
				{#if tool.category}
					<Badge variant="secondary" class="capitalize">{tool.category}</Badge>
				{/if}
			</div>
			{#if tool.description}
				<p class="mt-1 text-sm text-muted-foreground">{tool.description}</p>
			{/if}
		</div>
		{#if pastResults.length > 0}
			<Button variant="outline" size="sm" onclick={() => (showHistory = !showHistory)}>
				<History class="mr-1.5 size-3.5" />
				History ({pastResults.length})
			</Button>
		{/if}
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Input Form -->
		<div class="lg:col-span-1">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">Input Parameters</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if inputSchema.length === 0}
						<p class="text-sm text-muted-foreground">This tool has no configurable inputs yet.</p>
					{:else}
						{#each inputSchema as field (field.key)}
							<div class="space-y-1.5">
								<Label for="field-{field.key}">
									{field.label}
									{#if field.required}
										<span class="text-destructive">*</span>
									{/if}
								</Label>
								{#if field.type === 'select' && field.options}
									<Select.Root
										type="single"
										value={renderFieldValue(field.key)}
										onValueChange={(v) => (inputValues[field.key] = v)}
									>
										<Select.Trigger id="field-{field.key}">
											{renderFieldValue(field.key) || 'Select…'}
										</Select.Trigger>
										<Select.Content>
											{#each field.options as opt (opt.value)}
												<Select.Item value={opt.value}>{opt.label}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								{:else if field.type === 'number'}
									<Input
										id="field-{field.key}"
										type="number"
										value={renderFieldValue(field.key)}
										oninput={(e) =>
											(inputValues[field.key] = parseFloat(e.currentTarget.value) || 0)}
										placeholder={field.placeholder}
										min={field.validation?.min}
										max={field.validation?.max}
									/>
								{:else if field.type === 'json' || field.type === 'array'}
									<Textarea
										id="field-{field.key}"
										value={renderFieldValue(field.key)}
										oninput={(e) => (inputValues[field.key] = e.currentTarget.value)}
										placeholder={field.placeholder || 'Enter JSON…'}
										rows={4}
										class="font-mono text-xs"
									/>
								{:else if field.type === 'toggle'}
									<label class="flex items-center gap-2">
										<input
											type="checkbox"
											checked={!!inputValues[field.key]}
											onchange={(e) => (inputValues[field.key] = e.currentTarget.checked)}
											class="size-4 rounded border"
										/>
										<span class="text-sm">{field.label}</span>
									</label>
								{:else}
									<Input
										id="field-{field.key}"
										type="text"
										value={renderFieldValue(field.key)}
										oninput={(e) => (inputValues[field.key] = e.currentTarget.value)}
										placeholder={field.placeholder}
									/>
								{/if}
							</div>
						{/each}
					{/if}

					<Button class="w-full" onclick={handleRun} disabled={running}>
						{#if running}
							<Loader2 class="mr-2 size-4 animate-spin" />
							Running…
						{:else}
							<Play class="mr-2 size-4" />
							Run Analysis
						{/if}
					</Button>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Results -->
		<div class="lg:col-span-2">
			{#if result}
				<!-- Metrics -->
				{#if result.metrics}
					<div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
						{#each Object.entries(result.metrics) as [key, value] (key)}
							<Card.Root class="p-4">
								<p class="text-xs font-medium text-muted-foreground capitalize">
									{key.replace(/_/g, ' ')}
								</p>
								<p class="mt-1 text-xl font-bold">
									{typeof value === 'number' ? value.toLocaleString() : value}
								</p>
							</Card.Root>
						{/each}
					</div>
				{/if}

				<!-- Data Tables -->
				{#each Object.entries(result.data) as [dataKey, dataset] (dataKey)}
					<Card.Root class="mb-4">
						<Card.Header>
							<Card.Title class="text-base capitalize">
								{dataKey.replace(/_/g, ' ')}
							</Card.Title>
						</Card.Header>
						<Card.Content>
							{#if dataset.rows.length === 0}
								<p class="text-sm text-muted-foreground">No data</p>
							{:else}
								<div class="overflow-x-auto">
									<table class="w-full text-sm">
										<thead>
											<tr class="border-b">
												{#each dataset.columns as col (col.key)}
													<th class="px-3 py-2 text-left font-medium text-muted-foreground">
														{col.label}
													</th>
												{/each}
											</tr>
										</thead>
										<tbody>
											{#each dataset.rows as row, i (i)}
												<tr class="border-b border-border/50 last:border-0">
													{#each dataset.columns as col (col.key)}
														{@const cellValue = (row as Record<string, unknown>)[col.key]}
														<td class="px-3 py-2">
															{#if col.type === 'number' && typeof cellValue === 'number'}
																{cellValue.toLocaleString()}
															{:else}
																{cellValue ?? '-'}
															{/if}
														</td>
													{/each}
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</Card.Content>
					</Card.Root>
				{/each}
			{:else}
				<div
					class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 py-20"
				>
					<FlaskConical class="mb-3 size-10 text-muted-foreground/30" />
					<p class="text-lg font-medium text-muted-foreground">No results yet</p>
					<p class="text-sm text-muted-foreground/70">
						Configure your inputs and click "Run Analysis" to get started.
					</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- History Panel -->
	{#if showHistory && pastResults.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">Past Results</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="space-y-2">
					{#each pastResults as past (past.id)}
						<button
							type="button"
							class="flex w-full items-center justify-between rounded-lg border border-border/50 px-4 py-3 text-left transition-colors hover:bg-accent"
							onclick={() => {
								result = past.data as ToolExecutionResult;
								showHistory = false;
							}}
						>
							<div>
								<p class="text-sm font-medium">{past.display_name}</p>
								<p class="text-xs text-muted-foreground">
									{new Date(past.created).toLocaleDateString()}
								</p>
							</div>
							<Badge variant="outline">{past.tool_key}</Badge>
						</button>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
