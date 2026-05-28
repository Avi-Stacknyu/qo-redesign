<script lang="ts">
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { X, Check } from '@lucide/svelte';
	import ResponsibilityInput from './ResponsibilityInput.svelte';

	let {
		onsubmit,
		onclose,
		isSubmitting = false
	}: {
		onsubmit: (data: {
			name: string;
			role?: string;
			email?: string;
			responsibilities: string[];
		}) => void;
		onclose: () => void;
		isSubmitting?: boolean;
	} = $props();

	let name = $state('');
	let role = $state('');
	let email = $state('');
	let responsibilities = $state<string[]>([]);

	function handleSubmit() {
		if (!name.trim()) return;
		onsubmit({
			name: name.trim(),
			role: role.trim() || undefined,
			email: email.trim() || undefined,
			responsibilities
		});
	}
</script>

<div class="mb-6 rounded-xl border border-primary/20 bg-card/60 p-5 backdrop-blur">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-sm font-semibold text-foreground">Add New Member</h3>
		<Button size="icon" variant="ghost" class="size-7" onclick={onclose}>
			<X class="size-4" />
		</Button>
	</div>
	<div class="grid gap-3 sm:grid-cols-3">
		<Input bind:value={name} placeholder="Name *" class="text-sm" />
		<Input bind:value={role} placeholder="Role (e.g. CFO, Trustee)" class="text-sm" />
		<Input bind:value={email} placeholder="Email" class="text-sm" />
	</div>
	<div class="mt-3">
		<ResponsibilityInput values={responsibilities} onchange={(v) => (responsibilities = v)} />
	</div>
	<div class="mt-4 flex justify-end">
		<Button
			size="sm"
			onclick={handleSubmit}
			disabled={!name.trim() || isSubmitting}
			class="gap-1.5"
		>
			{#if isSubmitting}
				<div
					class="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
				></div>
			{:else}
				<Check class="size-3.5" />
			{/if}
			Add Member
		</Button>
	</div>
</div>
