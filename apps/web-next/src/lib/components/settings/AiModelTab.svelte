<script lang="ts">
	import CustomSelect from '$lib/components/account/CustomSelect.svelte';
	import type { SelectOption } from '$lib/components/account/types';
	import type { AvailableModel } from '$lib/remote/models.remote';
	import { saveUserModelPreference } from '$lib/remote/models.remote';
	import { Loader2, Sparkles } from '@lucide/svelte';
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
	const activeModel = $derived(selectedModel ?? systemDefault);
	const activeSummary = $derived.by(() => {
		const model = activeModel;
		if (!model) return 'Automatically updated by your workspace admin';

		return `${model.provider_name}: ${model.display_name} - automatically updated`;
	});
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
		<h2 class="font-Inter text-3xl font-medium text-primary">AI Model</h2>
		<p class="text-muted-foreground">
			Choose your default model. Per-chat overrides are available in the chat input.
		</p>
	</div>

	<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
		<div class="flex flex-col gap-1">
			<h3 class="font-Inter text-xl font-medium text-foreground">Default System</h3>
			<p class="text-sm text-muted-foreground">Pick the model used for new conversations.</p>
		</div>

		<CustomSelect
			value={selectedId ?? SYSTEM_MODEL_VALUE}
			options={modelOptions}
			class="w-full min-w-0 sm:w-auto sm:min-w-72"
			contentClass="max-h-[18rem]"
			onValueChange={(value) => selectModel(value === SYSTEM_MODEL_VALUE ? null : value)}
		/>
	</div>

	<div class="w-full max-w-xl rounded-[1.5rem] border border-border/40 bg-card/90 px-4 py-3 shadow-sm">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex min-w-0 items-start gap-3">
				<div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
					<Sparkles class="size-4" />
				</div>
				<div class="min-w-0">
					<h4 class="font-Inter text-base font-medium text-foreground">System Default</h4>
					<p class="mt-1 text-sm leading-5 text-muted-foreground sm:pr-4">{activeSummary}</p>
				</div>
			</div>

			{#if isSaving}
				<div class="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
					<Loader2 class="size-4 animate-spin" />
					Saving...
				</div>
			{/if}
		</div>
	</div>
</section>
