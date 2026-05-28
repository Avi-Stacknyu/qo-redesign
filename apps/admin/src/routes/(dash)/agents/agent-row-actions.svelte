<script lang="ts">
	import Button from '$lib/components/shadcn/button/button.svelte';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import { deleteAgent } from './agent.remote';
	import { toast } from 'svelte-sonner';
	import { invalidateAll, goto } from '$app/navigation';

	let { row, onEdit } = $props();

	let isDiscovery = $derived(row.original.purpose === 'discovery');

	$effect(() => {
		if (deleteAgent.result?.success) {
			toast.success('Agent deleted');
			invalidateAll();
		} else if (deleteAgent.result?.error) {
			toast.error(deleteAgent.result.error);
		}
	});
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
				<EllipsisIcon />
				<span class="sr-only">Open Menu</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="w-40" align="end">
		<DropdownMenu.Item onclick={() => goto(`/agents/${row.original.id}`)}
			>View Details</DropdownMenu.Item
		>
		<DropdownMenu.Item onclick={onEdit}>Edit</DropdownMenu.Item>
		{#if !isDiscovery}
			<DropdownMenu.Item class="p-0">
				<form
					{...deleteAgent}
					class="w-full"
					onsubmit={(e) => {
						if (!confirm('Are you sure you want to delete this agent?')) {
							e.preventDefault();
						}
					}}
				>
					<input type="hidden" name="id" value={row.original.id} />
					<button
						type="submit"
						class="relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm text-destructive transition-colors outline-none select-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
					>
						Delete
					</button>
				</form>
			</DropdownMenu.Item>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
