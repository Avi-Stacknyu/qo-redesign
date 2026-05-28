<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Input } from '$lib/components/shadcn/input';
	import { Label } from '$lib/components/shadcn/label';
	import * as Select from '$lib/components/shadcn/select';
	import { Switch } from '$lib/components/shadcn/switch';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import type { AiAgentModelRow, AiToolRow, PlanPackageRow } from '@repo/db/types';
	import type { TagCatalogWithNamespace } from '$lib/utils/tag-helpers';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import PlanGrantedTags from './plan-granted-tags.svelte';
	import PlanTierGates from './plan-tier-gates.svelte';

	import { toast } from 'svelte-sonner';
	import { savePlan, getPlans } from './plans.remote';

	type PlanWithRelations = PlanPackageRow & {
		expand?: {
			allowed_models?: AiAgentModelRow[];
			allowed_tools?: AiToolRow[];
			fallback_model?: AiAgentModelRow;
		};
	};

	let {
		plan,
		modelOptions,
		toolOptions,
		tagOptions,
		agentsByTag = {},
		onsuccess
	}: {
		plan: PlanWithRelations | null;
		modelOptions: AiAgentModelRow[];
		toolOptions: AiToolRow[];
		tagOptions: TagCatalogWithNamespace[];
		agentsByTag?: Record<string, { id: string; name: string }[]>;
		onsuccess?: () => void;
	} = $props();

	let selectedModels = $state<string[]>([]);
	let selectedTools = $state<string[]>([]);
	let selectedTags = $state<string[]>([]);

	$effect(() => {
		if (plan) {
			selectedModels = plan.expand?.allowed_models?.map((m) => m.id) ?? [];
			selectedTools = plan.expand?.allowed_tools?.map((t) => t.id) ?? [];
			selectedTags = (plan.grantedTags as string[]) ?? [];
			savePlan.fields.set({
				id: plan.id,
				title: plan.title ?? '',
				subtitle: plan.subtitle ?? '',
				description: plan.description ?? '',
				credits: String(plan.credits ?? 0),
				type: plan.type ?? 'pro',
				provider: plan.provider ?? 'stripe',
				product_id: plan.productId ?? '',
				stripe_price_id: plan.stripePriceId ?? '',
				is_subscription: String(plan.isSubscription ?? false),
				is_active: String(plan.isActive ?? true),
				is_archived: String(plan.isArchived ?? false),
				highlight: String(plan.highlight ?? false),
				points: plan.points ?? '',
				not_included_points: plan.notIncludedPoints ?? '',
				allowed_models: JSON.stringify(plan.expand?.allowed_models?.map((m) => m.id) ?? []),
				allowed_tools: JSON.stringify(plan.expand?.allowed_tools?.map((t) => t.id) ?? []),
				granted_tags: JSON.stringify((plan.grantedTags as string[]) ?? []),
				fallback_model: plan.fallbackModel ?? ''
			});
		} else {
			selectedModels = [];
			selectedTools = [];
			selectedTags = [];
			savePlan.fields.set({
				id: '',
				title: '',
				subtitle: '',
				description: '',
				credits: '0',
				type: 'pro',
				provider: 'stripe',
				product_id: '',
				stripe_price_id: '',
				is_subscription: 'true',
				is_active: 'true',
				is_archived: 'false',
				highlight: 'false',
				points: '',
				not_included_points: '',
				allowed_models: '[]',
				allowed_tools: '[]',
				granted_tags: '[]',
				fallback_model: ''
			});
		}
	});

	$effect(() => {
		savePlan.fields.allowed_models.set(JSON.stringify(selectedModels));
	});
	$effect(() => {
		savePlan.fields.allowed_tools.set(JSON.stringify(selectedTools));
	});
	$effect(() => {
		savePlan.fields.granted_tags.set(JSON.stringify(selectedTags));
	});

	function getModelLabel(id: string) {
		return modelOptions.find((m) => m.id === id)?.displayName ?? (id || 'None');
	}
</script>

<form
	{...savePlan.enhance(async ({ submit }) => {
		try {
			await submit().updates(getPlans);
			const res = savePlan.result as Record<string, unknown> | undefined;
			if (res?.success) {
				toast.success('Plan saved');
				onsuccess?.();
			} else if (res && 'error' in res) {
				toast.error('Failed: ' + res.error);
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save');
		}
	})}
	class="space-y-4 px-4"
>
	{#if savePlan.result}
		{@const res = savePlan.result as Record<string, unknown>}
		{#if 'error' in res}
			<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
				{res.error}
			</div>
		{/if}
	{/if}

	<input type="hidden" name="id" value={savePlan.fields.id.value()} />

	<div class="grid gap-2">
		<Label for="title">Title</Label>
		<Input {...savePlan.fields.title.as('text')} placeholder="e.g. Pro Plan" />
		{#each savePlan.fields.title.issues() as issue}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<div class="grid gap-2">
		<Label for="subtitle">Subtitle</Label>
		<Input {...savePlan.fields.subtitle.as('text')} placeholder="Short tagline" />
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="grid gap-2">
			<Label for="credits">Credits</Label>
			<Input {...savePlan.fields.credits.as('text')} type="number" min="0" step="1" />
		</div>
		<div class="grid gap-2">
			<Label>Type</Label>
			<Select.Root
				type="single"
				value={savePlan.fields.type.value()}
				onValueChange={(v) => savePlan.fields.type.set(v)}
			>
				<Select.Trigger>{savePlan.fields.type.value() || 'Select type'}</Select.Trigger>
				<Select.Content>
					{#each ['free', 'trial', 'pro', 'enterprise', 'topup'] as t}
						<Select.Item value={t}>{t}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<input type="hidden" name="type" value={savePlan.fields.type.value()} />
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="grid gap-2">
			<Label>Provider</Label>
			<Select.Root
				type="single"
				value={savePlan.fields.provider.value()}
				onValueChange={(v) => savePlan.fields.provider.set(v)}
			>
				<Select.Trigger>{savePlan.fields.provider.value() || 'Select'}</Select.Trigger>
				<Select.Content>
					<Select.Item value="stripe">Stripe</Select.Item>
					<Select.Item value="admin">Admin</Select.Item>
				</Select.Content>
			</Select.Root>
			<input type="hidden" name="provider" value={savePlan.fields.provider.value()} />
		</div>
		<div class="grid gap-2">
			<Label for="product_id">Product ID</Label>
			<Input {...savePlan.fields.product_id.as('text')} placeholder="prod_xxx" />
		</div>
	</div>

	<div class="grid gap-2">
		<Label for="stripe_price_id">Stripe Price ID</Label>
		<Input {...savePlan.fields.stripe_price_id.as('text')} placeholder="price_xxx" />
	</div>

	<div class="grid gap-2">
		<Label for="description">Description</Label>
		<Textarea {...savePlan.fields.description.as('text')} placeholder="Plan description..." />
	</div>

	<div class="grid gap-2">
		<Label for="points">Feature Points (HTML)</Label>
		<Textarea {...savePlan.fields.points.as('text')} placeholder="<li>Feature 1</li>" rows={3} />
	</div>

	<div class="grid gap-2">
		<Label for="not_included_points">Not Included Points (HTML)</Label>
		<Textarea
			{...savePlan.fields.not_included_points.as('text')}
			placeholder="<li>Not included</li>"
			rows={3}
		/>
	</div>

	<PlanTierGates
		{modelOptions}
		{toolOptions}
		bind:selectedModels
		bind:selectedTools
		modelsHiddenValue={savePlan.fields.allowed_models.value() ?? '[]'}
		toolsHiddenValue={savePlan.fields.allowed_tools.value() ?? '[]'}
	/>

	<!-- Granted Tags -->
	<PlanGrantedTags
		{tagOptions}
		bind:selectedTags
		{agentsByTag}
		hiddenValue={savePlan.fields.granted_tags.value() ?? '[]'}
	/>

	<!-- Fallback Model -->
	<div class="grid gap-2">
		<Label>Fallback Model</Label>
		<p class="text-xs text-muted-foreground">Cheapest model for subscribers when credits = 0</p>
		<Select.Root
			type="single"
			value={savePlan.fields.fallback_model.value() ?? ''}
			onValueChange={(v) => savePlan.fields.fallback_model.set(v)}
		>
			<Select.Trigger>
				{getModelLabel(savePlan.fields.fallback_model.value() ?? '')}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">None</Select.Item>
				{#each modelOptions as model}
					<Select.Item value={model.id}>{model.displayName}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<input
			type="hidden"
			name="fallback_model"
			value={savePlan.fields.fallback_model.value() ?? ''}
		/>
	</div>

	<!-- Toggles -->
	<div class="space-y-3">
		{#each [{ field: savePlan.fields.is_subscription, label: 'Subscription', desc: 'Recurring billing via Stripe', name: 'is_subscription' }, { field: savePlan.fields.is_active, label: 'Active', desc: 'Available for purchase', name: 'is_active' }, { field: savePlan.fields.is_archived, label: 'Archived', desc: 'Hidden from purchase UI', name: 'is_archived' }, { field: savePlan.fields.highlight, label: 'Highlight', desc: 'Featured in plan picker', name: 'highlight' }] as toggle}
			<div class="flex items-center justify-between rounded-md border p-3">
				<div>
					<p class="text-sm font-medium">{toggle.label}</p>
					<p class="text-xs text-muted-foreground">{toggle.desc}</p>
				</div>
				<div class="flex items-center gap-2">
					<Switch
						checked={toggle.field.value() === 'true'}
						onCheckedChange={(v) => toggle.field.set(String(v))}
					/>
					<input type="hidden" name={toggle.name} value={toggle.field.value()} />
				</div>
			</div>
		{/each}
	</div>

	<div class="flex justify-end">
		<Button type="submit" disabled={!!savePlan.pending} aria-busy={!!savePlan.pending}>
			{#if savePlan.pending}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				{plan ? 'Update' : 'Create'} Plan
			{/if}
		</Button>
	</div>
</form>
