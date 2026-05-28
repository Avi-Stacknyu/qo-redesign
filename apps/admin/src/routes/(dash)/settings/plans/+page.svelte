<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import * as Sheet from '$lib/components/shadcn/sheet';
	import { Pencil, Plus } from '@lucide/svelte';
	import { getNamespaceColor } from '$lib/utils/tag-helpers';
	import PlanForm from './plan-form.svelte';
	import {
		getModelOptions,
		getPlans,
		getToolOptions,
		getTagCatalogOptions,
		getAgentsByTag
	} from './plans.remote';

	type PlanRow = Record<string, any>;

	const plans = (await getPlans()) ?? [];
	const modelOptions = (await getModelOptions()) ?? [];
	const toolOptions = (await getToolOptions()) ?? [];
	const tagOptions = (await getTagCatalogOptions()) ?? [];
	const agentsByTag = (await getAgentsByTag()) ?? {};

	let isSheetOpen = $state(false);
	let selectedPlan = $state<PlanRow | null>(null);

	function handleEdit(plan: PlanRow) {
		selectedPlan = plan;
		isSheetOpen = true;
	}

	function handleAdd() {
		selectedPlan = null;
		isSheetOpen = true;
	}

	function typeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' | 'destructive' {
		switch (type) {
			case 'pro':
			case 'enterprise':
				return 'default';
			case 'topup':
				return 'secondary';
			case 'trial':
				return 'outline';
			default:
				return 'outline';
		}
	}
</script>

<div class="flex flex-col gap-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Plan Packages</h2>
			<p class="text-sm text-muted-foreground">
				Manage subscription tiers, credit packs, and tier gating.
			</p>
		</div>
		<Button onclick={handleAdd} class="gap-1.5">
			<Plus class="h-4 w-4" />
			Add Plan
		</Button>
	</div>

	{#if plans.length === 0}
		<div class="py-12 text-center text-sm text-muted-foreground">
			No plans yet. Create one to get started.
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each plans as plan (plan.id)}
				{@const grantedTags = (plan.grantedTags as string[]) ?? []}
				<button
					type="button"
					onclick={() => handleEdit(plan)}
					class="group relative flex flex-col gap-3 rounded-xl border border-border/40 bg-card/50 p-5 text-left transition-colors hover:border-border hover:bg-card"
				>
					<div class="flex items-start justify-between">
						<div class="space-y-1">
							<h3 class="text-sm font-semibold">{plan.title}</h3>
							{#if plan.subtitle}
								<p class="text-xs text-muted-foreground">{plan.subtitle}</p>
							{/if}
						</div>
						<Pencil
							class="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
						/>
					</div>

					<div class="flex flex-wrap gap-1.5">
						<Badge variant={typeBadgeVariant(plan.type ?? '')} class="text-[10px]">
							{plan.type}
						</Badge>
						{#if plan.isSubscription}
							<Badge variant="outline" class="text-[10px]">subscription</Badge>
						{/if}
						{#if !plan.isActive}
							<Badge variant="destructive" class="text-[10px]">inactive</Badge>
						{/if}
						{#if plan.isArchived}
							<Badge variant="secondary" class="text-[10px]">archived</Badge>
						{/if}
						{#if plan.highlight}
							<Badge variant="default" class="text-[10px]">featured</Badge>
						{/if}
					</div>

					{#if grantedTags.length > 0}
						<div class="flex flex-wrap gap-1">
							{#each grantedTags as tag}
								<Badge
									variant="outline"
									class="{getNamespaceColor(tag.split(':')[0] ?? '')} px-1.5 py-0 text-[10px]"
								>
									{tag}
								</Badge>
							{/each}
						</div>
					{/if}

					<div
						class="mt-auto space-y-1 border-t border-border/30 pt-3 text-xs text-muted-foreground"
					>
						<p>
							<span class="font-medium text-foreground"
								>{Number(plan.credits ?? 0).toLocaleString()}</span
							> credits
						</p>
						{#if plan.expand?.allowed_models?.length}
							<p>{plan.expand.allowed_models.length} allowed models</p>
						{:else}
							<p>All models</p>
						{/if}
						{#if plan.expand?.fallback_model}
							<p>Fallback: {plan.expand.fallback_model.displayName}</p>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<Sheet.Root bind:open={isSheetOpen}>
	<Sheet.Content class="overflow-y-auto sm:max-w-125">
		<Sheet.Header>
			<Sheet.Title>{selectedPlan ? 'Edit Plan' : 'Add Plan'}</Sheet.Title>
			<Sheet.Description>Configure plan details, pricing, and tier gating rules.</Sheet.Description>
		</Sheet.Header>

		{#key isSheetOpen}
			<PlanForm
				plan={selectedPlan as any}
				modelOptions={modelOptions as any}
				toolOptions={toolOptions as any}
				{tagOptions}
				{agentsByTag}
				onsuccess={() => {
					isSheetOpen = false;
				}}
			/>
		{/key}
	</Sheet.Content>
</Sheet.Root>
