<script lang="ts">
	import AiModelTab from '$lib/components/settings/AiModelTab.svelte';
	import AiPersonalityTab from '$lib/components/settings/AiPersonalityTab.svelte';
	import { getAvailableModels, getUserModelPreference } from '$lib/remote/models.remote';
	import { loadAiPersonality } from '$lib/remote/settings.remote';

	const models = await getAvailableModels();
	const currentPreferenceId = (await getUserModelPreference()) ?? null;
	const aiPersonality = await loadAiPersonality();
</script>

<div class="w-full space-y-12">
	<AiModelTab {models} {currentPreferenceId} />

	<AiPersonalityTab initialSettings={aiPersonality} />
</div>
