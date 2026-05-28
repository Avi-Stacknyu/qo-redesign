<script lang="ts">
	import * as Dialog from '$lib/components/shadcn/dialog/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateFamilyMember, getFamilyMembers } from '$lib/remote/family-office.remote';
	import ResponsibilityInput from './ResponsibilityInput.svelte';

	type FamilyMember = {
		id: string;
		name: string | null;
		role: string | null;
		email: string | null;
		responsibilities: unknown;
	};

	let {
		open = $bindable(false),
		memberId,
		members,
		onclose
	}: {
		open: boolean;
		memberId: string;
		members: FamilyMember[];
		onclose: () => void;
	} = $props();

	const member = $derived(members.find((m) => m.id === memberId));

	let name = $state('');
	let role = $state('');
	let email = $state('');
	let responsibilities = $state<string[]>([]);
	let isSaving = $state(false);

	$effect(() => {
		if (member && open) {
			name = member.name ?? '';
			role = member.role ?? '';
			email = member.email ?? '';
			responsibilities = Array.isArray(member.responsibilities) ? [...member.responsibilities] : [];
		}
	});

	async function save() {
		if (!name.trim()) return;
		isSaving = true;
		try {
			await updateFamilyMember({
				id: memberId,
				name: name.trim(),
				role: role.trim(),
				email: email.trim(),
				responsibilities
			}).updates(getFamilyMembers());
			toast.success('Member updated');
			onclose();
		} catch {
			toast.error('Failed to update member');
		} finally {
			isSaving = false;
		}
	}

	function handleOpenChange(val: boolean) {
		if (!val) onclose();
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit Member</Dialog.Title>
			<Dialog.Description>Update {member?.name ?? 'member'} details.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<div class="grid gap-3 sm:grid-cols-2">
				<Input bind:value={name} placeholder="Name *" class="text-sm" />
				<Input bind:value={role} placeholder="Role" class="text-sm" />
			</div>
			<Input bind:value={email} placeholder="Email" class="text-sm" />
			<ResponsibilityInput values={responsibilities} onchange={(v) => (responsibilities = v)} />
		</div>
		<div class="flex justify-end gap-2 pt-2">
			<Button size="sm" variant="outline" onclick={onclose} disabled={isSaving}>Cancel</Button>
			<Button size="sm" onclick={save} disabled={!name.trim() || isSaving} class="gap-1.5">
				{#if isSaving}
					<div
						class="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
				{:else}
					<Check class="size-3.5" />
				{/if}
				Save
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
