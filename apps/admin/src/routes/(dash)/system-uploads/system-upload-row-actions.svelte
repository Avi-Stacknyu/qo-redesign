<script lang="ts">
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu';
	import * as Dialog from '$lib/components/shadcn/dialog';
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog';
	import { Button } from '$lib/components/shadcn/button';
	import { Input } from '$lib/components/shadcn/input';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import type { AiSystemUploadRow } from '@repo/db/types';
	import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import { deleteSystemUpload, updateSystemUploadDescription } from './system-uploads.remote';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Loader2 from '@lucide/svelte/icons/loader-2';

	interface Props {
		row: {
			original: AiSystemUploadRow;
		};
	}

	let { row }: Props = $props();
	let isEditDialogOpen = $state(false);
	let confirmOpen = $state(false);
	let deleting = $state(false);
	let description = $state('');

	// Use $derived to track row changes
	const upload = $derived(row.original);

	function openEditDialog() {
		description = upload.description || '';
		isEditDialogOpen = true;
	}

	async function handleDelete() {
		deleting = true;
		try {
			const result = await deleteSystemUpload({ id: upload.id });
			if (result?.success) {
				toast.success('File deleted');
				confirmOpen = false;
				await invalidateAll();
			} else {
				toast.error(result?.error || 'Delete failed');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Delete failed');
		} finally {
			deleting = false;
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="h-8 w-8">
				<MoreHorizontal class="h-4 w-4" />
				<span class="sr-only">Open menu</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item onclick={openEditDialog}>
			<Pencil class="mr-2 h-4 w-4" />
			Edit Description
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
			<AlertDialog.Title>Delete file?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete this system file and remove its vectors/graph nodes.
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

<Dialog.Root bind:open={isEditDialogOpen}>
	<Dialog.Content class="sm:max-w-125">
		<Dialog.Header>
			<Dialog.Title>Edit File Description</Dialog.Title>
			<Dialog.Description>
				Add a description to help the AI understand when to use this file. Be specific about what
				information this file contains.
			</Dialog.Description>
		</Dialog.Header>

		<form
			{...updateSystemUploadDescription.enhance(async ({ submit }) => {
				try {
					await submit();
					await invalidateAll();

					if (updateSystemUploadDescription.result?.success) {
						toast.success('Description updated');
						isEditDialogOpen = false;
					} else if ((updateSystemUploadDescription.result as any)?.error) {
						toast.error((updateSystemUploadDescription.result as any).error || 'Update failed');
					}
				} catch (e) {
					toast.error((e as Error).message || 'Update failed');
				}
			})}
		>
			<input type="hidden" name="id" value={upload.id} />
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label>File Name</Label>
					<Input value={upload.name} disabled class="bg-muted" />
				</div>
				<div class="grid gap-2">
					<Label for="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						bind:value={description}
						placeholder="e.g., Company policies and procedures document covering HR guidelines, vacation policies, and employee benefits..."
						rows={4}
					/>
					<p class="text-xs text-muted-foreground">
						Tip: Describe what topics or questions this file can answer.
					</p>
				</div>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (isEditDialogOpen = false)}>
					Cancel
				</Button>
				<Button
					type="submit"
					disabled={!!updateSystemUploadDescription.pending}
					aria-busy={!!updateSystemUploadDescription.pending}
				>
					{#if updateSystemUploadDescription.pending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Saving…
					{:else}
						Save Description
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
