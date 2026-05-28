<script lang="ts">
	import Button from '$lib/components/shadcn/button/button.svelte';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		resetUserOnboarding,
		resetUserOnboardingAndMemory,
		deleteUser
	} from '$lib/remote/user.remote';
	import { toast } from 'svelte-sonner';

	let { row } = $props();

	async function handleResetOnboarding() {
		const user = row.original;
		if (
			!confirm(
				`Reset onboarding for "${user.name || user.email}"? Their current onboarding assignment will be cleared and they will choose a profile again.`
			)
		)
			return;
		try {
			await resetUserOnboarding({ userId: user.id });
			toast.success('Onboarding reset successfully');
			await invalidateAll();
		} catch (e) {
			toast.error((e as Error).message || 'Failed to reset onboarding');
		}
	}

	async function handleResetOnboardingAndMemory() {
		const user = row.original;
		if (
			!confirm(
				`Reset onboarding AND clear ALL memory for "${user.name || user.email}"? This will delete all learned facts, profile data, notes, suggestions, and cached summaries. This cannot be undone.`
			)
		)
			return;
		try {
			await resetUserOnboardingAndMemory({ userId: user.id });
			toast.success('Onboarding and memory cleared successfully');
			await invalidateAll();
		} catch (e) {
			toast.error((e as Error).message || 'Failed to reset');
		}
	}
	async function handleDeleteUser() {
		const user = row.original;
		if (
			!confirm(
				`Permanently delete user "${user.name || user.email}"? This will remove the user account, all their data, and cannot be undone.`
			)
		)
			return;
		try {
			await deleteUser({ userId: user.id });
			toast.success('User deleted successfully');
			await invalidateAll();
		} catch (e) {
			toast.error((e as Error).message || 'Failed to delete user');
		}
	}
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
	<DropdownMenu.Content class="w-48" align="end">
		<DropdownMenu.Item onclick={() => goto(`/users/${row.original.id}`)}
			>View Profile</DropdownMenu.Item
		>
		<DropdownMenu.Item onclick={handleResetOnboarding}>Reset Onboarding</DropdownMenu.Item>
		<DropdownMenu.Item class="text-destructive" onclick={handleResetOnboardingAndMemory}
			>Reset & Clear Memory</DropdownMenu.Item
		>
		<DropdownMenu.Separator />
		<DropdownMenu.Item class="text-destructive" onclick={handleDeleteUser}
			>Delete User</DropdownMenu.Item
		>
	</DropdownMenu.Content>
</DropdownMenu.Root>
