<script lang="ts">
	import GeneralTab from '$lib/components/settings/GeneralTab.svelte';
	import { loadHomeLocation } from '$lib/remote/settings.remote';
	import { page } from '$app/stores';

	const homeLocation = await loadHomeLocation();
</script>

<div class="w-full">
	<GeneralTab
		userName={$page.data.user?.name ?? ''}
		userEmail={$page.data.user?.email ?? ''}
		userAvatar={$page.data.user?.avatar ?? ''}
		{homeLocation}
	/>
</div>
