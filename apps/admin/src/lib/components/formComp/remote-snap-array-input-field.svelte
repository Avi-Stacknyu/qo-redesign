<script lang="ts">
	import * as Form from '$lib/components/shadcn/form/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import type { SuperForm } from 'sveltekit-superforms';
	import X from '@lucide/svelte/icons/x';

	let {
		form,
		name,
		placeholder,
		label,
		description,
		disabled = false
	}: {
		form: SuperForm<any>;
		name: string;
		placeholder: string;
		label?: string;
		description?: string;
		disabled?: boolean;
	} = $props();

	let formData = $derived(form.form);
	let submitting = $derived(form.submitting);
	let items = $derived.by(() => {
		const fieldName = name;
		const value = $formData[fieldName];

		return Array.isArray(value) ? value : [];
	});

	$effect(() => {
		const fieldName = name;
		if (!Array.isArray($formData[fieldName])) {
			$formData[fieldName] = [];
		}
	});

	let currentInput = $state('');

	function addItem() {
		const nextItem = currentInput.trim();
		if (nextItem === '') return;

		const fieldName = name;
		if (!items.includes(nextItem)) {
			$formData[fieldName] = [...items, nextItem];
		}

		currentInput = '';
	}

	function removeItem(index: number) {
		const fieldName = name;
		$formData[fieldName] = items.filter((_, i) => i !== index);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addItem();
		} else if (event.key === 'Backspace' && currentInput === '') {
			// Remove the last item when backspace is pressed in an empty input
			if (items.length > 0) {
				const fieldName = name;
				$formData[fieldName] = items.slice(0, -1);
			}
		}
	}
</script>

<Form.Field {form} {name}>
	<Form.Control>
		{#snippet children({ props })}
			{#if label}
				<Form.Label>{label}</Form.Label>
			{/if}

			<div
				class="flex flex-wrap gap-2 rounded-md border p-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
			>
				{#each items as item, index (item)}
					<Badge variant="secondary" class="flex items-center gap-1">
						{item}
						<button
							type="button"
							class="ml-1 text-muted-foreground hover:text-foreground"
							onclick={() => removeItem(index)}
							disabled={disabled || $submitting}
						>
							<X class="size-3" />
							<span class="sr-only">Remove {item}</span>
						</button>
					</Badge>
				{/each}

				<Input
					{...props}
					class="h-7 min-w-32 flex-1 border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
					bind:value={currentInput}
					onkeydown={handleKeyDown}
					onblur={addItem}
					disabled={disabled || $submitting}
					placeholder={items.length ? '' : placeholder}
				/>
			</div>
		{/snippet}
	</Form.Control>
	{#if description}
		<Form.Description>
			{description}
		</Form.Description>
	{/if}
	<Form.FieldErrors />
</Form.Field>
