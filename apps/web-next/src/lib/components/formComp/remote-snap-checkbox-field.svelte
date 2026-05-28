<script lang="ts">
	import { Checkbox } from '$lib/components/shadcn/checkbox/index.js';
	import * as Field from '$lib/components/shadcn/field/index.js';
	import type { RemoteForm } from '@sveltejs/kit';

	let {
		formAttributes,
		name,
		label,
		description,
		isCol2 = false
	}: {
		formAttributes: RemoteForm<any, any>;
		name: string;
		label?: string;
		description?: string;
		isCol2?: boolean;
	} = $props();
</script>

<Field.Field
	orientation="horizontal"
	class="flex items-start space-y-0 space-x-3 rounded-md border p-4 {isCol2 ? 'md:col-span-2' : ''}"
>
	<Checkbox
		id={name}
		checked={!!formAttributes.fields[name].value()}
		onCheckedChange={(v) => formAttributes.fields[name].set(!!v)}
	/>
	<input class="hidden" {...formAttributes.fields[name].as('checkbox')} />
	<div class="space-y-1 leading-none">
		{#if label}
			<Field.Label for={name}>{label}</Field.Label>
		{/if}
		{#if description}
			<Field.Description>
				{@html description}
			</Field.Description>
		{/if}
	</div>
	{#each formAttributes.fields[name].issues() ?? [] as issue}
		<Field.Error>{issue.message}</Field.Error>
	{/each}
</Field.Field>
