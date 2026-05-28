<script lang="ts">
	import Button from '$lib/components/shadcn/button/button.svelte';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import { setSystemDefaultModel, toggleSyncLock } from './model.remote';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import ModelDeleteDialog from './model-delete-dialog.svelte';

	let { row, onEdit } = $props();

	let deleteDialogOpen = $state(false);
	let settingDefault = $state(false);
	let togglingLock = $state(false);

	const syncStatus = $derived(row.original.syncStatus as string | null);
	const isLocked = $derived(syncStatus === 'override');
	const isSynced = $derived(syncStatus === 'synced' || syncStatus === 'override');

	async function handleSetDefault() {
		settingDefault = true;
		try {
			const result = await setSystemDefaultModel({ id: row.original.id });
			if (result?.success) {
				toast.success(
					`${row.original.displayName ?? row.original.modelId ?? 'Model'} set as system default`
				);
				await invalidateAll();
			} else {
				toast.error(result?.error || 'Failed to set system default');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to set system default');
		} finally {
			settingDefault = false;
		}
	}

	async function handleToggleLock() {
		togglingLock = true;
		try {
			const result = await toggleSyncLock({ id: row.original.id });
			if (result?.success) {
				toast.success(
					result.syncStatus === 'override' ? 'Model locked from sync' : 'Model unlocked for sync'
				);
				await invalidateAll();
			} else {
				toast.error(result?.error || 'Failed to toggle sync lock');
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to toggle sync lock');
		} finally {
			togglingLock = false;
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
	<DropdownMenu.Content class="w-48" align="end">
		<DropdownMenu.Item onclick={onEdit}>Edit</DropdownMenu.Item>
		<DropdownMenu.Item
			onclick={handleSetDefault}
			disabled={settingDefault || row.original.isSystemDefault}
		>
			{settingDefault ? 'Setting…' : '⭐ Set as Default'}
		</DropdownMenu.Item>
		{#if isSynced}
			<DropdownMenu.Item onclick={handleToggleLock} disabled={togglingLock}>
				{togglingLock ? 'Toggling…' : isLocked ? '🔓 Unlock from Sync' : '🔒 Lock from Sync'}
			</DropdownMenu.Item>
		{/if}
		<DropdownMenu.Separator />
		<DropdownMenu.Item onclick={() => (deleteDialogOpen = true)} class="text-destructive">
			Delete
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

<ModelDeleteDialog
	bind:open={deleteDialogOpen}
	modelId={row.original.id}
	modelName={row.original.displayName ?? row.original.modelId ?? 'Unknown'}
/>
