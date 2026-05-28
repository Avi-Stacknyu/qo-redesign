<script lang="ts">
	import { RemoteSnapInputField, RemoteSnapSelectField } from '$lib/components/formComp';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import * as Card from '$lib/components/shadcn/card';
	import * as Sheet from '$lib/components/shadcn/sheet';
	import * as Table from '$lib/components/shadcn/table';
	import { ChevronDown, ChevronRight, Loader2, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { AiAgentModelServiceType } from '@repo/db/types';
	import { createInfraConfigVersion, getInfraAdminData } from './infra.remote';
	import {
		formatStamp,
		groupConfigs,
		labelForServiceType,
		type InfraModelResponse
	} from './infra-view-model';

	type ConfigForm = ReturnType<(typeof createInfraConfigVersion)['for']>;
	type AdminQuery = ReturnType<typeof getInfraAdminData>;
	type ConfigMutationResult = { success?: boolean; error?: string };
	type ProviderRow = NonNullable<AdminQuery['current']>['providers'][number];

	let {
		configs,
		providers
	}: {
		configs: InfraModelResponse[];
		providers: ProviderRow[];
	} = $props();

	const configForms = new Map<string, ConfigForm>();
	const serviceTypeOptions = [
		{ value: 'generation', label: 'Generation' },
		{ value: 'embedding', label: 'Embedding' },
		{ value: 'extraction', label: 'Extraction' },
		{ value: 'reranking', label: 'Reranking' },
		{ value: 'transcription', label: 'Transcription' },
		{ value: 'image_generation', label: 'Image Generation' },
		{ value: 'classification', label: 'Classification' }
	] as const;

	let rows = $derived(groupConfigs(configs));
	let expandedKey = $state<string | null>(null);
	let sheetOpen = $state(false);
	let editBase = $state<InfraModelResponse | null>(null);

	const providerOptions = $derived(
		providers.map((p) => ({ value: p.id, label: `${p.displayName} (${p.providerKey})` }))
	);

	function toggleExpand(key: string) {
		expandedKey = expandedKey === key ? null : key;
	}

	function getConfigForm(scope: string): ConfigForm {
		let form = configForms.get(scope);
		if (!form) {
			form = createInfraConfigVersion.for(scope);
			configForms.set(scope, form);
		}
		return form;
	}

	function openSheet(base: InfraModelResponse | null) {
		editBase = base;
		const scope = base ? `config:${base.id}` : '__new__';
		const form = getConfigForm(scope);
		form.fields.set({
			config_key: base?.configKey ?? '',
			previous_id: base?.id ?? '',
			display_name: base?.displayName ?? '',
			model_id: base?.modelId ?? '',
			service_type: (base?.serviceType ?? 'generation') as AiAgentModelServiceType,
			description: base?.description ?? '',
			provider: base?.provider ?? providers[0]?.id ?? ''
		});
		sheetOpen = true;
	}

	let activeFormScope = $derived(editBase ? `config:${editBase.id}` : '__new__');
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center justify-between">
			<div>
				<Card.Title>Infra Configs</Card.Title>
				<Card.Description>
					Internal model wiring grouped by config key. Only the active version per key is used at
					runtime.
				</Card.Description>
			</div>
			<Button onclick={() => openSheet(null)} disabled={providers.length === 0}>
				<Plus class="mr-2 h-4 w-4" />
				New Config
			</Button>
		</div>
	</Card.Header>
	<Card.Content class="p-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-10"></Table.Head>
					<Table.Head>Config Key</Table.Head>
					<Table.Head>Display Name</Table.Head>
					<Table.Head>Provider</Table.Head>
					<Table.Head>Model ID</Table.Head>
					<Table.Head>Service</Table.Head>
					<Table.Head>Pricing</Table.Head>
					<Table.Head class="w-24 text-center">Status</Table.Head>
					<Table.Head class="w-24 text-center">Versions</Table.Head>
					<Table.Head class="w-32 text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if rows.length === 0}
					<Table.Row>
						<Table.Cell colspan={10} class="py-8 text-center text-sm text-muted-foreground">
							No infra configs found. Create one to get started.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each rows as row (row.configKey)}
						<Table.Row class="cursor-pointer" onclick={() => toggleExpand(row.configKey)}>
							<Table.Cell>
								{#if expandedKey === row.configKey}
									<ChevronDown class="h-4 w-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-4 w-4 text-muted-foreground" />
								{/if}
							</Table.Cell>
							<Table.Cell>
								<Badge variant="outline" class="font-mono text-xs">
									{row.configKey}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								<span class="font-medium">{row.current.displayName}</span>
							</Table.Cell>
							<Table.Cell class="text-sm text-muted-foreground">
								{row.providerLabel}
							</Table.Cell>
							<Table.Cell>
								<code class="text-xs">{row.current.modelId}</code>
							</Table.Cell>
							<Table.Cell class="text-sm text-muted-foreground">
								{labelForServiceType(row.current.serviceType ?? '')}
							</Table.Cell>
							<Table.Cell class="text-sm text-muted-foreground">
								{row.pricingLabel}
							</Table.Cell>
							<Table.Cell class="text-center">
								<Badge variant={row.active ? 'default' : 'secondary'}>
									{row.active ? 'Active' : 'Inactive'}
								</Badge>
							</Table.Cell>
							<Table.Cell class="text-center text-sm text-muted-foreground">
								{row.versionCount}
							</Table.Cell>
							<Table.Cell class="text-right">
								<Button
									variant="secondary"
									size="sm"
									onclick={(e: MouseEvent) => {
										e.stopPropagation();
										openSheet(row.current);
									}}>New Version</Button
								>
							</Table.Cell>
						</Table.Row>

						{#if expandedKey === row.configKey}
							<Table.Row>
								<Table.Cell colspan={10} class="bg-muted/30 p-4">
									<div
										class="mb-4 flex items-center justify-between rounded-md border bg-background px-4 py-2"
									>
										<p class="text-sm">
											<span class="text-xs text-muted-foreground">Pricing:</span>
											{row.pricingLabel}
										</p>
										<Button variant="outline" size="sm" href="/settings/pricing">
											Manage Pricing
										</Button>
									</div>
									<p class="mb-3 text-xs font-medium text-muted-foreground uppercase">
										Version History
									</p>
									<div class="space-y-2">
										{#each row.versions as version (version.id)}
											<div
												class="flex items-center justify-between rounded-md border bg-background px-4 py-2"
											>
												<div class="flex items-center gap-4">
													<Badge variant={version.isActive ? 'default' : 'outline'}>
														{version.isActive ? 'Active' : 'Archived'}
													</Badge>
													<div>
														<p class="text-sm font-medium">{version.displayName}</p>
														<p class="text-xs text-muted-foreground">
															{version.modelId} &middot; {version.expand?.provider?.displayName ??
																'Unknown'} &middot; {formatStamp(version.created ?? undefined)}
														</p>
													</div>
												</div>
												<Button variant="ghost" size="sm" onclick={() => openSheet(version)}>
													Use as Base
												</Button>
											</div>
										{/each}
									</div>
								</Table.Cell>
							</Table.Row>
						{/if}
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>

<Sheet.Root bind:open={sheetOpen}>
	<Sheet.Content class="overflow-y-auto sm:max-w-lg">
		<Sheet.Header>
			<Sheet.Title>{editBase ? 'New Version' : 'New Config Key'}</Sheet.Title>
			<Sheet.Description>
				{editBase
					? `Creating a new version for "${editBase.configKey}". The previous active version will be archived.`
					: 'Create a brand new infra config key with its first version.'}
			</Sheet.Description>
		</Sheet.Header>
		{@const configForm = getConfigForm(activeFormScope)}
		<form
			{...configForm.enhance(async ({ submit, form }) => {
				try {
					await submit().updates(getInfraAdminData);
					const result = (configForm.result ?? null) as ConfigMutationResult | null;
					if (!result?.success) {
						toast.error(result?.error ?? 'Failed to save config');
						return;
					}

					form.reset();
					toast.success(editBase ? 'New version created' : 'Config created');
					sheetOpen = false;
				} catch (e) {
					console.error('Config form error:', e);
					toast.error((e as Error).message || 'Failed to save config');
				}
			})}
			class="space-y-4 px-4"
		>
			<RemoteSnapInputField
				formAttributes={configForm}
				name="config_key"
				label="Config Key"
				placeholder="e.g. llm_model"
				disabled={!!editBase}
			/>
			{#if editBase}
				<input class="hidden" {...configForm.fields.config_key.as('text')} />
			{/if}
			<RemoteSnapInputField
				formAttributes={configForm}
				name="display_name"
				label="Display Name"
				placeholder="e.g. Llama 4 Scout 17B"
			/>
			<RemoteSnapInputField
				formAttributes={configForm}
				name="model_id"
				label="Model ID"
				placeholder="e.g. @cf/meta/llama-4-scout-17b-16e-instruct"
			/>
			<RemoteSnapSelectField
				formAttributes={configForm}
				name="service_type"
				label="Service Type"
				placeholder="Select service type"
				formatedList={[...serviceTypeOptions]}
			/>
			<RemoteSnapSelectField
				formAttributes={configForm}
				name="provider"
				label="Provider"
				placeholder="Select provider"
				formatedList={providerOptions}
			/>
			<RemoteSnapInputField
				formAttributes={configForm}
				name="description"
				label="Description"
				placeholder="Optional notes"
				isTextarea={true}
			/>
			<input class="hidden" {...configForm.fields.previous_id.as('text')} />
			<div class="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onclick={() => (sheetOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={!!configForm.pending}>
					{#if configForm.pending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Save
				</Button>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>
