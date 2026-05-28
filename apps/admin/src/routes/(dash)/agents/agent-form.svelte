<script lang="ts">
	import { Input } from '$lib/components/shadcn/input';
	import { Button } from '$lib/components/shadcn/button';
	import * as Select from '$lib/components/shadcn/select';
	import { Label } from '$lib/components/shadcn/label';
	import { Separator } from '$lib/components/shadcn/separator';
	import { saveAgent } from './agent.remote';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { AiAgentRow } from '@repo/db/types';
	import type { TagRule } from '@repo/shared/types';
	import { AvatarUpload, VisibilityRules } from './[id]/settings';

	let { agent, onsuccess } = $props<{
		agent: AiAgentRow | null;
		onsuccess?: () => void;
	}>();

	let isDiscovery = $derived(agent?.purpose === 'discovery');
	let isEditing = $derived(!!agent?.id);

	// Initialize form with agent data if exists
	$effect(() => {
		if (agent) {
			saveAgent.fields.id.set(agent.id);
			saveAgent.fields.name.set(agent.name);
			saveAgent.fields.description.set(agent.description);
			saveAgent.fields.status.set(agent.status);
			saveAgent.fields.purpose.set(agent.purpose ?? 'chat');
		} else {
			saveAgent.fields.id.set('');
			saveAgent.fields.name.set('');
			saveAgent.fields.description.set('');
			saveAgent.fields.status.set('development');
			saveAgent.fields.purpose.set('chat');
		}
	});
</script>

<form
	{...saveAgent.enhance(async ({ submit }) => {
		try {
			await submit();
			await invalidateAll();
			if (saveAgent.result?.success) {
				toast.success('Agent saved successfully');
				onsuccess?.();
			} else if (saveAgent.result?.error) {
				toast.error(saveAgent.result.error);
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save agent');
		}
	})}
	class="space-y-4"
>
	{#if saveAgent.result?.error}
		<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
			{saveAgent.result.error}
		</div>
	{/if}
	{#if agent?.id}
		<input type="hidden" name="id" value={saveAgent.fields.id.value()} />
	{/if}

	<div class="grid gap-2">
		<Label>Name</Label>
		<Input {...saveAgent.fields.name.as('text')} />
		{#each saveAgent.fields.name.issues() as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<div class="grid gap-2">
		<Label>Description</Label>
		<Input {...saveAgent.fields.description.as('text')} />
		{#each saveAgent.fields.description.issues() as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<div class="grid gap-2">
		<Label>Status</Label>
		{#if isDiscovery}
			<Input value="Active (managed)" disabled />
			<input type="hidden" {...saveAgent.fields.status.as('text')} class="hidden" />
		{:else}
			<Select.Root
				type="single"
				value={saveAgent.fields.status.value()}
				onValueChange={(v) =>
					saveAgent.fields.status.set(v as 'active' | 'inactive' | 'development')}
			>
				<Select.Trigger>
					{saveAgent.fields.status.value() || 'Select status'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="active">Active</Select.Item>
					<Select.Item value="inactive">Inactive</Select.Item>
					<Select.Item value="development">Development</Select.Item>
				</Select.Content>
			</Select.Root>
			<input type="hidden" {...saveAgent.fields.status.as('text')} class="hidden" />
		{/if}
		{#each saveAgent.fields.status.issues() as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<!-- Purpose: hidden field, not editable -->
	<input type="hidden" {...saveAgent.fields.purpose.as('text')} class="hidden" />

	<div class="flex justify-end">
		<Button type="submit" disabled={!!saveAgent.pending}>
			{saveAgent.pending ? 'Saving...' : 'Save Agent'}
		</Button>
	</div>
</form>

<Separator class="my-6" />
<div class="space-y-6">
	{#if isEditing && agent}
		<AvatarUpload agentId={agent.id} />
		{#if !isDiscovery}
			<VisibilityRules
				agentId={agent.id}
				initialTagRule={(agent.tagRule as TagRule | null) ?? null}
				isUniversal={agent.isUniversal ?? false}
			/>
		{/if}
	{:else}
		<p class="text-sm text-muted-foreground">
			Save the agent first to configure avatar and visibility rules.
		</p>
	{/if}
</div>
