<script module lang="ts">
	export interface SchemaProperty {
		type: string;
		title?: string;
		description?: string;
		default?: unknown;
		enum?: string[];
		minimum?: number;
		maximum?: number;
		const?: unknown;
		properties?: Record<string, SchemaProperty>;
		required?: string[];
		'x-field-type'?: 'select' | 'slider' | 'checkbox' | 'textarea' | 'object';
		'x-display-order'?: number;
		'x-collapsed'?: boolean;
	}

	export interface JSONSchema {
		type?: string;
		properties?: Record<string, SchemaProperty>;
		required?: string[];
	}
</script>

<script lang="ts">
	/**
	 * Dynamic JSON Schema Form Renderer
	 * Renders form fields based on JSON Schema (from model options_schema or tool config_schema)
	 *
	 * Supports x-field-type hints:
	 * - select: dropdown
	 * - slider: range slider with min/max
	 * - checkbox: boolean toggle
	 * - textarea: multi-line text
	 * - object: nested form (collapsible)
	 */
	import { Input } from '$lib/components/shadcn/input';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import { Slider } from '$lib/components/shadcn/slider';
	import * as Select from '$lib/components/shadcn/select';
	import * as Collapsible from '$lib/components/shadcn/collapsible';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import SchemaForm from './schema-form.svelte'; // Self import for recursion

	interface Props {
		schema: JSONSchema | null | undefined;
		values: Record<string, unknown>;
		onUpdate: (values: Record<string, unknown>) => void;
		compact?: boolean;
	}

	let { schema, values, onUpdate, compact = false }: Props = $props();

	// Sort properties by x-display-order
	let sortedProperties = $derived.by(() => {
		if (!schema?.properties) return [];

		return Object.entries(schema.properties)
			.map(([key, prop]) => ({ key, prop }))
			.sort((a, b) => {
				const orderA = a.prop['x-display-order'] ?? 999;
				const orderB = b.prop['x-display-order'] ?? 999;
				return orderA - orderB;
			});
	});

	function updateValue(key: string, value: unknown) {
		onUpdate({ ...values, [key]: value });
	}

	function updateNestedValue(key: string, nestedValues: Record<string, unknown>) {
		const current = (values[key] as Record<string, unknown>) ?? {};
		onUpdate({ ...values, [key]: { ...current, ...nestedValues } });
	}

	function getFieldType(prop: SchemaProperty): string {
		if (prop['x-field-type']) return prop['x-field-type'];
		if (prop.enum) return 'select';
		if (prop.type === 'boolean') return 'checkbox';
		if (prop.type === 'number' && prop.minimum !== undefined && prop.maximum !== undefined)
			return 'slider';
		if (prop.type === 'object' && prop.properties) return 'object';
		return 'text';
	}
</script>

{#if schema?.properties && sortedProperties.length > 0}
	<div class={compact ? 'space-y-2' : 'space-y-4'}>
		{#each sortedProperties as { key, prop }}
			{@const fieldType = getFieldType(prop)}
			{@const currentValue = values[key] ?? prop.default}

			{#if fieldType === 'object' && prop.properties}
				<!-- Nested Object (Collapsible) -->
				<Collapsible.Root open={!prop['x-collapsed']}>
					<Collapsible.Trigger
						class="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50"
					>
						<span>{prop.title ?? key}</span>
						<ChevronDown class="h-4 w-4" />
					</Collapsible.Trigger>
					<Collapsible.Content class="mt-2 rounded-md border bg-muted/10 p-3">
						{#if prop.description}
							<p class="mb-2 text-xs text-muted-foreground">{prop.description}</p>
						{/if}
						<SchemaForm
							schema={{ type: 'object', properties: prop.properties, required: prop.required }}
							values={(currentValue as Record<string, unknown>) ?? {}}
							onUpdate={(v: Record<string, unknown>) => updateNestedValue(key, v)}
							compact
						/>
					</Collapsible.Content>
				</Collapsible.Root>
			{:else if fieldType === 'select' && prop.enum}
				<!-- Select Dropdown -->
				<div class="space-y-1">
					<Label class="text-xs">{prop.title ?? key}</Label>
					<Select.Root
						type="single"
						value={(currentValue as string) ?? ''}
						onValueChange={(v) => updateValue(key, v)}
					>
						<Select.Trigger class={compact ? 'h-8 text-xs' : ''}>
							{currentValue ?? 'Select...'}
						</Select.Trigger>
						<Select.Content>
							{#each prop.enum as option}
								<Select.Item value={option}>{option}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if prop.description}
						<p class="text-xs text-muted-foreground">{prop.description}</p>
					{/if}
				</div>
			{:else if fieldType === 'slider'}
				<!-- Range Slider -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label class="text-xs">{prop.title ?? key}</Label>
						<span class="font-mono text-xs text-muted-foreground"
							>{currentValue ?? prop.default ?? prop.minimum}</span
						>
					</div>
					<Slider
						type="single"
						value={Number(currentValue ?? prop.default ?? prop.minimum ?? 0)}
						min={prop.minimum ?? 0}
						max={prop.maximum ?? 100}
						step={prop.type === 'number' && prop.maximum && prop.maximum <= 2 ? 0.1 : 1}
						onValueCommit={(v: number) => updateValue(key, v)}
					/>
					{#if prop.description}
						<p class="text-xs text-muted-foreground">{prop.description}</p>
					{/if}
				</div>
			{:else if fieldType === 'checkbox'}
				<!-- Checkbox -->
				<div class="flex items-start gap-2">
					<Checkbox
						id={key}
						checked={(currentValue as boolean) ?? false}
						onCheckedChange={(v) => updateValue(key, v)}
					/>
					<div class="space-y-0.5">
						<Label for={key} class="cursor-pointer text-sm">{prop.title ?? key}</Label>
						{#if prop.description}
							<p class="text-xs text-muted-foreground">{prop.description}</p>
						{/if}
					</div>
				</div>
			{:else if fieldType === 'textarea'}
				<!-- Textarea -->
				<div class="space-y-1">
					<Label class="text-xs">{prop.title ?? key}</Label>
					<Textarea
						value={(currentValue as string) ?? ''}
						onblur={(e) => updateValue(key, e.currentTarget.value)}
						placeholder={prop.description}
						rows={3}
						class={compact ? 'text-xs' : ''}
					/>
				</div>
			{:else}
				<!-- Text/Number Input -->
				<div class="space-y-1">
					<Label class="text-xs">{prop.title ?? key}</Label>
					<Input
						type={prop.type === 'number' ? 'number' : 'text'}
						value={(currentValue as string | number) ?? ''}
						onblur={(e) => {
							const val =
								prop.type === 'number'
									? e.currentTarget.value
										? Number(e.currentTarget.value)
										: undefined
									: e.currentTarget.value;
							updateValue(key, val);
						}}
						placeholder={prop.description}
						class={compact ? 'h-8 text-xs' : ''}
						min={prop.minimum}
						max={prop.maximum}
					/>
					{#if prop.description && fieldType !== 'text'}
						<p class="text-xs text-muted-foreground">{prop.description}</p>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{:else}
	<p class="text-xs text-muted-foreground">No configurable options</p>
{/if}
