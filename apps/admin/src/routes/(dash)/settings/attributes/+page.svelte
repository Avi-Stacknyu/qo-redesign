<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Table from '$lib/components/shadcn/table/index.js';
	import * as Dialog from '$lib/components/shadcn/dialog/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Textarea } from '$lib/components/shadcn/textarea/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import { Switch } from '$lib/components/shadcn/switch/index.js';
	import {
		Loader2,
		Plus,
		Pencil,
		Trash2,
		Settings,
		Database,
		Cloud,
		User,
		Info
	} from '@lucide/svelte';
	import * as Tabs from '$lib/components/shadcn/tabs/index.js';
	import AttributeInstructions from './attribute-instructions.svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';

	import {
		getAttributesData,
		saveAttribute,
		toggleAttribute,
		deleteAttributeAction
	} from './attributes.remote';

	// Types
	type AttributeCategory = 'identity' | 'preference' | 'contextual' | 'derived';
	type AttributeUsage = 'prompt_injection' | 'notifications' | 'compliance' | 'analytics';
	type SourceType = 'cf_header' | 'user_fact' | 'client_provided' | 'explicit' | 'derived';
	type DataType = 'string' | 'number' | 'boolean' | 'array' | 'date';

	// Query
	const data = await getAttributesData();
	let attributes = $derived<any[]>(data?.attributes ?? []);

	// Group by category
	let groupedAttributes = $derived(
		attributes.reduce(
			(acc, attr) => {
				const category = attr.category as AttributeCategory;
				if (!acc[category]) acc[category] = [];
				acc[category].push(attr);
				return acc;
			},
			{} as Record<AttributeCategory, any[]>
		)
	);

	// Dialog state
	let dialogOpen = $state(false);
	let editingAttribute = $state<any | null>(null);

	// Mutable state for complex form fields managed outside the form fields API
	let sourceConfig = $state<Record<string, any>>({});
	let allowedUsages = $state<AttributeUsage[]>(['prompt_injection']);

	// Category options with icons
	const categoryOptions: { value: AttributeCategory; label: string; icon: typeof User }[] = [
		{ value: 'identity', label: 'Identity', icon: User },
		{ value: 'preference', label: 'Preference', icon: Settings },
		{ value: 'contextual', label: 'Contextual', icon: Cloud },
		{ value: 'derived', label: 'Derived', icon: Database }
	];

	const usageOptions: { value: AttributeUsage; label: string }[] = [
		{ value: 'prompt_injection', label: 'Prompt Injection' },
		{ value: 'notifications', label: 'Notifications' },
		{ value: 'compliance', label: 'Compliance' },
		{ value: 'analytics', label: 'Analytics' }
	];

	const sourceTypeOptions: { value: SourceType; label: string; description: string }[] = [
		{ value: 'user_fact', label: 'User Fact', description: 'From graph memory (onboarding data)' },
		{ value: 'cf_header', label: 'CF Header', description: 'Cloudflare request header' },
		{ value: 'client_provided', label: 'Client Provided', description: 'From frontend request' },
		{ value: 'explicit', label: 'Explicit', description: 'System value (e.g., user.id)' },
		{ value: 'derived', label: 'Derived', description: 'Computed from other attributes' }
	];

	const dataTypeOptions: DataType[] = ['string', 'number', 'boolean', 'array', 'date'];

	function openCreateDialog() {
		editingAttribute = null;
		sourceConfig = {};
		allowedUsages = ['prompt_injection'];
		saveAttribute.fields.set({
			id: '',
			attribute_key: '',
			display_name: '',
			description: '',
			category: 'identity',
			allowed_usages: JSON.stringify(['prompt_injection']),
			source_type: 'user_fact',
			source_config: '{}',
			data_type: 'string',
			is_required_for_agents: 'false',
			is_active: 'true'
		});
		dialogOpen = true;
	}

	function openEditDialog(attr: any) {
		editingAttribute = attr;
		sourceConfig = (attr.sourceConfig as Record<string, any>) || {};
		allowedUsages = (attr.allowedUsages as AttributeUsage[]) || [];
		saveAttribute.fields.set({
			id: attr.id,
			attribute_key: attr.attributeKey,
			display_name: attr.displayName,
			description: attr.description || '',
			category: attr.category as AttributeCategory,
			allowed_usages: JSON.stringify(allowedUsages),
			source_type: attr.sourceType as SourceType,
			source_config: JSON.stringify(sourceConfig),
			data_type: attr.dataType as DataType,
			is_required_for_agents: attr.isRequiredForAgents ? 'true' : 'false',
			is_active: attr.isActive ? 'true' : 'false'
		});
		dialogOpen = true;
	}

	function toggleUsage(usage: AttributeUsage) {
		if (allowedUsages.includes(usage)) {
			allowedUsages = allowedUsages.filter((u) => u !== usage);
		} else {
			allowedUsages = [...allowedUsages, usage];
		}
		saveAttribute.fields.allowed_usages.set(JSON.stringify(allowedUsages));
	}

	function updateSourceConfig(key: string, value: any) {
		sourceConfig = { ...sourceConfig, [key]: value };
		saveAttribute.fields.source_config.set(JSON.stringify(sourceConfig));
	}

	async function handleDelete(attr: any) {
		if (!confirm(`Are you sure you want to delete "${attr.displayName}"?`)) return;
		try {
			await deleteAttributeAction({ id: attr.id });
			toast.success('Attribute deleted');
			await invalidateAll();
		} catch (e: any) {
			toast.error(e.message || 'Failed to delete');
		}
	}

	async function handleToggleActive(attr: any) {
		try {
			await toggleAttribute({ id: attr.id, is_active: !attr.isActive });
			toast.success(attr.isActive ? 'Attribute disabled' : 'Attribute enabled');
			await invalidateAll();
		} catch (e: any) {
			toast.error(e.message || 'Failed to toggle');
		}
	}

	function getCategoryColor(category: AttributeCategory): string {
		switch (category) {
			case 'identity':
				return 'bg-blue-500/10 text-blue-500';
			case 'preference':
				return 'bg-purple-500/10 text-purple-500';
			case 'contextual':
				return 'bg-amber-500/10 text-amber-500';
			case 'derived':
				return 'bg-emerald-500/10 text-emerald-500';
			default:
				return 'bg-gray-500/10 text-gray-500';
		}
	}

	function getSourceConfigLabel(attr: any): string {
		const config = attr.sourceConfig as Record<string, any>;
		switch (attr.sourceType) {
			case 'cf_header':
				return config?.header || '-';
			case 'user_fact':
				return config?.fact_key || '-';
			case 'client_provided':
				return config?.header_name || '-';
			case 'explicit':
				return config?.path || '-';
			case 'derived':
				return config?.derive_from?.join(', ') || '-';
			default:
				return '-';
		}
	}
</script>

<div class="container mx-auto max-w-6xl space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Dynamic Attributes</h1>
			<p class="text-sm text-muted-foreground">
				Configure attributes for agent visibility filtering and prompt injection
			</p>
		</div>
		<Button onclick={openCreateDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Add Attribute
		</Button>
	</div>

	<Tabs.Root value="attributes">
		<Tabs.List>
			<Tabs.Trigger value="attributes"><Database class="mr-1.5 h-4 w-4" />Attributes</Tabs.Trigger>
			<Tabs.Trigger value="instructions"><Info class="mr-1.5 h-4 w-4" />How It Works</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="attributes" class="mt-4 space-y-6">
			{#each categoryOptions as cat}
				{@const catAttributes = groupedAttributes[cat.value] || []}
				{@const IconComponent = cat.icon}
				{#if catAttributes.length > 0}
					<Card.Root>
						<Card.Header>
							<Card.Title class="flex items-center gap-2">
								<IconComponent class="h-5 w-5" />
								{cat.label} Attributes
							</Card.Title>
							<Card.Description>
								{#if cat.value === 'identity'}
									Permanent user facts (residence, age, etc.) - safe for agent visibility
								{:else if cat.value === 'preference'}
									User preferences (language, currency, etc.) - safe for agent visibility
								{:else if cat.value === 'contextual'}
									Temporary context (IP location, timezone) - NOT for agent visibility
								{:else}
									Computed attributes from other values
								{/if}
							</Card.Description>
						</Card.Header>
						<Card.Content>
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Key</Table.Head>
										<Table.Head>Name</Table.Head>
										<Table.Head>Source</Table.Head>
										<Table.Head>Usages</Table.Head>
										<Table.Head>Active</Table.Head>
										<Table.Head class="text-right">Actions</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each catAttributes as attr}
										<Table.Row class={!attr.isActive ? 'opacity-50' : ''}>
											<Table.Cell class="font-mono text-sm">{attr.attributeKey}</Table.Cell>
											<Table.Cell>{attr.displayName}</Table.Cell>
											<Table.Cell class="text-sm text-muted-foreground">
												<span class="font-medium">{attr.sourceType}</span>
												<span class="block text-xs">{getSourceConfigLabel(attr)}</span>
											</Table.Cell>
											<Table.Cell>
												<div class="flex flex-wrap gap-1">
													{#each (attr.allowedUsages || []) as AttributeUsage[] as usage}
														<Badge variant="outline" class="text-xs">
															{(usage as string).replace('_', ' ')}
														</Badge>
													{/each}
												</div>
											</Table.Cell>
											<Table.Cell>
												<Switch
													checked={attr.isActive}
													onCheckedChange={() => handleToggleActive(attr)}
												/>
											</Table.Cell>
											<Table.Cell class="text-right">
												<Button variant="ghost" size="icon" onclick={() => openEditDialog(attr)}>
													<Pencil class="h-4 w-4" />
												</Button>
												<Button variant="ghost" size="icon" onclick={() => handleDelete(attr)}>
													<Trash2 class="h-4 w-4 text-destructive" />
												</Button>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</Card.Content>
					</Card.Root>
				{/if}
			{/each}

			{#if attributes.length === 0}
				<Card.Root>
					<Card.Content class="py-12 text-center">
						<Database class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
						<h3 class="mb-2 text-lg font-medium">No attributes configured</h3>
						<p class="mb-4 text-muted-foreground">
							Dynamic attributes control agent visibility and personalization
						</p>
						<Button onclick={openCreateDialog}>
							<Plus class="mr-2 h-4 w-4" />
							Create First Attribute
						</Button>
					</Card.Content>
				</Card.Root>
			{/if}
		</Tabs.Content>
		<Tabs.Content value="instructions" class="mt-4">
			<AttributeInstructions />
		</Tabs.Content>
	</Tabs.Root>
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="max-w-xl">
		<Dialog.Header>
			<Dialog.Title>
				{editingAttribute ? 'Edit Attribute' : 'Create Attribute'}
			</Dialog.Title>
			<Dialog.Description>
				Configure how this attribute is resolved and used in the system
			</Dialog.Description>
		</Dialog.Header>

		<form
			{...saveAttribute.enhance(async ({ submit }) => {
				await submit().updates(getAttributesData);
				if (saveAttribute.result?.success) {
					toast.success(editingAttribute ? 'Attribute updated' : 'Attribute created');
					dialogOpen = false;
				} else if (saveAttribute.result?.error) {
					toast.error(saveAttribute.result.error ?? 'Failed to save');
				}
			})}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={saveAttribute.fields.id.value()} />
			<input type="hidden" name="category" value={saveAttribute.fields.category.value()} />
			<input type="hidden" name="data_type" value={saveAttribute.fields.data_type.value()} />
			<input type="hidden" name="source_type" value={saveAttribute.fields.source_type.value()} />
			<input
				type="hidden"
				name="source_config"
				value={saveAttribute.fields.source_config.value()}
			/>
			<input
				type="hidden"
				name="allowed_usages"
				value={saveAttribute.fields.allowed_usages.value()}
			/>
			<input
				type="hidden"
				name="is_required_for_agents"
				value={saveAttribute.fields.is_required_for_agents.value()}
			/>
			<input type="hidden" name="is_active" value={saveAttribute.fields.is_active.value()} />

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1">
					<Label for="attribute_key">Attribute Key</Label>
					<p class="text-xs text-muted-foreground">
						Unique snake_case ID. Cannot be changed later.
					</p>
					<Input
						id="attribute_key"
						{...saveAttribute.fields.attribute_key.as('text')}
						placeholder="residence_country"
						disabled={!!editingAttribute}
						required
					/>
				</div>
				<div class="space-y-1">
					<Label for="display_name">Display Name</Label>
					<p class="text-xs text-muted-foreground">Human-readable label shown in admin UI.</p>
					<Input
						id="display_name"
						{...saveAttribute.fields.display_name.as('text')}
						placeholder="Residence Country"
						required
					/>
				</div>
			</div>

			<div class="space-y-1">
				<Label for="description">Description</Label>
				<p class="text-xs text-muted-foreground">
					Optional explanation of what this attribute represents.
				</p>
				<Textarea
					id="description"
					{...saveAttribute.fields.description.as('text')}
					placeholder="User's permanent country of residence"
					rows={2}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1">
					<Label>Category</Label>
					<p class="text-xs text-muted-foreground">
						Identity/Preference = stable user facts. Contextual = per-request. Derived = computed.
					</p>
					<Select.Root
						type="single"
						value={saveAttribute.fields.category.value()}
						onValueChange={(v) => v && saveAttribute.fields.category.set(v)}
					>
						<Select.Trigger>
							{categoryOptions.find((c) => c.value === saveAttribute.fields.category.value())
								?.label || 'Select...'}
						</Select.Trigger>
						<Select.Content>
							{#each categoryOptions as cat}
								<Select.Item value={cat.value}>{cat.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-1">
					<Label>Data Type</Label>
					<p class="text-xs text-muted-foreground">
						Value type: string, number, boolean, array, or date.
					</p>
					<Select.Root
						type="single"
						value={saveAttribute.fields.data_type.value()}
						onValueChange={(v) => v && saveAttribute.fields.data_type.set(v)}
					>
						<Select.Trigger>
							{saveAttribute.fields.data_type.value()}
						</Select.Trigger>
						<Select.Content>
							{#each dataTypeOptions as dt}
								<Select.Item value={dt}>{dt}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div class="space-y-1">
				<Label>Source Type</Label>
				<p class="text-xs text-muted-foreground">
					Where this attribute's value comes from at runtime.
				</p>
				<Select.Root
					type="single"
					value={saveAttribute.fields.source_type.value()}
					onValueChange={(v) => {
						if (v) {
							saveAttribute.fields.source_type.set(v);
							sourceConfig = {};
							saveAttribute.fields.source_config.set('{}');
						}
					}}
				>
					<Select.Trigger>
						{sourceTypeOptions.find((s) => s.value === saveAttribute.fields.source_type.value())
							?.label || 'Select...'}
					</Select.Trigger>
					<Select.Content>
						{#each sourceTypeOptions as st}
							<Select.Item value={st.value}>
								<div>
									<div>{st.label}</div>
									<div class="text-xs text-muted-foreground">{st.description}</div>
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if saveAttribute.fields.source_type.value() === 'cf_header'}
				<div class="space-y-1">
					<Label for="header">CF Header Name</Label>
					<p class="text-xs text-muted-foreground">
						Cloudflare header to read (e.g. cf-ipcountry, cf-connecting-ip).
					</p>
					<Input
						id="header"
						value={sourceConfig?.header || ''}
						oninput={(e) => updateSourceConfig('header', e.currentTarget.value)}
						placeholder="cf-ipcountry"
					/>
				</div>
			{:else if saveAttribute.fields.source_type.value() === 'user_fact'}
				<div class="space-y-1">
					<Label for="fact_key">Fact Key</Label>
					<p class="text-xs text-muted-foreground">
						The fact_key from graph memory, set during onboarding.
					</p>
					<Input
						id="fact_key"
						value={sourceConfig?.fact_key || ''}
						oninput={(e) => updateSourceConfig('fact_key', e.currentTarget.value)}
						placeholder="residence_country"
					/>
				</div>
			{:else if saveAttribute.fields.source_type.value() === 'client_provided'}
				<div class="space-y-1">
					<Label for="header_name">Request Header Name</Label>
					<p class="text-xs text-muted-foreground">
						HTTP header the frontend sends with this value.
					</p>
					<Input
						id="header_name"
						value={sourceConfig?.header_name || ''}
						oninput={(e) => updateSourceConfig('header_name', e.currentTarget.value)}
						placeholder="x-user-locale"
					/>
				</div>
			{:else if saveAttribute.fields.source_type.value() === 'explicit'}
				<div class="space-y-1">
					<Label for="path">System Path</Label>
					<p class="text-xs text-muted-foreground">
						Dot-notation path to a system value (e.g. user.id, user.email).
					</p>
					<Input
						id="path"
						value={sourceConfig?.path || ''}
						oninput={(e) => updateSourceConfig('path', e.currentTarget.value)}
						placeholder="user.id"
					/>
				</div>
			{:else if saveAttribute.fields.source_type.value() === 'derived'}
				<div class="space-y-1">
					<Label for="derive_from">Derive From (comma-separated keys)</Label>
					<p class="text-xs text-muted-foreground">
						Other attribute keys this value is computed from.
					</p>
					<Input
						id="derive_from"
						value={(sourceConfig?.derive_from || []).join(', ')}
						oninput={(e) =>
							updateSourceConfig(
								'derive_from',
								e.currentTarget.value
									.split(',')
									.map((s) => s.trim())
									.filter(Boolean)
							)}
						placeholder="residence_country, nationality"
					/>
				</div>
			{/if}

			<div class="space-y-1">
				<Label>Allowed Usages</Label>
				<p class="text-xs text-muted-foreground">
					Click to toggle. At least one required. "Prompt Injection" = injected into agent system
					prompts.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each usageOptions as usage}
						<Badge
							variant={allowedUsages.includes(usage.value) ? 'default' : 'outline'}
							class="cursor-pointer"
							onclick={() => toggleUsage(usage.value)}
						>
							{usage.label}
						</Badge>
					{/each}
				</div>
			</div>

			<div class="flex items-center justify-between">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<Switch
							id="is_required"
							checked={saveAttribute.fields.is_required_for_agents.value() === 'true'}
							onCheckedChange={(v) =>
								saveAttribute.fields.is_required_for_agents.set(v ? 'true' : 'false')}
						/>
						<Label for="is_required" class="text-sm">Required for agents</Label>
					</div>
					<p class="text-xs text-muted-foreground">
						If on, agents wait until this attribute is resolved before responding.
					</p>
				</div>
				{#if editingAttribute}
					<div class="flex items-center gap-2">
						<Switch
							id="is_active"
							checked={saveAttribute.fields.is_active.value() === 'true'}
							onCheckedChange={(v) => saveAttribute.fields.is_active.set(v ? 'true' : 'false')}
						/>
						<Label for="is_active" class="text-sm">Active</Label>
					</div>
				{/if}
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={() => (dialogOpen = false)} type="button">Cancel</Button>
				<Button type="submit" disabled={!!saveAttribute.pending}>
					{#if saveAttribute.pending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					{editingAttribute ? 'Save Changes' : 'Create Attribute'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
