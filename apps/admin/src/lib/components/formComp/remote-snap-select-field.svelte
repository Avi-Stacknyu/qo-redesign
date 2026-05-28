<script lang="ts">
	import * as Field from '$lib/components/shadcn/field/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';

	let {
		formAttributes,
		name,
		placeholder,
		description,

		label,
		rawList = [],
		formatedList = [],
		onSelectedChange = (s: any) => {},
		multiple = false,
		disabled = $bindable(false),
		showLabel = false,
		loading = false,
		triggerClass = ''
	}: {
		formAttributes: any;
		name: string;
		placeholder: string;
		description?: string;
		label?: string;
		rawList?: string[];
		formatedList?: { label: string; value: string }[];
		onSelectedChange?: (s: string | string[]) => void;
		multiple?: boolean;
		disabled?: boolean;
		showLabel?: boolean;
		loading?: boolean;
		triggerClass?: string;
	} = $props();

	// Build final list synchronously from props using $derived
	let finalList = $derived.by(() => {
		if (rawList && rawList.length > 0) {
			return rawList.map((c) => ({ label: c, value: c }));
		}
		if (formatedList && formatedList.length > 0) {
			return formatedList;
		}
		return [];
	});

	function labelForValue(value: string) {
		return finalList.find((c) => c.value === value)?.label ?? value;
	}
</script>

<Field.Field>
	{#if label}
		<Field.Label for={name}>{label}</Field.Label>
	{/if}
	{#if multiple}
		<Select.Root
			type="multiple"
			value={formAttributes.fields[name].value() as string[]}
			disabled={disabled || loading || !!formAttributes.pending}
			onValueChange={(s: string[]) => {
				formAttributes.fields[name].set(s as any);
				onSelectedChange(s);
			}}
		>
			<Select.Trigger class={`w-full ${triggerClass}`.trim()}>
				{#if loading}
					<span class="flex items-center gap-2">
						<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
								fill="none"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Loading...
					</span>
				{:else}
					{@const selected = formAttributes.fields[name].value() as string[]}
					{@const labels = Array.isArray(selected)
						? selected.map((v) => labelForValue(String(v)))
						: []}
					{labels.length ? labels.join(', ') : placeholder}
				{/if}
			</Select.Trigger>
			<Select.Content>
				{#each finalList as opt (opt.value)}
					<Select.Item value={opt.value} class="rounded-lg">{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	{:else}
		<Select.Root
			type="single"
			value={formAttributes.fields[name].value() as string}
			disabled={disabled || loading || !!formAttributes.pending}
			onValueChange={(s: string) => {
				formAttributes.fields[name].set(s as any);
				onSelectedChange(s);
			}}
		>
			<Select.Trigger class={`w-full ${triggerClass}`.trim()}>
				{#if loading}
					<span class="flex items-center gap-2">
						<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
								fill="none"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Loading...
					</span>
				{:else}
					{@const selected = formAttributes.fields[name].value() as string}
					{#if showLabel}
						{selected ? labelForValue(String(selected)) : placeholder}
					{:else}
						{selected ? String(selected) : placeholder}
					{/if}
				{/if}
			</Select.Trigger>
			<Select.Content>
				{#each finalList as opt (opt.value)}
					<Select.Item value={opt.value} class="rounded-lg">{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	{/if}
	<input type="hidden" {name} value={formAttributes.fields[name].value()} />
	{#if description}
		<Field.Description>{description}</Field.Description>
	{/if}

	{#each formAttributes.fields[name].issues() ?? [] as issue}
		<Field.Error>{issue.message}</Field.Error>
	{/each}
</Field.Field>
