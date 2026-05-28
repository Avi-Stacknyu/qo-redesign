<script lang="ts">
	import { Input } from '$lib/components/shadcn/input';
	import { Button } from '$lib/components/shadcn/button';
	import * as Select from '$lib/components/shadcn/select';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import TagRuleEditor from '$lib/components/tag-rule-editor.svelte';
	import WidgetConfigEditor from '$lib/components/widget-config-editor.svelte';
	import IconPicker from '$lib/components/icon-picker.svelte';
	import { saveWidget, getTagCatalogForWidgets } from './widget.remote';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { DashboardWidgetDefaultSize, type DashboardWidgetRow } from '@repo/db/types';
	import type { TagRule, ConfigFieldDescriptor } from '@repo/shared/types';

	type WidgetRow = DashboardWidgetRow;

	const KNOWN_WIDGET_TYPES = [
		'chart',
		'todo',
		'news',
		'reminders',
		'quick-actions',
		'recent-chats',
		'calendar',
		'bookmarks',
		'profile-summary',
		'knowledge',
		'bank-accounts'
	];

	const CATEGORY_OPTIONS = [
		'finance',
		'productivity',
		'communication',
		'data',
		'lifestyle',
		'general'
	];

	let { widget, onsuccess }: { widget: WidgetRow | null; onsuccess?: () => void } = $props();

	const catalogQuery = getTagCatalogForWidgets();
	let catalog = $derived(catalogQuery.current ?? []);
	let tagRule = $state<TagRule>({ groups: [] });
	let defaultConfig = $state<Record<string, unknown>>({});
	let lockedConfig = $state<Record<string, unknown>>({});
	let configFields = $state<ConfigFieldDescriptor[]>([]);

	let currentWidgetType = $derived(saveWidget.fields.widget_type.value() || '');

	$effect(() => {
		const w = widget;
		untrack(() => {
			if (w) {
				const existingRule = w.tagRule as TagRule | null | undefined;
				const resolved =
					existingRule && existingRule.groups?.length ? existingRule : { groups: [] };
				const dc = (w.defaultConfig as Record<string, unknown>) ?? {};
				const lc = (w.lockedConfig as Record<string, unknown>) ?? {};
				tagRule = resolved;
				defaultConfig = dc;
				lockedConfig = lc;
				configFields = (w.configFields as ConfigFieldDescriptor[] | null) ?? [];
				saveWidget.fields.set({
					id: w.id,
					name: w.name ?? '',
					widget_type: w.widgetType ?? '',
					description: w.description || '',
					category: w.category || '',
					icon: w.icon || '',
					base_type: w.baseType || '',
					default_size:
						(w.defaultSize as DashboardWidgetDefaultSize) || DashboardWidgetDefaultSize.md,
					is_active: w.isActive ?? true,
					default_config: JSON.stringify(dc),
					locked_config: Object.keys(lc).length ? JSON.stringify(lc) : '',
					tag_rule: resolved.groups.length ? JSON.stringify(resolved) : ''
				});
			} else {
				tagRule = { groups: [] };
				defaultConfig = {};
				lockedConfig = {};
				configFields = [];
				saveWidget.fields.set({
					id: '',
					name: '',
					widget_type: '',
					description: '',
					category: '',
					icon: '',
					base_type: '',
					default_size: DashboardWidgetDefaultSize.md,
					is_active: true,
					default_config: '{}',
					locked_config: '',
					tag_rule: ''
				});
			}
		});
	});

	const sizeOptions = Object.values(DashboardWidgetDefaultSize);
</script>

<form
	{...saveWidget.enhance(async ({ submit }) => {
		try {
			await submit();
			await invalidateAll();
			if (saveWidget.result?.success) {
				toast.success(widget ? 'Widget updated' : 'Widget created');
				onsuccess?.();
			} else if (saveWidget.result && 'error' in saveWidget.result) {
				toast.error('Failed to save widget: ' + saveWidget.result.error);
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save widget');
		}
	})}
	class="space-y-5 py-4"
>
	<input type="hidden" name="id" value={saveWidget.fields.id.value()} />
	<input type="hidden" name="default_config" value={saveWidget.fields.default_config.value()} />
	<input type="hidden" name="locked_config" value={saveWidget.fields.locked_config.value()} />
	<input type="hidden" name="tag_rule" value={saveWidget.fields.tag_rule.value()} />

	<!-- Section: Identity -->
	<fieldset class="space-y-3 rounded-lg border border-border/50 p-4">
		<legend class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>Identity</legend
		>

		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-2">
				<Label for="name">Name</Label>
				<Input {...saveWidget.fields.name.as('text')} placeholder="e.g. Stock Chart" />
				{#each saveWidget.fields.name.issues() as issue}
					<p class="text-sm text-destructive">{issue.message}</p>
				{/each}
			</div>
			<div class="space-y-2">
				<Label for="widget_type">Widget Type</Label>
				<Select.Root
					type="single"
					value={saveWidget.fields.widget_type.value()}
					onValueChange={(v) => {
						saveWidget.fields.widget_type.set(v);
						defaultConfig = {};
						lockedConfig = {};
						saveWidget.fields.default_config.set('{}');
						saveWidget.fields.locked_config.set('');
					}}
				>
					<Select.Trigger id="widget_type">
						{saveWidget.fields.widget_type.value() || 'Select type…'}
					</Select.Trigger>
					<Select.Content>
						{#each KNOWN_WIDGET_TYPES as wt}
							<Select.Item value={wt}>{wt}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="widget_type" value={saveWidget.fields.widget_type.value()} />
				{#each saveWidget.fields.widget_type.issues() as issue}
					<p class="text-sm text-destructive">{issue.message}</p>
				{/each}
			</div>
		</div>

		<div class="space-y-2">
			<Label for="description">Description</Label>
			<Textarea
				{...saveWidget.fields.description.as('text')}
				placeholder="Brief description (shown to AI for context)"
				rows={2}
			/>
		</div>
	</fieldset>

	<!-- Section: Appearance & Classification -->
	<fieldset class="space-y-3 rounded-lg border border-border/50 p-4">
		<legend class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>Appearance</legend
		>

		<div class="grid grid-cols-3 gap-4">
			<div class="space-y-2">
				<Label for="category">Category</Label>
				<Select.Root
					type="single"
					value={saveWidget.fields.category.value() || ''}
					onValueChange={(v) => saveWidget.fields.category.set(v)}
				>
					<Select.Trigger id="category">
						{saveWidget.fields.category.value() || 'Select…'}
					</Select.Trigger>
					<Select.Content>
						{#each CATEGORY_OPTIONS as cat}
							<Select.Item value={cat}>{cat}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="category" value={saveWidget.fields.category.value()} />
			</div>
			<div class="space-y-2">
				<Label for="base_type">Base Type</Label>
				<Select.Root
					type="single"
					value={saveWidget.fields.base_type.value() || ''}
					onValueChange={(v) => saveWidget.fields.base_type.set(v)}
				>
					<Select.Trigger id="base_type">
						{saveWidget.fields.base_type.value() || 'None (base)'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="">None (base widget)</Select.Item>
						{#each KNOWN_WIDGET_TYPES as wt}
							<Select.Item value={wt}>{wt}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="base_type" value={saveWidget.fields.base_type.value()} />
			</div>
			<div class="space-y-2">
				<Label for="default_size">Default Size</Label>
				<Select.Root
					type="single"
					value={saveWidget.fields.default_size.value()}
					onValueChange={(v) => saveWidget.fields.default_size.set(v as DashboardWidgetDefaultSize)}
				>
					<Select.Trigger id="default_size">
						{saveWidget.fields.default_size.value() || 'md'}
					</Select.Trigger>
					<Select.Content>
						{#each sizeOptions as size}
							<Select.Item value={size}>{size}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="default_size" value={saveWidget.fields.default_size.value()} />
			</div>
		</div>

		<div class="space-y-2">
			<Label>Icon</Label>
			<IconPicker
				value={saveWidget.fields.icon.value() || ''}
				onchange={(v) => saveWidget.fields.icon.set(v)}
			/>
			<input type="hidden" name="icon" value={saveWidget.fields.icon.value()} />
		</div>

		<div class="flex items-center gap-2">
			<Checkbox
				id="is_active"
				checked={!!saveWidget.fields.is_active.value()}
				onCheckedChange={(v) => saveWidget.fields.is_active.set(!!v)}
			/>
			<input class="hidden" {...saveWidget.fields.is_active.as('checkbox')} />
			<Label for="is_active">Active</Label>
		</div>
	</fieldset>

	<!-- Section: Configuration -->
	<fieldset class="space-y-3 rounded-lg border border-border/50 p-4">
		<legend class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>Configuration</legend
		>

		<div class="space-y-2">
			<Label class="text-sm font-medium">Default Config</Label>
			<p class="text-xs text-muted-foreground">
				Default settings applied when this widget is added to a dashboard.
			</p>
			<WidgetConfigEditor
				{configFields}
				value={defaultConfig}
				onchange={(v) => {
					defaultConfig = v;
					saveWidget.fields.default_config.set(JSON.stringify(v));
				}}
			/>
		</div>

		<div class="my-2 border-t border-border/30"></div>

		<div class="space-y-2">
			<Label class="text-sm font-medium"
				>Locked Config <span class="font-normal text-muted-foreground">(optional)</span></Label
			>
			<p class="text-xs text-muted-foreground">Fields here cannot be overridden by users.</p>
			<WidgetConfigEditor
				{configFields}
				value={lockedConfig}
				onchange={(v) => {
					lockedConfig = v;
					saveWidget.fields.locked_config.set(Object.keys(v).length ? JSON.stringify(v) : '');
				}}
			/>
		</div>
	</fieldset>

	<!-- Section: Access Control -->
	{#if catalog.length > 0}
		<fieldset class="space-y-3 rounded-lg border border-border/50 p-4">
			<legend class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
				>Access Control</legend
			>
			<p class="text-xs text-muted-foreground">
				Restrict this widget to users matching specific tags. Leave empty for no restriction.
			</p>
			<TagRuleEditor
				rule={tagRule}
				{catalog}
				onchange={(r) => {
					tagRule = r;
					saveWidget.fields.tag_rule.set(r.groups.length ? JSON.stringify(r) : '');
				}}
			/>
		</fieldset>
	{/if}

	<div class="flex justify-end gap-2 pt-2">
		<Button type="submit" disabled={!!saveWidget.pending} aria-busy={!!saveWidget.pending}>
			{#if saveWidget.pending}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				{widget ? 'Update' : 'Create'}
			{/if}
		</Button>
	</div>
</form>
