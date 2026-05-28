<script lang="ts">
	import Badge from '$lib/components/shadcn/badge/badge.svelte';
	import { CircleCheckIcon } from '@lucide/svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import type { Row } from '@tanstack/table-core';
	let { row }: { row: Row<any> } = $props();
</script>

<!-- 
{#if status}
	<div class="flex w-[100px] items-center">
		<status.icon class="mr-2 size-4 text-muted-foreground" />
		<span>{status.label}</span>
	</div>
{/if} -->

<Badge variant="outline" class="px-1.5 text-muted-foreground">
	{#if row.original.status === 'Done'}
		<CircleCheckIcon class="fill-green-500 dark:fill-green-400" />
	{:else}
		<LoaderIcon />
	{/if}
	{row.original.status}
</Badge>
