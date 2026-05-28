<script lang="ts">
	import Badge from '$lib/components/shadcn/badge/badge.svelte';
	import { labels } from '$lib/constants/table';

	let { value, label: labelValue }: { value: string; label?: string } = $props();

	let label = labels.find((label) => label.value === labelValue);
</script>

<div class="flex space-x-2">
	{#if label}
		<Badge variant="outline">{label.label}</Badge>
	{/if}
	<span class="max-w-[500px] truncate font-medium">
		{value}
	</span>
</div>
