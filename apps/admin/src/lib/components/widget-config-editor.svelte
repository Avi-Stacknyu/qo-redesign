<script lang="ts">
	import { Input } from '$lib/components/shadcn/input/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import { Checkbox } from '$lib/components/shadcn/checkbox/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import type { ConfigFieldDescriptor } from '@repo/shared/types';

	let {
		configFields = [],
		value = {},
		onchange,
		disabled = false
	}: {
		configFields: ConfigFieldDescriptor[];
		value: Record<string, unknown>;
		onchange: (value: Record<string, unknown>) => void;
		disabled?: boolean;
	} = $props();

	// Filter out user-dynamic source fields (admin can't resolve categories/dataSources)
	let fields = $derived(configFields.filter((f) => !f.source));

	function update(key: string, val: unknown) {
		onchange({ ...value, [key]: val });
	}

	function getVal(key: string, def: unknown): unknown {
		return value[key] !== undefined ? value[key] : def;
	}

	function fillDefaults() {
		const filled: Record<string, unknown> = { ...value };
		for (const f of fields) {
			if (filled[f.key] === undefined && f.defaultValue !== undefined)
				filled[f.key] = f.defaultValue;
		}
		onchange(filled);
	}
</script>

{#if fields.length === 0}
	<p class="py-3 text-center text-sm text-muted-foreground">
		No configurable fields for this widget.
	</p>
{:else}
	<div class="space-y-3">
		{#if Object.keys(value).length === 0}
			<button
				type="button"
				class="w-full rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
				onclick={fillDefaults}
				{disabled}
			>
				Populate with defaults
			</button>
		{/if}
		{#each fields as field (field.key)}
			{@const current = getVal(field.key, field.defaultValue)}
			<div class="grid grid-cols-[1fr_1.2fr] items-center gap-3">
				<Label class="text-sm">{field.label}</Label>

				{#if field.type === 'select' && field.options}
					<Select.Root
						type="single"
						value={String(current ?? '')}
						onValueChange={(v) => update(field.key, v)}
						{disabled}
					>
						<Select.Trigger class="h-8 text-sm">
							{field.options.find((o) => o.value === String(current))?.label ??
								current ??
								field.options[0]?.label}
						</Select.Trigger>
						<Select.Content>
							{#each field.options as opt}
								<Select.Item value={opt.value}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{:else if field.type === 'toggle'}
					<div class="flex items-center">
						<Checkbox
							checked={!!current}
							onCheckedChange={(v) => update(field.key, !!v)}
							{disabled}
						/>
					</div>
				{:else if field.type === 'number'}
					<Input
						type="number"
						class="h-8 text-sm"
						value={String(current ?? '')}
						min={field.min}
						max={field.max}
						oninput={(e) => {
							const n = Number((e.target as HTMLInputElement).value);
							if (!isNaN(n)) update(field.key, n);
						}}
						{disabled}
					/>
				{:else}
					<Input
						type="text"
						class="h-8 text-sm"
						value={String(current ?? '')}
						placeholder={field.placeholder}
						oninput={(e) => update(field.key, (e.target as HTMLInputElement).value)}
						{disabled}
					/>
				{/if}
			</div>
		{/each}
	</div>
{/if}
