<script lang="ts">
	import AiModelTab from '$lib/components/settings/AiModelTab.svelte';
	import AiPersonalityTab from '$lib/components/settings/AiPersonalityTab.svelte';
	import { getAvailableModels, getUserModelPreference } from '$lib/remote/models.remote';
	import { loadAiPersonality } from '$lib/remote/settings.remote';
	import { Separator } from '$lib/components/shadcn/separator/index.js';

	const models = await getAvailableModels();
	const currentPreferenceId = (await getUserModelPreference()) ?? null;
	const aiPersonality = await loadAiPersonality();
</script>

<div class="max-w-3xl space-y-8">
	<AiModelTab {models} {currentPreferenceId} />

	<Separator class="bg-border/30" />

	<AiPersonalityTab initialSettings={aiPersonality} />
</div>
