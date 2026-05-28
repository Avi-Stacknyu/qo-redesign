<script lang="ts">
	import { Input } from '$lib/components/shadcn/input';
	import { Button } from '$lib/components/shadcn/button';
	import * as Select from '$lib/components/shadcn/select';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import * as Collapsible from '$lib/components/shadcn/collapsible';
	import { Checkbox } from '$lib/components/shadcn/checkbox';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import TagRuleEditor from '$lib/components/tag-rule-editor.svelte';
	import {
		saveProfiler,
		getModelOptions,
		getTagCatalog,
		getTagRulePresets,
		getGlobalSchemaSections,
		type ProfilerRow
	} from './profiler.remote';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { ProfilerAgentStatus } from '@repo/db/types';
	import type { TagRule } from '@repo/shared/types';

	let { profiler, onsuccess }: { profiler: ProfilerRow | null; onsuccess?: () => void } = $props();

	const modelsQuery = getModelOptions();
	let models = $derived(modelsQuery.current ?? []);

	const catalogQuery = getTagCatalog();
	let catalog = $derived(catalogQuery.current?.tags ?? []);

	const presetsQuery = getTagRulePresets();
	let presets = $derived(presetsQuery.current ?? []);

	const sectionsQuery = getGlobalSchemaSections();
	let globalSections = $derived(sectionsQuery.current ?? []);

	let tagRule = $state<TagRule>({ groups: [] });
	let tagRuleJson = $state('');

	let selectedSections = $state<string[]>([]);
	let hydratedProfilerId = $state<string | null>(null);
	let hydratedNewForm = $state(false);

	let showPromptPreview = $state(false);

	function hydrateForm(nextProfiler: ProfilerRow | null) {
		if (nextProfiler) {
			const rule = (nextProfiler.tagRule as TagRule | null) ?? { groups: [] };
			const nextTagRuleJson = rule.groups.length > 0 ? JSON.stringify(rule, null, 2) : '';
			const nextSelectedSections = Array.isArray(nextProfiler.focusSections)
				? ([...nextProfiler.focusSections] as string[])
				: [];

			tagRule = rule;
			tagRuleJson = nextTagRuleJson;
			selectedSections = nextSelectedSections;
			saveProfiler.fields.set({
				id: nextProfiler.id,
				name: nextProfiler.name ?? undefined,
				description: nextProfiler.description || '',
				status: (nextProfiler.status ?? undefined) as ProfilerAgentStatus | undefined,
				system_prompt: nextProfiler.systemPrompt ?? undefined,
				model: nextProfiler.model || '',
				max_tokens: nextProfiler.maxTokens ? Number(nextProfiler.maxTokens) : undefined,
				focus_sections: JSON.stringify(nextSelectedSections),
				priority: nextProfiler.priority ?? undefined,
				tag_rule: nextTagRuleJson
			});
			return;
		}

		tagRule = { groups: [] };
		tagRuleJson = '';
		selectedSections = [];
		saveProfiler.fields.set({
			id: '',
			name: '',
			description: '',
			status: ProfilerAgentStatus.active,
			system_prompt: '',
			model: '',
			max_tokens: undefined,
			focus_sections: '[]',
			priority: undefined,
			tag_rule: ''
		});
	}

	$effect(() => {
		const nextProfiler = profiler;

		if (nextProfiler) {
			if (hydratedProfilerId === nextProfiler.id) return;
			hydratedProfilerId = nextProfiler.id;
			hydratedNewForm = false;
			hydrateForm(nextProfiler);
			return;
		}

		if (hydratedNewForm) return;
		hydratedProfilerId = null;
		hydratedNewForm = true;
		hydrateForm(null);
	});

	function handleTagRuleChange(newRule: TagRule) {
		tagRule = newRule;
		const json = newRule.groups.length > 0 ? JSON.stringify(newRule, null, 2) : '';
		tagRuleJson = json;
		saveProfiler.fields.tag_rule.set(json);
	}

	function handleLoadPreset(preset: { id: string; name: string | null; tagRule: unknown }) {
		const loaded = (preset.tagRule as TagRule) ?? { groups: [] };
		tagRule = loaded;
		const json = loaded.groups.length > 0 ? JSON.stringify(loaded, null, 2) : '';
		tagRuleJson = json;
		saveProfiler.fields.tag_rule.set(json);
	}

	function toggleSection(sectionId: string) {
		if (selectedSections.includes(sectionId)) {
			selectedSections = selectedSections.filter((s) => s !== sectionId);
		} else {
			selectedSections = [...selectedSections, sectionId];
		}
		saveProfiler.fields.focus_sections.set(JSON.stringify(selectedSections));
	}

	function modelDisplayName(id: string): string {
		const m = models.find((m) => m.id === id);
		if (!m) return 'Select model';
		const provider = m.expand?.provider?.displayName;
		return provider ? `${m.displayName} (${provider})` : (m.displayName ?? '');
	}

	const PROMPT_TEMPLATE_SUFFIX = `
{{schemaDefinitions}}

{{profileContext}}

---
CONVERSATION ({{messageCount}} exchanges):
{{conversationText}}
---

Analyze the conversation above and extract any profile-relevant information about the user.
Use EXACT keys from the schema when the info matches a schema field.
For info that doesn't fit any schema field, create a new snake_case key with a descriptive label.
Return ONLY updated/new fields, not the entire profile.
If no profile-relevant info was found, return: { "updates": [] }

Output JSON:
{ "updates": [{ "section": "section_id", "fields": { "field_key": { "value": "extracted value", "label": "Display Label" } } }] }`;
</script>

<form
	{...saveProfiler.enhance(async ({ submit }) => {
		try {
			await submit();
			await invalidateAll();
			if (saveProfiler.result?.success) {
				toast.success('Profiler saved');
				onsuccess?.();
			} else if (saveProfiler.result && 'error' in saveProfiler.result) {
				toast.error('Failed: ' + saveProfiler.result.error);
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save profiler');
		}
	})}
	class="space-y-5 pt-2 pb-4"
>
	{#if saveProfiler.result && 'error' in saveProfiler.result}
		<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
			{saveProfiler.result.error}
		</div>
	{/if}
	<input type="hidden" name="id" value={saveProfiler.fields.id.value()} />

	<div class="grid gap-2">
		<Label for="name">Name</Label>
		<Input {...saveProfiler.fields.name.as('text')} placeholder="e.g. Finance Profiler" />
		{#each saveProfiler.fields.name.issues() as issue (issue.message)}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
	</div>

	<div class="grid gap-2">
		<Label for="description">Description</Label>
		<Input
			{...saveProfiler.fields.description.as('text')}
			placeholder="Optional admin-facing description"
		/>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="grid gap-2">
			<Label for="status">Status</Label>
			<Select.Root
				type="single"
				value={saveProfiler.fields.status.value()}
				onValueChange={(v) => saveProfiler.fields.status.set(v as ProfilerAgentStatus)}
			>
				<Select.Trigger>{saveProfiler.fields.status.value()}</Select.Trigger>
				<Select.Content>
					{#each Object.values(ProfilerAgentStatus) as s (s)}
						<Select.Item value={s}>{s}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<input type="hidden" name="status" value={saveProfiler.fields.status.value()} />
		</div>

		<div class="grid gap-2">
			<Label for="model">Model</Label>
			<Select.Root
				type="single"
				value={saveProfiler.fields.model.value()}
				onValueChange={(v) => saveProfiler.fields.model.set(v)}
			>
				<Select.Trigger class="truncate">
					{modelDisplayName(saveProfiler.fields.model.value() ?? '')}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">No model</Select.Item>
					{#each models as model (model.id)}
						<Select.Item value={model.id}>
							{model.displayName}
							{#if model.expand?.provider}
								<span class="text-muted-foreground">
									({model.expand.provider.displayName})
								</span>
							{/if}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<input type="hidden" name="model" value={saveProfiler.fields.model.value()} />
		</div>
	</div>

	<div class="grid gap-2">
		<Label for="max_tokens">Max Tokens</Label>
		<Input {...saveProfiler.fields.max_tokens.as('number')} placeholder="800" />
		<p class="text-xs text-muted-foreground">LLM output token limit for profiler responses.</p>
	</div>

	<div class="grid gap-2">
		<Label for="system_prompt">System Prompt</Label>
		<Textarea
			{...saveProfiler.fields.system_prompt.as('text')}
			placeholder="You are a profiler agent. Analyze the conversation and extract user profile information..."
			rows={8}
			class="font-mono text-xs"
		/>
		{#each saveProfiler.fields.system_prompt.issues() as issue (issue.message)}
			<p class="text-sm text-destructive">{issue.message}</p>
		{/each}
		<p class="text-xs text-muted-foreground">
			This prompt is placed at the top of the extraction template. The system automatically appends
			the schema definitions, current profile context, conversation, and extraction instructions
			below it.
		</p>

		<!-- Prompt template preview -->
		<Collapsible.Root bind:open={showPromptPreview}>
			<Collapsible.Trigger
				class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
			>
				<ChevronDown
					class="h-3.5 w-3.5 transition-transform {showPromptPreview ? 'rotate-180' : ''}"
				/>
				{showPromptPreview ? 'Hide' : 'Show'} appended template
			</Collapsible.Trigger>
			<Collapsible.Content>
				<div
					class="mt-2 rounded-md border border-dashed border-border/60 bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground"
				>
					{PROMPT_TEMPLATE_SUFFIX}
				</div>
			</Collapsible.Content>
		</Collapsible.Root>
	</div>

	<!-- Routing Metadata -->
	<div class="space-y-5 rounded-lg border border-border/50 p-5">
		<div>
			<Label class="text-sm font-medium">Routing Metadata</Label>
			<p class="text-xs text-muted-foreground">
				Controls how the profiler dispatcher selects which profilers to run.
			</p>
		</div>

		<!-- Tag Rule -->
		<div class="grid gap-2">
			<Label>Tag Rule</Label>
			<TagRuleEditor
				rule={tagRule}
				{catalog}
				onchange={handleTagRuleChange}
				{presets}
				onloadpreset={handleLoadPreset}
			/>
			<input type="hidden" name="tag_rule" value={saveProfiler.fields.tag_rule.value()} />
			<p class="text-xs text-muted-foreground">
				Tag rule for matching users. Profiler with the most overlapping tags wins. Empty = fallback
				profiler (runs when no tags match).
			</p>
		</div>

		<!-- Focus Sections -->
		<div class="grid gap-2">
			<Label>Focus Sections</Label>
			{#if globalSections.length > 0}
				<div class="flex flex-wrap gap-3">
					{#each globalSections.sort((a, b) => a.order - b.order) as section (section.section_id)}
						<label class="flex items-center gap-1.5 text-sm">
							<Checkbox
								checked={selectedSections.includes(section.section_id)}
								onCheckedChange={() => toggleSection(section.section_id)}
							/>
							<span>{section.label}</span>
							<span class="text-xs text-muted-foreground">({section.section_id})</span>
						</label>
					{/each}
				</div>
			{:else}
				<p class="text-xs text-muted-foreground italic">
					No global schema found. Create one in the Global Schema page first.
				</p>
			{/if}
			<input
				type="hidden"
				name="focus_sections"
				value={saveProfiler.fields.focus_sections.value()}
			/>
			<p class="text-xs text-muted-foreground">
				Section IDs this profiler extracts from the global schema. Empty = extracts all sections.
			</p>
		</div>

		<div class="grid gap-2">
			<Label for="priority">Priority (0–100)</Label>
			<Input {...saveProfiler.fields.priority.as('number')} placeholder="50" />
			<p class="text-xs text-muted-foreground">
				Tiebreaker when tag scores are equal. Lower = higher priority.
			</p>
		</div>
	</div>

	<div class="flex justify-end pt-2">
		<Button type="submit" disabled={!!saveProfiler.pending} aria-busy={!!saveProfiler.pending}>
			{#if saveProfiler.pending}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				{profiler ? 'Update' : 'Create'} Profiler
			{/if}
		</Button>
	</div>
</form>
