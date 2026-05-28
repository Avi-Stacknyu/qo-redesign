<script lang="ts">
	import Button from '$lib/components/shadcn/button/button.svelte';
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { deleteProfiler } from './profiler.remote';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { row, onEdit }: { row: any; onEdit: () => void } = $props();

	let confirmOpen = $state(false);
	let deleting = $state(false);

	async function handleDelete() {
		deleting = true;
		try {
			const result = await deleteProfiler({ id: row.original.id });
			if (result?.success) {
				toast.success('Profiler deleted');
				confirmOpen = false;
				await invalidateAll();
			} else {
				toast.error(result?.error || 'Failed to delete profiler');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to delete profiler');
		} finally {
			deleting = false;
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
				<EllipsisIcon class="h-4 w-4" />
				<span class="sr-only">Open Menu</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="w-40" align="end">
		<DropdownMenu.Item onclick={onEdit}>Edit</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => (confirmOpen = true)} class="text-destructive">
			Delete
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<AlertDialog.Root bind:open={confirmOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete profiler?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete this profiler agent. Agents linked to it will lose their
				profiler configuration.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleDelete} disabled={deleting}>
				{#if deleting}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
