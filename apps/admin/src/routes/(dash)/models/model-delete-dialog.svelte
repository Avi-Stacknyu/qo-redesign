<script lang="ts">
	import * as Dialog from '$lib/components/shadcn/dialog';
	import * as Select from '$lib/components/shadcn/select';
	import { Button } from '$lib/components/shadcn/button';
	import Badge from '$lib/components/shadcn/badge/badge.svelte';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
	import {
		getModelDependencies,
		getReplacementModelOptions,
		deleteModelWithReplacement,
		type ModelDependency
	} from './model.remote';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';

	let {
		open = $bindable(false),
		modelId,
		modelName
	}: {
		open: boolean;
		modelId: string;
		modelName: string;
	} = $props();

	let loading = $state(true);
	let deleting = $state(false);
	let deps = $state<ModelDependency | null>(null);
	let replacementOptions = $state<
		{
			id: string;
			displayName: string | null;
			modelId: string | null;
			providerKey: string | null;
			isSystemDefault: boolean | null;
		}[]
	>([]);
	let replacementId = $state<string | undefined>(undefined);
	let error = $state<string | null>(null);

	async function fetchDependencies() {
		loading = true;
		error = null;
		deps = null;
		replacementId = undefined;

		try {
			const [depResult, options] = await Promise.all([
				getModelDependencies({ id: modelId }),
				getReplacementModelOptions({ excludeId: modelId })
			]);
			if (!depResult.success) {
				error = depResult.error ?? 'Failed to check dependencies';
				return;
			}
			deps = depResult;
			replacementOptions = options;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open && modelId) {
			untrack(() => {
				fetchDependencies();
			});
		}
	});

	const totalDeps = $derived(
		deps
			? deps.agents.length +
					deps.onboardingConfigs.length +
					deps.planFallbacks.length +
					deps.planAllowedModels.length +
					deps.userPreferences +
					deps.flowNodePins.reduce((sum, f) => sum + f.nodeCount, 0) +
					(deps.isSystemDefault ? 1 : 0)
			: 0
	);

	const canDeleteWithoutReplacement = $derived(!deps?.hasDependencies);

	async function handleDelete() {
		if (deps?.hasDependencies && !replacementId) {
			toast.error('Please select a replacement model before deleting');
			return;
		}

		deleting = true;
		try {
			const result = await deleteModelWithReplacement({
				id: modelId,
				replacementId: deps?.hasDependencies ? replacementId : undefined
			});
			if (result?.success) {
				toast.success(`${modelName} deleted successfully`);
				open = false;
				await invalidateAll();
			} else {
				toast.error(result?.error || 'Failed to delete model');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to delete model');
		} finally {
			deleting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<AlertTriangle class="h-5 w-5 text-destructive" />
				Delete Model
			</Dialog.Title>
			<Dialog.Description>
				{#if loading}
					Checking dependencies for <strong>{modelName}</strong>…
				{:else if canDeleteWithoutReplacement}
					No dependencies found. This model can be safely deleted.
				{:else}
					<strong>{modelName}</strong> is referenced in {totalDeps} place{totalDeps === 1
						? ''
						: 's'}. Select a replacement model before deleting.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if loading}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		{:else if error}
			<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
		{:else if deps}
			{#if deps.hasDependencies}
				<div class="max-h-64 space-y-3 overflow-y-auto">
					{#if deps.isSystemDefault}
						<div class="flex items-center gap-2 rounded-md bg-amber-500/10 p-2.5 text-sm">
							<Badge variant="default">⭐ System Default</Badge>
							<span class="text-muted-foreground">This is the system-wide default model</span>
						</div>
					{/if}

					{#if deps.agents.length > 0}
						<div class="rounded-md border p-2.5">
							<p class="mb-1 text-sm font-medium">
								Profiler Agents
								<Badge variant="secondary" class="ml-1">{deps.agents.length}</Badge>
							</p>
							<ul class="space-y-0.5 text-sm text-muted-foreground">
								{#each deps.agents as agent}
									<li class="truncate">• {agent.name}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if deps.flowNodePins.length > 0}
						<div class="rounded-md border p-2.5">
							<p class="mb-1 text-sm font-medium">
								Flow Node Pins
								<Badge variant="secondary" class="ml-1">
									{deps.flowNodePins.reduce((s, f) => s + f.nodeCount, 0)} node{deps.flowNodePins.reduce(
										(s, f) => s + f.nodeCount,
										0
									) === 1
										? ''
										: 's'}
								</Badge>
							</p>
							<ul class="space-y-0.5 text-sm text-muted-foreground">
								{#each deps.flowNodePins as pin}
									<li class="truncate">
										• Flow {pin.flowId} — {pin.nodeCount} node{pin.nodeCount === 1 ? '' : 's'}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if deps.userPreferences > 0}
						<div class="rounded-md border p-2.5">
							<p class="text-sm font-medium">
								User Preferences
								<Badge variant="secondary" class="ml-1">{deps.userPreferences}</Badge>
							</p>
							<p class="mt-0.5 text-sm text-muted-foreground">
								{deps.userPreferences} user{deps.userPreferences === 1 ? '' : 's'} have this as their
								preferred model
							</p>
						</div>
					{/if}

					{#if deps.onboardingConfigs.length > 0}
						<div class="rounded-md border p-2.5">
							<p class="text-sm font-medium">
								Onboarding Configs
								<Badge variant="secondary" class="ml-1">{deps.onboardingConfigs.length}</Badge>
							</p>
						</div>
					{/if}

					{#if deps.planFallbacks.length > 0}
						<div class="rounded-md border p-2.5">
							<p class="mb-1 text-sm font-medium">
								Plan Fallback Models
								<Badge variant="secondary" class="ml-1">{deps.planFallbacks.length}</Badge>
							</p>
							<ul class="space-y-0.5 text-sm text-muted-foreground">
								{#each deps.planFallbacks as plan}
									<li class="truncate">• {plan.title}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if deps.planAllowedModels.length > 0}
						<div class="rounded-md border p-2.5">
							<p class="mb-1 text-sm font-medium">
								Plan Allowed Models
								<Badge variant="secondary" class="ml-1">{deps.planAllowedModels.length}</Badge>
							</p>
							<ul class="space-y-0.5 text-sm text-muted-foreground">
								{#each deps.planAllowedModels as plan}
									<li class="truncate">• {plan.title}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				<!-- Replacement model selector -->
				<div class="mt-4 space-y-2 border-t pt-4">
					<p class="text-sm font-medium">Replacement Model</p>
					<p class="text-xs text-muted-foreground">
						All references will be reassigned to the replacement model before deletion.
					</p>
					<Select.Root
						type="single"
						value={replacementId}
						onValueChange={(v) => (replacementId = v)}
					>
						<Select.Trigger class="w-full">
							{#if replacementId}
								{@const selected = replacementOptions.find((o) => o.id === replacementId)}
								{selected?.displayName ?? 'Select model…'}
							{:else}
								Select replacement model…
							{/if}
						</Select.Trigger>
						<Select.Content class="max-h-60">
							{#each replacementOptions as opt}
								<Select.Item value={opt.id} label={opt.displayName ?? opt.modelId ?? opt.id}>
									<span class="flex items-center gap-2">
										<span class="truncate">{opt.displayName ?? opt.modelId}</span>
										{#if opt.providerKey}
											<span class="text-xs text-muted-foreground">{opt.providerKey}</span>
										{/if}
										{#if opt.isSystemDefault}
											<Badge variant="default" class="h-4 text-[10px]">Default</Badge>
										{/if}
									</span>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{/if}

			<Dialog.Footer class="mt-4">
				<Button variant="outline" onclick={() => (open = false)} disabled={deleting}>Cancel</Button>
				<Button
					variant="destructive"
					onclick={handleDelete}
					disabled={deleting || (deps.hasDependencies && !replacementId)}
				>
					{#if deleting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Deleting…
					{:else if deps.hasDependencies}
						Replace & Delete
					{:else}
						Delete
					{/if}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
