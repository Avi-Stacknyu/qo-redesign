<script lang="ts">
	import { priorities } from '$lib/constants/table';

	let { value }: { value: string } = $props();

	const priority = priorities.find((priority) => priority.value === value);
</script>

{#if priority}
	<div class="flex items-center">
		<priority.icon class="mr-2 size-4 text-muted-foreground" />
		<span>{priority.label}</span>
	</div>
{/if}
