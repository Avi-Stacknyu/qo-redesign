<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
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

<div class="relative mx-auto w-full max-w-7xl space-y-6">
	<div class="flex flex-col gap-5 rounded-[2rem] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-6 lg:flex-row lg:items-center lg:justify-between">
		<Button variant="secondary" size="icon" href="/tools" class="size-12 shrink-0 rounded-full bg-[#F6F6F6] text-[#83899F] shadow-none hover:bg-[#EFEFEF]">
			<ArrowLeft class="size-4" />
		</Button>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h1 class="text-3xl font-bold tracking-tight text-[#1F1F1F] lg:text-4xl">
					{tool.display_name}
				</h1>
				{#if tool.category}
					<Badge variant="secondary" class="capitalize">{tool.category}</Badge>
				{/if}
			</div>
			{#if tool.description}
				<p class="mt-2 max-w-4xl text-base leading-7 text-[#83899F]">{tool.description}</p>
			{/if}
		</div>
		{#if pastResults.length > 0}
			<Button variant="secondary" class="h-12 rounded-full bg-[#1F1F1F] px-6 text-base font-semibold text-white shadow-none hover:bg-[#2A2A2A]" onclick={() => (showHistory = !showHistory)}>
				<History class="mr-1.5 size-3.5" />
				History ({pastResults.length})
			</Button>
		{/if}
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Input Form -->
		<div class="lg:col-span-1">
			<Card.Root class="rounded-[2rem] border-0 bg-white py-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
				<Card.Header>
					<Card.Title class="text-xl font-bold text-[#1F1F1F]">Input Parameters</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4 pb-5">
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

					<Button class="h-12 w-full rounded-full bg-[#1F1F1F] text-base font-semibold text-white shadow-none hover:bg-[#2A2A2A]" onclick={handleRun} disabled={running}>
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
							<Card.Root size="sm" class="rounded-[1.5rem] border-0 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
								<p class="text-xs font-medium text-[#83899F] capitalize">
									{key.replace(/_/g, ' ')}
								</p>
								<p class="mt-1 text-xl font-bold text-[#1F1F1F]">
									{typeof value === 'number' ? value.toLocaleString() : value}
								</p>
							</Card.Root>
						{/each}
					</div>
				{/if}

				<!-- Data Tables -->
				{#each Object.entries(result.data) as [dataKey, dataset] (dataKey)}
					<Card.Root class="mb-4 rounded-[2rem] border-0 bg-white py-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
						<Card.Header>
							<Card.Title class="text-base capitalize">
								{dataKey.replace(/_/g, ' ')}
							</Card.Title>
						</Card.Header>
						<Card.Content class="pb-5">
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
				<Card.Root class="flex min-h-100 flex-col items-center justify-center rounded-[2rem] border-0 bg-white py-20 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
					<FlaskConical class="mb-3 size-10 text-violet-500" />
					<p class="text-lg font-semibold text-[#1F1F1F]">No results yet</p>
					<p class="text-sm text-[#83899F]">
						Configure your inputs and click "Run Analysis" to get started.
					</p>
				</Card.Root>
			{/if}
		</div>
	</div>

	<!-- History Panel -->
	{#if showHistory && pastResults.length > 0}
		<Card.Root class="rounded-[2rem] border-0 bg-white py-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
			<Card.Header>
				<Card.Title class="text-base">Past Results</Card.Title>
			</Card.Header>
			<Card.Content class="pb-5">
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
