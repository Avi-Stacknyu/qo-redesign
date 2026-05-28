<script lang="ts">
	import type { AvailableModel } from '$lib/remote/models.remote';
	import { saveUserModelPreference } from '$lib/remote/models.remote';
	import { cn } from '$lib/utils';
	import { Check, ChevronDown, Loader2, Sparkles } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let {
		models,
		currentPreferenceId = null
	}: {
		models: AvailableModel[];
		currentPreferenceId: string | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let selectedId = $state<string | null>(currentPreferenceId);
	let isSaving = $state(false);
	let expandedProviders = $state<Set<string>>(new Set());

	const systemDefault = $derived(models.find((m) => m.is_system_default) ?? null);

	const groupedModels = $derived.by(() => {
		const groups = new Map<string, { providerName: string; models: AvailableModel[] }>();
		for (const m of models) {
			const existing = groups.get(m.provider_key);
			if (existing) existing.models.push(m);
			else groups.set(m.provider_key, { providerName: m.provider_name, models: [m] });
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	// Auto-expand the provider that contains the selected model
	$effect(() => {
		if (selectedId) {
			for (const [key, group] of groupedModels) {
				if (group.models.some((m) => m.id === selectedId)) {
					expandedProviders.add(key);
					break;
				}
			}
		}
	});

	function toggleProvider(key: string) {
		if (expandedProviders.has(key)) expandedProviders.delete(key);
		else expandedProviders.add(key);
		expandedProviders = new Set(expandedProviders);
	}

	async function selectModel(modelId: string | null) {
		if (modelId === selectedId) return;
		const previous = selectedId;
		selectedId = modelId;
		isSaving = true;
		try {
			await saveUserModelPreference({ model_id: modelId });
			toast.success(modelId ? 'Default model updated' : 'Switched to system default');
		} catch {
			selectedId = previous;
			toast.error('Failed to save model preference');
		} finally {
			isSaving = false;
		}
	}
</script>

<section class="space-y-5" aria-label="AI Model settings">
	<div class="flex items-start justify-between">
		<div class="space-y-1">
			<h2 class="text-xl font-semibold tracking-tight text-foreground">AI Model</h2>
			<p class="text-sm text-muted-foreground">
				Choose your default model. Per-chat overrides are available in the chat input.
			</p>
		</div>
		{#if isSaving}
			<Loader2 class="size-4 animate-spin text-muted-foreground" />
		{/if}
	</div>

	<!-- System Default Option -->
	<button
		type="button"
		onclick={() => selectModel(null)}
		class={cn(
			'flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200',
			!selectedId
				? 'border-primary bg-primary/5 shadow-sm'
				: 'border-border/30 bg-muted/10 hover:border-border/50 hover:bg-muted/20'
		)}
	>
		<div
			class={cn(
				'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
				!selectedId ? 'bg-primary/15 text-primary' : 'bg-muted/50 text-muted-foreground'
			)}
		>
			<Sparkles class="size-5" />
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-medium text-foreground">System Default</p>
			<p class="text-xs text-muted-foreground">
				{systemDefault ? systemDefault.display_name : 'Configured by admin'} — automatically updated
			</p>
		</div>
		{#if !selectedId}
			<div
				class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
			>
				<Check class="size-3" />
			</div>
		{/if}
	</button>

	<!-- Provider Groups (Accordion) -->
	<div class="space-y-2">
		{#each groupedModels as [key, group] (key)}
			{@const isExpanded = expandedProviders.has(key)}
			{@const hasSelected = group.models.some((m) => m.id === selectedId)}
			<div class="overflow-hidden rounded-xl border border-border/30 bg-card/50 backdrop-blur">
				<button
					type="button"
					onclick={() => toggleProvider(key)}
					class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
				>
					<span class="text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase">
						{group.providerName}
					</span>
					{#if hasSelected}
						<span
							class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
						>
							Active
						</span>
					{/if}
					<span class="ml-auto text-[11px] text-muted-foreground/50">
						{group.models.length} model{group.models.length > 1 ? 's' : ''}
					</span>
					<ChevronDown
						class={cn(
							'size-4 text-muted-foreground/50 transition-transform duration-200',
							isExpanded && 'rotate-180'
						)}
					/>
				</button>

				{#if isExpanded}
					<div class="border-t border-border/20 px-2 py-2">
						{#each group.models as model (model.id)}
							{@const isSelected = model.id === selectedId}
							<button
								type="button"
								onclick={() => selectModel(model.id)}
								class={cn(
									'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150',
									isSelected
										? 'bg-primary/8 text-foreground'
										: 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
								)}
							>
								<div
									class={cn(
										'flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
										isSelected
											? 'border-primary bg-primary'
											: 'border-muted-foreground/30 bg-transparent'
									)}
								>
									{#if isSelected}
										<Check class="size-2.5 text-primary-foreground" />
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">{model.display_name}</p>
								</div>
								{#if model.context_window}
									<span class="shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
										{Math.round(model.context_window / 1000)}K
									</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>
