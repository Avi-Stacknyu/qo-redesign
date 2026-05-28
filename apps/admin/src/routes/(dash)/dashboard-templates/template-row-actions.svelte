<script lang="ts">
	import Button from '$lib/components/shadcn/button/button.svelte';
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { deleteTemplate } from './template.remote';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { row, onEdit }: { row: any; onEdit: () => void } = $props();

	let confirmOpen = $state(false);
	let deleting = $state(false);

	async function handleDelete() {
		deleting = true;
		try {
			const result = await deleteTemplate({ id: row.original.id });
			if (result?.success) {
				toast.success('Template deleted');
				confirmOpen = false;
				await invalidateAll();
			} else {
				toast.error(result?.error || 'Failed to delete template');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to delete template');
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
		<DropdownMenu.Item onclick={() => goto(`/dashboard-templates/${row.original.id}`)}
			>Visual Editor</DropdownMenu.Item
		>
		<DropdownMenu.Item onclick={onEdit}>Edit</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item onclick={() => (confirmOpen = true)} class="text-destructive">
			Delete
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<AlertDialog.Root bind:open={confirmOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete template?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete this dashboard template. Users currently using it will keep
				their existing layouts.
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
