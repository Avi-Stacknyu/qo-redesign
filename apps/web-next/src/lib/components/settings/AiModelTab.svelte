<script lang="ts">
	import CustomSelect from '$lib/components/account/CustomSelect.svelte';
	import type { SelectOption } from '$lib/components/account/types';
	import type { AvailableModel } from '$lib/remote/models.remote';
	import { saveUserModelPreference } from '$lib/remote/models.remote';
	import { Cpu, Loader2, Sparkles } from '@lucide/svelte';
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

	const SYSTEM_MODEL_VALUE = '__system__';

	const systemDefault = $derived(models.find((m) => m.is_system_default) ?? null);
	const selectedModel = $derived(models.find((model) => model.id === selectedId) ?? null);
	const modelOptions = $derived<SelectOption[]>([
		{
			value: SYSTEM_MODEL_VALUE,
			label: systemDefault ? `System Default (${systemDefault.display_name})` : 'System Default'
		},
		...models.map((model) => ({
			value: model.id,
			label: `${model.provider_name} - ${model.display_name}`
		}))
	]);

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

<section class="flex flex-col gap-6" aria-label="AI Model settings">
	<div class="flex flex-col gap-1.5">
		<h2 class="font-Inter text-3xl font-medium text-foreground">AI Model</h2>
		<p class="text-lg font-light text-muted-foreground">
			Choose your default model. Per-chat overrides are available in the chat input.
		</p>
	</div>

	<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
		<div class="flex flex-col gap-1.5">
			<h3 class="font-Inter text-2xl font-medium text-primary">Default System</h3>
			<p class="font-light text-muted-foreground">Pick the model used for new conversations.</p>
		</div>

		<CustomSelect
			value={selectedId ?? SYSTEM_MODEL_VALUE}
			options={modelOptions}
			onValueChange={(value) => selectModel(value === SYSTEM_MODEL_VALUE ? null : value)}
		/>
	</div>

	<div class="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
		<div class="rounded-[2rem] border border-border/40 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
			<div class="flex items-center gap-3">
				<div class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					<Cpu class="size-5" />
				</div>
				<div>
					<p class="text-sm font-medium text-muted-foreground">Active Selection</p>
					<h4 class="font-Inter text-2xl font-medium text-foreground">
						{selectedModel?.display_name ?? systemDefault?.display_name ?? 'System Default'}
					</h4>
				</div>
			</div>

			<div class="mt-5 grid gap-3 sm:grid-cols-2">
				<div class="rounded-[1.5rem] bg-muted/60 p-4">
					<p class="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Provider</p>
					<p class="mt-2 text-base font-medium text-foreground">
						{selectedModel?.provider_name ?? systemDefault?.provider_name ?? 'Admin configured'}
					</p>
				</div>
				<div class="rounded-[1.5rem] bg-muted/60 p-4">
					<p class="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Context Window</p>
					<p class="mt-2 text-base font-medium text-foreground">
						{selectedModel?.context_window
							? `${Math.round(selectedModel.context_window / 1000)}K tokens`
							: systemDefault?.context_window
								? `${Math.round(systemDefault.context_window / 1000)}K tokens`
								: 'Managed automatically'}
					</p>
				</div>
			</div>
		</div>

		<div class="rounded-[2rem] border border-primary/15 bg-primary/5 p-6">
			<div class="flex items-center gap-2 text-primary">
				<Sparkles class="size-4" />
				<span class="text-sm font-semibold tracking-[0.18em] uppercase">Status</span>
			</div>
			<p class="mt-4 text-lg font-medium text-foreground">
				{selectedId ? 'Custom model selected' : 'Using system default'}
			</p>
			<p class="mt-2 text-sm leading-6 text-muted-foreground">
				Changes save immediately and apply to new chats. Existing chats can still override the model per thread.
			</p>
			{#if isSaving}
				<div class="mt-4 inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
					<Loader2 class="size-4 animate-spin" />
					Saving selection...
				</div>
			{/if}
		</div>
	</div>
</section>
