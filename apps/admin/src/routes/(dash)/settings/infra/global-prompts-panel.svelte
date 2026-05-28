<script lang="ts">
	import { RemoteSnapInputField } from '$lib/components/formComp';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import * as Card from '$lib/components/shadcn/card';
	import * as Sheet from '$lib/components/shadcn/sheet';
	import * as Table from '$lib/components/shadcn/table';
	import { ChevronDown, ChevronRight, Loader2, Plus, RotateCcw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { createPromptVersion, getInfraAdminData, rollbackPromptVersion } from './infra.remote';
	import { formatStamp, groupPrompts, type VersionedPromptRow } from './infra-view-model';

	type PromptForm = ReturnType<(typeof createPromptVersion)['for']>;
	type RollbackForm = ReturnType<(typeof rollbackPromptVersion)['for']>;
	type AdminQuery = ReturnType<typeof getInfraAdminData>;
	type PromptMutationResult = { success?: boolean; error?: string };
	type PromptRow = VersionedPromptRow['current'];

	let {
		prompts
	}: {
		prompts: PromptRow[];
	} = $props();

	const promptForms = new Map<string, PromptForm>();
	const rollbackForms = new Map<string, RollbackForm>();

	let rows = $derived(groupPrompts(prompts));
	let expandedKey = $state<string | null>(null);
	let sheetOpen = $state(false);
	let editBase = $state<PromptRow | null>(null);
	let activeRollbackId = $state<string | null>(null);

	function toggleExpand(key: string) {
		expandedKey = expandedKey === key ? null : key;
	}

	function getPromptForm(scope: string): PromptForm {
		let form = promptForms.get(scope);
		if (!form) {
			form = createPromptVersion.for(scope);
			promptForms.set(scope, form);
		}
		return form;
	}

	function getRollbackForm(id: string): RollbackForm {
		let f = rollbackForms.get(id);
		if (!f) {
			f = rollbackPromptVersion.for(id);
			rollbackForms.set(id, f);
		}
		return f;
	}

	function openSheet(base: PromptRow | null) {
		editBase = base;
		const scope = base ? `prompt:${base.id}` : '__new__';
		const form = getPromptForm(scope);
		form.fields.set({
			prompt_key: base?.promptKey ?? '',
			previous_id: base?.id ?? '',
			display_name: base?.displayName ?? '',
			prompt_template: base?.promptTemplate ?? '',
			change_notes: ''
		});
		sheetOpen = true;
	}

	let activeFormScope = $derived(editBase ? `prompt:${editBase.id}` : '__new__');
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center justify-between">
			<div>
				<Card.Title>Global Prompts</Card.Title>
				<Card.Description
					>Versioned prompts by key. Active version is used at runtime.</Card.Description
				>
			</div>
			<Button onclick={() => openSheet(null)}>
				<Plus class="mr-2 h-4 w-4" />
				New Prompt
			</Button>
		</div>
	</Card.Header>
	<Card.Content class="p-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-10"></Table.Head>
					<Table.Head>Prompt Key</Table.Head>
					<Table.Head>Display Name</Table.Head>
					<Table.Head class="w-28 text-center">Status</Table.Head>
					<Table.Head class="w-24 text-center">Versions</Table.Head>
					<Table.Head class="w-36">Updated</Table.Head>
					<Table.Head class="w-32 text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if rows.length === 0}
					<Table.Row>
						<Table.Cell colspan={7} class="py-8 text-center text-sm text-muted-foreground">
							No global prompts found. Create one to get started.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each rows as row (row.promptKey)}
						<Table.Row class="cursor-pointer" onclick={() => toggleExpand(row.promptKey)}>
							<Table.Cell>
								{#if expandedKey === row.promptKey}
									<ChevronDown class="h-4 w-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="h-4 w-4 text-muted-foreground" />
								{/if}
							</Table.Cell>
							<Table.Cell>
								<Badge variant="outline" class="font-mono text-xs">
									{row.promptKey}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								<span class="text-sm font-medium">{row.current.displayName}</span>
							</Table.Cell>
							<Table.Cell class="text-center">
								<Badge variant={row.active ? 'default' : 'secondary'}>
									{row.active ? 'Active' : 'Inactive'} v{row.current.version ?? 0}
								</Badge>
							</Table.Cell>
							<Table.Cell class="text-center text-sm text-muted-foreground">
								{row.versionCount}
							</Table.Cell>
							<Table.Cell class="text-sm text-muted-foreground">
								{formatStamp(row.current.created ?? undefined)}
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

						{#if expandedKey === row.promptKey}
							<Table.Row>
								<Table.Cell colspan={7} class="bg-muted/30 p-4">
									<div class="mb-4 rounded-md border bg-background p-4">
										<pre
											class="max-h-64 overflow-auto font-mono text-xs leading-6 whitespace-pre-wrap">{row
												.current.promptTemplate}</pre>
										<div class="space-y-2">
											{#each row.versions as version (version.id)}
												<div
													class="flex items-center justify-between rounded-md border bg-background px-4 py-2"
												>
													<div class="flex items-center gap-4">
														<Badge variant={version.isActive ? 'default' : 'outline'}>
															{version.isActive
																? `Active v${version.version ?? 0}`
																: `v${version.version ?? 0}`}
														</Badge>
														<div>
															<p class="text-sm font-medium">{version.displayName}</p>
															<p class="text-xs text-muted-foreground">
																{formatStamp(version.created ?? undefined)}
																{#if version.changeNotes}
																	&middot; {version.changeNotes}
																{/if}
															</p>
														</div>
													</div>
													<div class="flex gap-2">
														<Button variant="ghost" size="sm" onclick={() => openSheet(version)}>
															Use as Base
														</Button>
														{#if !version.isActive}
															{@const rollbackForm = getRollbackForm(version.id)}
															{@const busy =
																activeRollbackId === version.id || !!rollbackForm.pending}
															<form
																{...rollbackForm.enhance(async ({ submit }) => {
																	activeRollbackId = version.id;
																	try {
																		await submit().updates(getInfraAdminData);
																		const result = (rollbackForm.result ??
																			null) as PromptMutationResult | null;
																		if (!result?.success) {
																			toast.error(result?.error ?? 'Failed to rollback');
																			return;
																		}

																		toast.success(`Rolled back to v${version.version ?? 0}`);
																	} catch (e) {
																		toast.error((e as Error).message || 'Failed to rollback');
																	} finally {
																		activeRollbackId = null;
																	}
																})}
															>
																<input type="hidden" name="source_id" value={version.id} />
																<input type="hidden" name="prompt_key" value={version.promptKey} />
																<input
																	type="hidden"
																	name="change_notes"
																	value={`Rolled back to v${version.version ?? '?'}`}
																/>
																<Button type="submit" variant="secondary" size="sm" disabled={busy}>
																	{#if busy}
																		<Loader2 class="mr-1 h-3 w-3 animate-spin" />
																	{:else}
																		<RotateCcw class="mr-1 h-3 w-3" />
																	{/if}
																	Rollback
																</Button>
															</form>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									</div></Table.Cell
								>
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
			<Sheet.Title>{editBase ? 'New Prompt Version' : 'New Prompt Key'}</Sheet.Title>
			<Sheet.Description>
				{editBase
					? `Creating a new version for "${editBase.promptKey}". The current active version will be archived.`
					: 'Create a brand new prompt key with its first version.'}
			</Sheet.Description>
		</Sheet.Header>
		{@const promptForm = getPromptForm(activeFormScope)}
		<form
			{...promptForm.enhance(async ({ submit, form }) => {
				try {
					await submit().updates(getInfraAdminData);
					const result = (promptForm.result ?? null) as PromptMutationResult | null;
					if (!result?.success) {
						toast.error(result?.error ?? 'Failed to save prompt');
						return;
					}

					form.reset();
					toast.success(editBase ? 'New version created' : 'Prompt created');
					sheetOpen = false;
				} catch (e) {
					console.error('Prompt form error:', e);
					toast.error((e as Error).message || 'Failed to save prompt');
				}
			})}
			class="space-y-4 px-4"
		>
			<RemoteSnapInputField
				formAttributes={promptForm}
				name="prompt_key"
				label="Prompt Key"
				placeholder="e.g. agent_system_default"
				disabled={!!editBase}
			/>
			{#if editBase}
				<input class="hidden" {...promptForm.fields.prompt_key.as('text')} />
			{/if}
			<RemoteSnapInputField
				formAttributes={promptForm}
				name="display_name"
				label="Display Name"
				placeholder="e.g. Default System Prompt"
			/>
			<RemoteSnapInputField
				formAttributes={promptForm}
				name="prompt_template"
				label="Prompt Template"
				placeholder="Enter the full prompt body"
				isTextarea={true}
			/>
			<RemoteSnapInputField
				formAttributes={promptForm}
				name="change_notes"
				label="Change Notes"
				placeholder="What changed in this version"
				isTextarea={true}
			/>
			<input class="hidden" {...promptForm.fields.previous_id.as('text')} />
			<div class="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onclick={() => (sheetOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={!!promptForm.pending}>
					{#if promptForm.pending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Save
				</Button>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>
