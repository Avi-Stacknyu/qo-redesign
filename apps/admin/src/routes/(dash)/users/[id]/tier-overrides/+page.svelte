<script lang="ts">
	import { page } from '$app/state';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import { Input } from '$lib/components/shadcn/input';
	import { Label } from '$lib/components/shadcn/label';
	import * as Select from '$lib/components/shadcn/select';
	import { Switch } from '$lib/components/shadcn/switch';
	import { Plus, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		createOverride,
		deleteOverride,
		getModelOptions,
		getOverrides,
		getToolOptions,
		toggleOverride
	} from './overrides.remote';

	const userId = $derived(page.params.id ?? '');
	const overridesQuery = getOverrides();
	const modelOptionsQuery = getModelOptions();
	const toolOptionsQuery = getToolOptions();

	const overrides = $derived(overridesQuery.current ?? []);

	const modelOptions = $derived(modelOptionsQuery.current ?? []);
	const toolOptions = $derived(toolOptionsQuery.current ?? []);

	// Add override form state
	let showAddForm = $state(false);
	let newType = $state<'model' | 'tool' | 'feature'>('model');
	let newTargetId = $state('');
	let newReason = $state('');
	let newExpiresAt = $state('');
	let isAdding = $state(false);

	function getTargetLabel(type: string, targetId: string): string {
		if (type === 'model') {
			return modelOptions.find((m) => m.id === targetId)?.displayName ?? targetId;
		}
		if (type === 'tool') {
			return toolOptions.find((t) => t.id === targetId)?.displayName ?? targetId;
		}
		return targetId;
	}

	const targetOptions = $derived.by(() => {
		if (newType === 'model') return modelOptions.map((m) => ({ id: m.id, label: m.displayName }));
		if (newType === 'tool') return toolOptions.map((t) => ({ id: t.id, label: t.displayName }));
		return [];
	});

	async function handleAdd() {
		if (!newTargetId) {
			toast.error('Select a target');
			return;
		}
		isAdding = true;
		try {
			await createOverride({
				userId,
				override_type: newType,
				target_id: newTargetId,
				reason: newReason,
				expires_at: newExpiresAt || undefined
			});
			toast.success('Override created');
			showAddForm = false;
			newTargetId = '';
			newReason = '';
			newExpiresAt = '';
			overridesQuery.refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to create');
		} finally {
			isAdding = false;
		}
	}

	async function handleToggle(overrideId: string, active: boolean) {
		try {
			await toggleOverride({ overrideId, is_active: active });
			overridesQuery.refresh();
		} catch {
			toast.error('Failed to update');
		}
	}

	async function handleDelete(overrideId: string) {
		if (!confirm('Delete this override?')) return;
		try {
			await deleteOverride({ overrideId });
			toast.success('Override deleted');
			overridesQuery.refresh();
		} catch {
			toast.error('Failed to delete');
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-6 px-4 lg:px-6">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold">Tier Overrides</h3>
			<p class="text-xs text-muted-foreground">
				Grant access to specific models, tools, or features beyond the user's plan.
			</p>
		</div>
		<Button size="sm" class="gap-1.5" onclick={() => (showAddForm = !showAddForm)}>
			<Plus class="h-3.5 w-3.5" />
			Add Override
		</Button>
	</div>

	<!-- Add form -->
	{#if showAddForm}
		<div class="space-y-4 rounded-lg border border-border/40 bg-card/50 p-4">
			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label>Type</Label>
					<Select.Root
						type="single"
						value={newType}
						onValueChange={(v) => {
							newType = v as 'model' | 'tool' | 'feature';
							newTargetId = '';
						}}
					>
						<Select.Trigger>{newType}</Select.Trigger>
						<Select.Content>
							<Select.Item value="model">Model</Select.Item>
							<Select.Item value="tool">Tool</Select.Item>
							<Select.Item value="feature">Feature</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="grid gap-2">
					<Label>Target</Label>
					{#if newType === 'feature'}
						<Input bind:value={newTargetId} placeholder="Feature flag key" />
					{:else}
						<Select.Root type="single" value={newTargetId} onValueChange={(v) => (newTargetId = v)}>
							<Select.Trigger>
								{newTargetId
									? (targetOptions.find((o) => o.id === newTargetId)?.label ?? newTargetId)
									: 'Select…'}
							</Select.Trigger>
							<Select.Content>
								{#each targetOptions as opt}
									<Select.Item value={opt.id}>{opt.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{/if}
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label>Reason</Label>
					<Input bind:value={newReason} placeholder="Why this override?" />
				</div>
				<div class="grid gap-2">
					<Label>Expires At</Label>
					<Input type="datetime-local" bind:value={newExpiresAt} />
				</div>
			</div>
			<div class="flex justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => (showAddForm = false)}
					disabled={isAdding}
				>
					Cancel
				</Button>
				<Button size="sm" onclick={handleAdd} disabled={isAdding}>
					{isAdding ? 'Creating…' : 'Create'}
				</Button>
			</div>
		</div>
	{/if}

	<!-- Overrides list -->
	{#if overridesQuery.loading}
		<div class="py-8 text-center text-sm text-muted-foreground">Loading overrides…</div>
	{:else if overrides.length === 0}
		<div class="py-8 text-center text-sm text-muted-foreground">
			No tier overrides for this user.
		</div>
	{:else}
		<div class="divide-y divide-border/30 rounded-lg border border-border/40">
			{#each overrides as override (override.id)}
				<div class="flex items-center gap-3 px-4 py-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<Badge
								variant={override.overrideType === 'model' ? 'default' : 'secondary'}
								class="text-[10px]"
							>
								{override.overrideType}
							</Badge>
							<span class="text-sm font-medium">
								{getTargetLabel(override.overrideType ?? '', override.targetId ?? '')}
							</span>
							{#if !override.isActive}
								<Badge variant="outline" class="text-[10px]">disabled</Badge>
							{/if}
						</div>
						<p class="mt-0.5 text-xs text-muted-foreground">
							{#if override.reason}{override.reason} ·
							{/if}
							Created {formatDate(override.created ?? '')}
							{#if override.expiresAt}
								· Expires {formatDate(override.expiresAt)}{/if}
						</p>
					</div>
					<Switch
						checked={override.isActive ?? false}
						onCheckedChange={(v) => handleToggle(override.id, v)}
					/>
					<Button
						variant="ghost"
						size="sm"
						class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
						onclick={() => handleDelete(override.id)}
					>
						<Trash2 class="h-3.5 w-3.5" />
					</Button>
				</div>
			{/each}
		</div>
	{/if}
</div>
