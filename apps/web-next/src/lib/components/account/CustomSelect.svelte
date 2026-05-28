<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { cn } from '$lib/utils';
	import type { SelectOption } from './types';

	let {
		value,
		options = [],
		placeholder = 'Choose Option',
		class: className = '',
		contentClass = '',
		itemClass = '',
		onValueChange
	}: {
		value?: string;
		options?: readonly SelectOption[];
		placeholder?: string;
		class?: string;
		contentClass?: string;
		itemClass?: string;
		onValueChange?: (value: string) => void;
	} = $props();

	let selectedLabel = $derived(
		options.find((option) => option.value === value)?.label ?? placeholder
	);

	function handleValueChange(nextValue: string) {
		onValueChange?.(nextValue);
	}
</script>

<Select.Root type="single" {value} onValueChange={handleValueChange}>
	<Select.Trigger
		class={cn(
			'h-13! min-w-44 rounded-full border-0 bg-muted px-6 font-medium tracking-[-0.02em] text-muted-foreground shadow-none ring-0 transition-all hover:bg-white/50 focus-visible:ring-0 focus-visible:ring-offset-0 data-placeholder:text-muted-foreground [&_svg]:size-[1.15rem] [&_svg]:text-[#8a90a2]',
			className
		)}
	>
		<span class="truncate">{selectedLabel}</span>
	</Select.Trigger>

	<Select.Content class={cn('rounded-[1.5rem] border-0 bg-popover p-2 shadow-xl', contentClass)}>
		{#each options as option (option.value)}
			<Select.Item
				value={option.value}
				disabled={option.disabled}
				class={cn('rounded-2xl px-4 py-3 font-medium text-slate-600', itemClass)}
			>
				{option.label}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>