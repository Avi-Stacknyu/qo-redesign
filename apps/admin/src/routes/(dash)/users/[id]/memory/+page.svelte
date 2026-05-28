<script lang="ts">
	import GraphVisualizer from '../graph-visualizer.svelte';
	import { getUserMemory } from '../user-details.remote';

	const memoryQuery = getUserMemory();
	const memory = $derived(memoryQuery.current);
</script>

<div class="px-4 lg:px-6">
	<GraphVisualizer graphData={memory} loading={memoryQuery.loading} />
</div>
