<script lang="ts">
	import MemoryTab from '$lib/components/account/memory/MemoryTab.svelte';

	let { data } = $props();
</script>

<MemoryTab
	profile={data.profile}
	defaultAgentId={data.defaultAgentId}
	graph={data.graph}
	files={data.files}
/>
