<script lang="ts">
	import ProfileTab from '$lib/components/settings/ProfileTab.svelte';

	let { data } = $props();
</script>

<ProfileTab
	profile={data.profile}
	defaultAgentId={data.defaultAgentId}
	graph={data.graph}
	files={data.files}
/>
