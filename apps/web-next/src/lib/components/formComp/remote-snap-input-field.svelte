<script lang="ts">
	import * as Field from '$lib/components/shadcn/field/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';

	let {
		formAttributes,
		name,
		placeholder,
		label,
		description,
		type = 'text',
		isCol2 = false,
		isTextarea = false,
		disabled = false,
		inputProps = {}
	}: {
		formAttributes: any;
		name: string;
		placeholder: string;
		label?: string;
		description?: string;
		type?: string;
		isCol2?: boolean;
		isTextarea?: boolean;
		disabled?: boolean;
		inputProps?: Record<string, any>;
	} = $props();

	const fieldValue = $derived(String(formAttributes.fields[name]?.value() ?? ''));
	const isDisabled = $derived(disabled || !!formAttributes.pending);
	const issues = $derived(formAttributes.fields[name]?.issues() ?? []);
</script>

<Field.Field class={isCol2 ? 'md:col-span-2' : ''}>
	{#if label}
		<Field.Label for={name}>{label}</Field.Label>
	{/if}
	{#if isTextarea}
		<textarea
			{name}
			value={fieldValue}
			oninput={(e) => formAttributes.fields[name].set(e.currentTarget.value)}
			{placeholder}
			disabled={isDisabled}
			class="flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
		></textarea>
	{:else}
		<Input
			{name}
			type={type as any}
			value={fieldValue}
			oninput={(e) => formAttributes.fields[name].set(e.currentTarget.value)}
			{placeholder}
			min={inputProps?.min}
			max={inputProps?.max}
			step={inputProps?.step}
			disabled={isDisabled}
			class='h-12 bg-white'
		/>
	{/if}
	{#if description}
		<Field.Description>{description}</Field.Description>
	{/if}

	{#each issues as issue}
		<Field.Error>{issue.message}</Field.Error>
	{/each}
</Field.Field>
