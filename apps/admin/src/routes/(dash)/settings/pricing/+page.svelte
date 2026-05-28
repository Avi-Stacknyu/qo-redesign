<script lang="ts">
	import { RemoteSnapInputField } from '$lib/components/formComp';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import * as Card from '$lib/components/shadcn/card';
	import * as Table from '$lib/components/shadcn/table';
	import * as Tabs from '$lib/components/shadcn/tabs';
	import {
		createCreditExchangeRate,
		getPricingAdminData,
		setInfraConfigPricing,
		setModelPricing,
		setToolPricing
	} from '$lib/remote/pricing.remote';
	import { Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	type ModelPricingForm = ReturnType<(typeof setModelPricing)['for']>;
	type ToolPricingForm = ReturnType<(typeof setToolPricing)['for']>;
	type InfraConfigPricingForm = ReturnType<(typeof setInfraConfigPricing)['for']>;

	type ModelRow = Record<string, any>;
	type ToolRow = Record<string, any>;
	type ConfigRow = Record<string, any>;

	const admin = await getPricingAdminData();

	let rates = $derived<any[]>(admin?.rates ?? []);
	let exchangeRates = $derived<any[]>(admin?.exchangeRates ?? []);
	let models = $derived<ModelRow[]>(admin?.models ?? []);
	let tools = $derived<ToolRow[]>(admin?.tools ?? []);
	let configs = $derived<ConfigRow[]>(admin?.configs ?? []);

	let activeExchangeRate = $derived(exchangeRates.find((r) => r.isActive) ?? exchangeRates[0]);

	let editing = $state<
		| { kind: 'model'; id: string }
		| { kind: 'tool'; id: string }
		| { kind: 'config'; id: string }
		| null
	>(null);

	const modelForms = new Map<string, ModelPricingForm>();
	const toolForms = new Map<string, ToolPricingForm>();
	const configForms = new Map<string, InfraConfigPricingForm>();

	function getModelForm(id: string): ModelPricingForm {
		let form = modelForms.get(id);
		if (!form) {
			form = setModelPricing.for(id);
			modelForms.set(id, form);
		}
		return form;
	}

	function getToolForm(id: string): ToolPricingForm {
		let form = toolForms.get(id);
		if (!form) {
			form = setToolPricing.for(id);
			toolForms.set(id, form);
		}
		return form;
	}

	function getConfigForm(id: string): InfraConfigPricingForm {
		let form = configForms.get(id);
		if (!form) {
			form = setInfraConfigPricing.for(id);
			configForms.set(id, form);
		}
		return form;
	}

	function fmtPrice(value: string | number | null | undefined, digits = 6) {
		const n = Number(value);
		if (!Number.isFinite(n)) return (0).toFixed(digits);
		return n.toFixed(digits);
	}

	function pricingOf(row: { expand?: { current_pricing?: any } }) {
		return row.expand?.current_pricing ?? null;
	}

	function toggleModelEditor(model: ModelRow) {
		const isOpen = editing?.kind === 'model' && editing.id === model.id;
		if (isOpen) {
			closeEditor();
			return;
		}
		const modelForm = getModelForm(model.id);
		modelForm.fields.set({
			modelId: model.id,
			input_price_per_1m: pricingOf(model)?.inputPricePer1M ?? undefined,
			output_price_per_1m: pricingOf(model)?.outputPricePer1M ?? undefined,
			cached_input_price_per_1m: pricingOf(model)?.cachedInputPricePer1M ?? undefined,
			reasoning_price_per_1m: pricingOf(model)?.reasoningPricePer1M ?? undefined,
			price_per_call: pricingOf(model)?.pricePerCall ?? undefined,
			price_per_image: pricingOf(model)?.pricePerImage ?? undefined,
			notes: pricingOf(model)?.notes ?? undefined
		});
		editing = { kind: 'model', id: model.id };
	}

	function toggleToolEditor(tool: ToolRow) {
		const isOpen = editing?.kind === 'tool' && editing.id === tool.id;
		if (isOpen) {
			closeEditor();
			return;
		}
		const toolForm = getToolForm(tool.id);
		toolForm.fields.set({
			toolId: tool.id,
			input_price_per_1m: pricingOf(tool)?.inputPricePer1M ?? undefined,
			output_price_per_1m: pricingOf(tool)?.outputPricePer1M ?? undefined,
			price_per_call: pricingOf(tool)?.pricePerCall ?? undefined,
			price_per_image: pricingOf(tool)?.pricePerImage ?? undefined,
			notes: pricingOf(tool)?.notes ?? undefined
		});
		editing = { kind: 'tool', id: tool.id };
	}

	function toggleConfigEditor(cfg: ConfigRow) {
		const isOpen = editing?.kind === 'config' && editing.id === cfg.id;
		if (isOpen) {
			closeEditor();
			return;
		}
		const configForm = getConfigForm(cfg.id);
		configForm.fields.set({
			configId: cfg.id,
			input_price_per_1m: pricingOf(cfg)?.inputPricePer1M ?? undefined,
			output_price_per_1m: pricingOf(cfg)?.outputPricePer1M ?? undefined,
			cached_input_price_per_1m: pricingOf(cfg)?.cachedInputPricePer1M ?? undefined,
			reasoning_price_per_1m: pricingOf(cfg)?.reasoningPricePer1M ?? undefined,
			price_per_call: pricingOf(cfg)?.pricePerCall ?? undefined,
			price_per_image: pricingOf(cfg)?.pricePerImage ?? undefined,
			notes: pricingOf(cfg)?.notes ?? undefined
		});
		editing = { kind: 'config', id: cfg.id };
	}

	function closeEditor() {
		editing = null;
	}
</script>

<div class="space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div class="space-y-1">
			<h1 class="text-3xl font-bold tracking-tight">Pricing</h1>
			<p class="text-sm text-muted-foreground">
				Set prices per model, tool, or infra config by creating a new pricing record and re-linking
				<code class="font-mono">current_pricing</code>. Previous records are never deleted.
			</p>
		</div>
	</div>

	<Tabs.Root value="models" class="space-y-6">
		<Tabs.List>
			<Tabs.Trigger value="models">Models</Tabs.Trigger>
			<Tabs.Trigger value="tools">Tools</Tabs.Trigger>
			<Tabs.Trigger value="infra">Infra Configs</Tabs.Trigger>
			<Tabs.Trigger value="rates">Pricing Rates</Tabs.Trigger>
			<Tabs.Trigger value="credits">Credit Exchange</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="models" class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Model Pricing</Card.Title>
					<Card.Description>Applies to user-selectable ai_agent_models records.</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Model</Table.Head>
								<Table.Head>Provider</Table.Head>
								<Table.Head class="text-right">Input ($/1M)</Table.Head>
								<Table.Head class="text-right">Output ($/1M)</Table.Head>
								<Table.Head class="text-right">Per Call ($)</Table.Head>
								<Table.Head class="w-40"></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if models.length === 0}
								<Table.Row>
									<Table.Cell colspan={6} class="py-8 text-center text-sm text-muted-foreground">
										No models found.
									</Table.Cell>
								</Table.Row>
							{:else}
								{#each models as model (model.id)}
									{@const p = pricingOf(model)}
									<Table.Row>
										<Table.Cell class="space-y-0.5">
											<div class="font-medium">{model.displayName}</div>
											<div class="text-xs text-muted-foreground">{model.modelId}</div>
										</Table.Cell>
										<Table.Cell>
											{model.expand?.provider?.displayName ?? '-'}
										</Table.Cell>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(p?.inputPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(p?.outputPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono">{fmtPrice(p?.pricePerCall)}</Table.Cell
										>
										<Table.Cell class="text-right">
											<Button variant="secondary" onclick={() => toggleModelEditor(model)}>
												Set Price
											</Button>
										</Table.Cell>
									</Table.Row>

									{#if editing?.kind === 'model' && editing.id === model.id}
										{@const modelForm = getModelForm(model.id)}
										<Table.Row>
											<Table.Cell colspan={6} class="bg-muted/30">
												<form
													{...modelForm.enhance(async ({ submit, form }) => {
														try {
															await submit().updates(getPricingAdminData);
															if (form.result?.success) {
																form.reset();
																toast.success('Model pricing updated');
																closeEditor();
															} else {
																toast.error(form.result?.error || 'Failed to update model pricing');
															}
														} catch (e) {
															toast.error('Failed to update model pricing');
														}
													})}
													class="grid gap-4 p-4 md:grid-cols-6"
												>
													<input type="hidden" {...modelForm.fields.modelId.as('text')} />
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={modelForm}
															name="input_price_per_1m"
															label="Input ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={modelForm}
															name="output_price_per_1m"
															label="Output ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={modelForm}
															name="cached_input_price_per_1m"
															label="Cached Input ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={modelForm}
															name="reasoning_price_per_1m"
															label="Reasoning ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={modelForm}
															name="price_per_call"
															label="Per Call ($)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={modelForm}
															name="price_per_image"
															label="Per Image ($)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-4">
														<RemoteSnapInputField
															formAttributes={modelForm}
															name="notes"
															label="Notes"
															placeholder="Optional"
															type="text"
														/>
													</div>
													<div class="flex items-end justify-end gap-2">
														<Button type="button" variant="ghost" onclick={closeEditor}
															>Cancel</Button
														>
														<Button type="submit" disabled={!!modelForm.pending}>
															{#if modelForm.pending}
																<Loader2 class="mr-2 h-4 w-4 animate-spin" />
															{/if}
															Save
														</Button>
													</div>
												</form>
											</Table.Cell>
										</Table.Row>
									{/if}
								{/each}
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="tools" class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Tool Pricing</Card.Title>
					<Card.Description>Applies to ai_tools.</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Tool</Table.Head>
								<Table.Head>Type</Table.Head>
								<Table.Head class="text-right">Input ($/1M)</Table.Head>
								<Table.Head class="text-right">Output ($/1M)</Table.Head>
								<Table.Head class="text-right">Per Call ($)</Table.Head>
								<Table.Head class="w-40"></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if tools.length === 0}
								<Table.Row>
									<Table.Cell colspan={6} class="py-8 text-center text-sm text-muted-foreground">
										No tools found.
									</Table.Cell>
								</Table.Row>
							{:else}
								{#each tools as tool (tool.id)}
									{@const p = pricingOf(tool)}
									<Table.Row>
										<Table.Cell class="space-y-0.5">
											<div class="font-medium">{tool.displayName}</div>
											<div class="text-xs text-muted-foreground">{tool.toolKey}</div>
										</Table.Cell>
										<Table.Cell>
											<Badge variant="secondary">{tool.toolType}</Badge>
										</Table.Cell>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(p?.inputPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(p?.outputPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono">{fmtPrice(p?.pricePerCall)}</Table.Cell
										>
										<Table.Cell class="text-right">
											<Button variant="secondary" onclick={() => toggleToolEditor(tool)}>
												Set Price
											</Button>
										</Table.Cell>
									</Table.Row>

									{#if editing?.kind === 'tool' && editing.id === tool.id}
										{@const toolForm = getToolForm(tool.id)}
										<Table.Row>
											<Table.Cell colspan={6} class="bg-muted/30">
												<form
													{...toolForm.enhance(async ({ submit, form }) => {
														try {
															await submit().updates(getPricingAdminData);
															if (form.result?.success) {
																form.reset();
																toast.success('Tool pricing updated');
																closeEditor();
															} else {
																toast.error(form.result?.error || 'Failed to update tool pricing');
															}
														} catch (e) {
															toast.error('Failed to update tool pricing');
														}
													})}
													class="grid gap-4 p-4 md:grid-cols-6"
												>
													<input type="hidden" {...toolForm.fields.toolId.as('text')} />
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={toolForm}
															name="input_price_per_1m"
															label="Input ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={toolForm}
															name="output_price_per_1m"
															label="Output ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={toolForm}
															name="price_per_call"
															label="Per Call ($)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={toolForm}
															name="price_per_image"
															label="Per Image ($)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-4">
														<RemoteSnapInputField
															formAttributes={toolForm}
															name="notes"
															label="Notes"
															placeholder="Optional"
															type="text"
														/>
													</div>
													<div class="flex items-end justify-end gap-2">
														<Button type="button" variant="ghost" onclick={closeEditor}
															>Cancel</Button
														>
														<Button type="submit" disabled={!!toolForm.pending}>
															{#if toolForm.pending}
																<Loader2 class="mr-2 h-4 w-4 animate-spin" />
															{/if}
															Save
														</Button>
													</div>
												</form>
											</Table.Cell>
										</Table.Row>
									{/if}
								{/each}
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="infra" class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Infra Config Pricing</Card.Title>
					<Card.Description>Applies to ai_agent_models infra configs.</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Config</Table.Head>
								<Table.Head>Service</Table.Head>
								<Table.Head class="text-right">Input ($/1M)</Table.Head>
								<Table.Head class="text-right">Output ($/1M)</Table.Head>
								<Table.Head class="text-right">Per Call ($)</Table.Head>
								<Table.Head class="w-40"></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if configs.length === 0}
								<Table.Row>
									<Table.Cell colspan={6} class="py-8 text-center text-sm text-muted-foreground">
										No infra configs found.
									</Table.Cell>
								</Table.Row>
							{:else}
								{#each configs as cfg (cfg.id)}
									{@const p = pricingOf(cfg)}
									<Table.Row>
										<Table.Cell class="space-y-0.5">
											<div class="font-medium">{cfg.displayName}</div>
											<div class="text-xs text-muted-foreground">
												{cfg.configKey} • {cfg.modelId}
											</div>
										</Table.Cell>
										<Table.Cell>
											<Badge variant="secondary">{cfg.serviceType}</Badge>
										</Table.Cell>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(p?.inputPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(p?.outputPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono">{fmtPrice(p?.pricePerCall)}</Table.Cell
										>
										<Table.Cell class="text-right">
											<Button variant="secondary" onclick={() => toggleConfigEditor(cfg)}>
												Set Price
											</Button>
										</Table.Cell>
									</Table.Row>

									{#if editing?.kind === 'config' && editing.id === cfg.id}
										{@const configForm = getConfigForm(cfg.id)}
										<Table.Row>
											<Table.Cell colspan={6} class="bg-muted/30">
												<form
													{...configForm.enhance(async ({ submit, form }) => {
														try {
															await submit().updates(getPricingAdminData);
															if (form.result?.success) {
																form.reset();
																toast.success('Infra config pricing updated');
																closeEditor();
															} else {
																toast.error(
																	form.result?.error || 'Failed to update infra config pricing'
																);
															}
														} catch (e) {
															toast.error('Failed to update infra config pricing');
														}
													})}
													class="grid gap-4 p-4 md:grid-cols-6"
												>
													<input type="hidden" {...configForm.fields.configId.as('text')} />
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={configForm}
															name="input_price_per_1m"
															label="Input ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={configForm}
															name="output_price_per_1m"
															label="Output ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={configForm}
															name="cached_input_price_per_1m"
															label="Cached Input ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={configForm}
															name="reasoning_price_per_1m"
															label="Reasoning ($/1M)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={configForm}
															name="price_per_call"
															label="Per Call ($)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-2">
														<RemoteSnapInputField
															formAttributes={configForm}
															name="price_per_image"
															label="Per Image ($)"
															placeholder="0"
															type="number"
															inputProps={{ step: 0.000001 }}
														/>
													</div>
													<div class="md:col-span-4">
														<RemoteSnapInputField
															formAttributes={configForm}
															name="notes"
															label="Notes"
															placeholder="Optional"
															type="text"
														/>
													</div>
													<div class="flex items-end justify-end gap-2">
														<Button type="button" variant="ghost" onclick={closeEditor}
															>Cancel</Button
														>
														<Button type="submit" disabled={!!configForm.pending}>
															{#if configForm.pending}
																<Loader2 class="mr-2 h-4 w-4 animate-spin" />
															{/if}
															Save
														</Button>
													</div>
												</form>
											</Table.Cell>
										</Table.Row>
									{/if}
								{/each}
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="rates" class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Pricing Rates (History)</Card.Title>
					<Card.Description>
						All ai_pricing_rates records. Prices are created when you “Set Price” on a model, tool,
						or infra config.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Tier</Table.Head>
								<Table.Head class="text-right">Input ($/1M)</Table.Head>
								<Table.Head class="text-right">Output ($/1M)</Table.Head>
								<Table.Head class="text-right">Cached In ($/1M)</Table.Head>
								<Table.Head class="text-right">Reasoning ($/1M)</Table.Head>
								<Table.Head class="text-right">Per Call ($)</Table.Head>
								<Table.Head class="text-right">Per Image ($)</Table.Head>
								<Table.Head>Notes</Table.Head>
								<Table.Head>Active</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if rates.length === 0}
								<Table.Row>
									<Table.Cell colspan={9} class="py-8 text-center text-sm text-muted-foreground">
										No pricing rates found.
									</Table.Cell>
								</Table.Row>
							{:else}
								{#each rates as rate (rate.id)}
									<Table.Row>
										<Table.Cell class="font-medium">{rate.tier ?? '-'}</Table.Cell>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(rate.inputPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(rate.outputPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(rate.cachedInputPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(rate.reasoningPricePer1M)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(rate.pricePerCall)}</Table.Cell
										>
										<Table.Cell class="text-right font-mono"
											>{fmtPrice(rate.pricePerImage)}</Table.Cell
										>
										<Table.Cell class="max-w-105 truncate">{rate.notes ?? '-'}</Table.Cell>
										<Table.Cell>
											{#if rate.isActive}
												<Badge>Yes</Badge>
											{:else}
												<span class="text-muted-foreground">No</span>
											{/if}
										</Table.Cell>
									</Table.Row>
								{/each}
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="credits" class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Credit Exchange</Card.Title>
					<Card.Description
						>Update the active Credits/USD conversion (history is preserved).</Card.Description
					>
				</Card.Header>
				<Card.Content class="space-y-6">
					<div class="grid gap-6 lg:grid-cols-3">
						<div class="rounded-md border p-4 lg:col-span-1">
							<div class="flex items-start justify-between gap-3">
								<div>
									<div class="text-sm text-muted-foreground">Current Rate</div>
									<div class="mt-1 text-2xl font-semibold tracking-tight">
										{activeExchangeRate ? Number(activeExchangeRate.rate) : '-'}
										<span class="ml-2 text-sm font-normal text-muted-foreground">Credits / USD</span
										>
									</div>
								</div>
								{#if activeExchangeRate?.isActive}
									<Badge>Active</Badge>
								{:else}
									<Badge variant="secondary">Inactive</Badge>
								{/if}
							</div>
							{#if activeExchangeRate?.notes}
								<div class="mt-3 text-sm text-muted-foreground">{activeExchangeRate.notes}</div>
							{:else}
								<div class="mt-3 text-sm text-muted-foreground">No notes</div>
							{/if}
						</div>

						<div class="rounded-md border p-4 lg:col-span-2">
							<div class="mb-4">
								<div class="text-sm font-medium">Set New Rate</div>
								<div class="text-xs text-muted-foreground">
									Creates a new record and closes the previous active rate.
								</div>
							</div>
							<form
								{...createCreditExchangeRate.enhance(async ({ submit, form }) => {
									try {
										await submit().updates(getPricingAdminData);
										if (form.result?.success) {
											form.reset();
											toast.success('Exchange rate updated');
										} else {
											toast.error(form.result?.error || 'Failed to update exchange rate');
										}
									} catch (error) {
										toast.error('Failed to update exchange rate');
									}
								})}
								class="grid gap-4 md:grid-cols-3"
							>
								<div class="md:col-span-1">
									<RemoteSnapInputField
										formAttributes={createCreditExchangeRate}
										name="rate"
										label="Credits per USD"
										placeholder={activeExchangeRate ? String(activeExchangeRate.rate) : 'e.g. 100'}
										type="number"
										inputProps={{ step: 1, min: 0 }}
									/>
								</div>
								<div class="md:col-span-2">
									<RemoteSnapInputField
										formAttributes={createCreditExchangeRate}
										name="notes"
										label="Notes"
										placeholder="Optional"
										type="text"
									/>
								</div>
								<div class="flex items-center justify-end md:col-span-3">
									<Button type="submit" disabled={!!createCreditExchangeRate.pending}>
										{#if createCreditExchangeRate.pending}
											<Loader2 class="mr-2 h-4 w-4 animate-spin" />
										{/if}
										Save
									</Button>
								</div>
							</form>
						</div>
					</div>

					<div class="border-t"></div>

					<div>
						<div class="mb-3 flex items-center justify-between gap-3">
							<div>
								<div class="text-sm font-medium">History</div>
								<div class="text-xs text-muted-foreground">All records (newest first)</div>
							</div>
						</div>
						<div class="overflow-x-auto rounded-md border">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Credits/USD</Table.Head>
										<Table.Head>Notes</Table.Head>
										<Table.Head class="w-24">Active</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#if exchangeRates.length === 0}
										<Table.Row>
											<Table.Cell
												colspan={3}
												class="py-10 text-center text-sm text-muted-foreground"
											>
												No exchange rates found.
											</Table.Cell>
										</Table.Row>
									{:else}
										{#each exchangeRates as r (r.id)}
											<Table.Row>
												<Table.Cell class="font-mono">{Number(r.rate)}</Table.Cell>
												<Table.Cell class="max-w-180 truncate">{r.notes ?? '-'}</Table.Cell>
												<Table.Cell>
													{#if r.isActive}
														<Badge>Yes</Badge>
													{:else}
														<span class="text-muted-foreground">No</span>
													{/if}
												</Table.Cell>
											</Table.Row>
										{/each}
									{/if}
								</Table.Body>
							</Table.Root>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
