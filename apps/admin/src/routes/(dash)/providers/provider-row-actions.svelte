<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu';
	import { Ellipsis, Pencil, Trash2 } from '@lucide/svelte';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import type { Row } from '@tanstack/table-core';
	import type { AiProviderRow } from '@repo/db/types';
	import { deleteProvider } from './provider.remote';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { row, onEdit } = $props<{
		row: Row<AiProviderRow>;
		onEdit: () => void;
	}>();

	let confirmOpen = $state(false);
	let deleting = $state(false);

	async function handleDelete() {
		deleting = true;
		try {
			await deleteProvider({ id: row.original.id });
			toast.success('Provider deleted');
			confirmOpen = false;
			await invalidateAll();
		} catch (e) {
			toast.error((e as Error).message || 'Failed to delete provider');
		} finally {
			deleting = false;
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="h-8 w-8 p-0">
				<span class="sr-only">Open menu</span>
				<Ellipsis class="h-4 w-4" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Label>Actions</DropdownMenu.Label>
		<DropdownMenu.Item onclick={onEdit}>
			<Pencil class="mr-2 h-4 w-4" />
			Edit
		</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item onclick={() => (confirmOpen = true)} class="text-destructive">
			<Trash2 class="mr-2 h-4 w-4" />
			Delete
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<AlertDialog.Root bind:open={confirmOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete provider?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete this provider configuration.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<Button variant="outline" onclick={() => (confirmOpen = false)} disabled={deleting}>
				Cancel
			</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={deleting}>
				{#if deleting}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Deleting…
				{:else}
					Delete
				{/if}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
