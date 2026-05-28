<script lang="ts">
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import { Switch } from '$lib/components/shadcn/switch/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Separator } from '$lib/components/shadcn/separator/index.js';
	import type { ConfigFieldDescriptor } from '$lib/types/widgets';

	let {
		fields,
		values,
		getFieldOptions,
		onChange,
		onTagsChange
	}: {
		fields: ConfigFieldDescriptor[];
		values: Record<string, unknown>;
		getFieldOptions: (field: ConfigFieldDescriptor) => { value: string; label: string }[];
		onChange: (key: string, value: unknown) => void;
		onTagsChange: (key: string, value: string) => void;
	} = $props();

	function getTagsValue(key: string): string {
		const val = values[key];
		if (Array.isArray(val)) return val.join(', ');
		return '';
	}

	// Track which category fields are in "create new" mode
	let creatingCategory = $state<Record<string, boolean>>({});
	let newCategoryInput = $state<Record<string, string>>({});

	function startCreatingCategory(key: string) {
		creatingCategory[key] = true;
		newCategoryInput[key] = '';
	}

	function confirmNewCategory(key: string) {
		const val = newCategoryInput[key]?.trim();
		if (val) onChange(key, val);
		creatingCategory[key] = false;
		newCategoryInput[key] = '';
	}
</script>

{#if fields.length > 0}
	<Separator />
	<div class="space-y-5">
		{#each fields as field (field.key)}
			{@const options = getFieldOptions(field)}
			<div class="space-y-2.5">
				<Label
					for={field.key}
					class="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
				>
					{field.label}
				</Label>

				{#if field.type === 'select' && (options.length > 0 || field.source === 'categories')}
					{#if creatingCategory[field.key]}
						<div class="flex items-center gap-1.5">
							<Input
								class="h-8 flex-1 text-sm"
								placeholder="New category name..."
								bind:value={newCategoryInput[field.key]}
								autofocus
								onkeydown={(e: KeyboardEvent) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										confirmNewCategory(field.key);
									}
									if (e.key === 'Escape') creatingCategory[field.key] = false;
								}}
							/>
							<Button
								variant="ghost"
								size="sm"
								class="h-8 px-2 text-xs"
								onclick={() => confirmNewCategory(field.key)}
								disabled={!newCategoryInput[field.key]?.trim()}
							>
								Add
							</Button>
						</div>
					{:else}
						<Select.Root
							type="single"
							value={(values[field.key] as string) ?? ''}
							onValueChange={(v) => {
								if (v === '__new__') {
									startCreatingCategory(field.key);
									return;
								}
								onChange(field.key, v === '__all__' ? undefined : v);
							}}
						>
							<Select.Trigger class="w-full">
								{options.find((o) => o.value === values[field.key])?.label ??
									(values[field.key]
										? String(values[field.key])
										: field.placeholder || 'All')}
							</Select.Trigger>
							<Select.Content>
								{#if field.source === 'categories'}
									<Select.Item value="__all__" label="All (no filter)" />
								{/if}
								{#each options as option (option.value)}
									<Select.Item value={option.value} label={option.label} />
								{/each}
								{#if field.source === 'categories'}
									<Select.Item value="__new__" label="+ Create new..." />
								{/if}
							</Select.Content>
						</Select.Root>
					{/if}
				{:else if field.type === 'number'}
					<Input
						id={field.key}
						type="number"
						min={field.min}
						max={field.max}
						value={values[field.key] ?? ''}
						oninput={(e) =>
							onChange(field.key, Number((e.target as HTMLInputElement).value))}
					/>
				{:else if field.type === 'toggle'}
					<div
						class="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3"
					>
						<span class="text-sm font-medium">Enable Feature</span>
						<Switch
							checked={!!values[field.key]}
							onCheckedChange={(v) => onChange(field.key, v)}
						/>
					</div>
				{:else if field.type === 'tags'}
					<Input
						id={field.key}
						value={getTagsValue(field.key)}
						oninput={(e) =>
							onTagsChange(field.key, (e.target as HTMLInputElement).value)}
						placeholder={field.placeholder ?? 'tag1, tag2...'}
					/>
					<p class="text-[10px] text-muted-foreground">Comma-separated values</p>
				{:else}
					<Input
						id={field.key}
						value={values[field.key] ?? ''}
						oninput={(e) =>
							onChange(field.key, (e.target as HTMLInputElement).value)}
						placeholder={field.placeholder}
					/>
				{/if}
			</div>
		{/each}
	</div>
{/if}
