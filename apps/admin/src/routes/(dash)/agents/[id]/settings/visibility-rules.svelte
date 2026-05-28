<script lang="ts">
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Switch } from '$lib/components/shadcn/switch/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { Eye, Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';

	import type { TagRule } from '@repo/shared/types';
	import TagRuleEditor from '$lib/components/tag-rule-editor.svelte';
	import { getTagCatalog, updateAgentTagsAction } from './agent-settings.remote';
	import { getTagRulePresets, createPresetAction } from '../../../tags/tags.remote';

	let {
		agentId,
		initialTagRule = null,
		isUniversal = false
	}: {
		agentId: string;
		initialTagRule?: TagRule | null;
		isUniversal?: boolean;
	} = $props();

	const catalogQuery = getTagCatalog();
	const catalogData = $derived(catalogQuery.current);
	let catalog = $derived(catalogData?.tags ?? []);

	const presetsQuery = getTagRulePresets();
	let presets = $derived(presetsQuery.current ?? []);

	let currentRule = $state<TagRule>({ groups: [] });
	let showUniversal = $state(false);
	let isSaving = $state(false);

	$effect(() => {
		currentRule = initialTagRule ?? { groups: [] };
		showUniversal = isUniversal;
	});

	async function save() {
		isSaving = true;
		try {
			await updateAgentTagsAction({
				agentId,
				tag_rule: currentRule,
				is_universal: showUniversal
			});
			toast.success('Agent visibility saved');
			await invalidateAll();
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : 'Failed to save');
		} finally {
			isSaving = false;
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Eye class="h-5 w-5" />
			Visibility — Tag Rules
		</Card.Title>
		<Card.Description>
			Control which users see this agent using tag groups (OR between groups, AND within)
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<!-- Info Box -->
		<div class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm">
			<p class="mb-2 font-medium text-blue-600">How visibility works</p>
			<ul class="space-y-1.5 text-muted-foreground">
				<li>
					<strong>Universal agents</strong> are always visible to every user, regardless of tags.
				</li>
				<li>
					<strong>Groups are OR'd</strong> — a user matching <em>any</em> group can see the agent.
				</li>
				<li>
					<strong>Tags within a group are AND'd</strong> — the user must have <em>all</em> tags in that
					group.
				</li>
				<li>
					<strong>No groups = unrestricted</strong> — the agent is visible to all users (same as universal).
				</li>
				<li>
					Users get tags from:
					<strong>Plan</strong> (e.g. Pro grants
					<code class="rounded bg-muted px-1 text-xs">tier:pro</code>),
					<strong>Onboarding</strong> (geo + role),
					<strong>Admin</strong> (e.g.
					<code class="rounded bg-muted px-1 text-xs">segment:vip</code>).
				</li>
			</ul>
		</div>

		<!-- Universal Toggle -->
		<div class="flex items-center justify-between rounded-lg border p-4">
			<div>
				<Label class="text-base font-medium">Universal Agent</Label>
				<p class="text-sm text-muted-foreground">Visible to all users regardless of tags</p>
			</div>
			<Switch checked={showUniversal} onCheckedChange={(v) => (showUniversal = v)} />
		</div>

		{#if !showUniversal}
			<TagRuleEditor
				rule={currentRule}
				catalog={catalog as any}
				onchange={(r) => (currentRule = r)}
				presets={presets as any}
				onloadpreset={(p) => (currentRule = (p.tagRule as TagRule) ?? { groups: [] })}
				onsavepreset={async (name) => {
					try {
						await createPresetAction({ name, tag_rule: currentRule });
						toast.success(`Preset "${name}" saved`);
						await invalidateAll();
					} catch {
						toast.error('Failed to save preset');
					}
				}}
			/>
		{/if}
	</Card.Content>
	<Card.Footer>
		<Button onclick={save} disabled={isSaving}>
			{#if isSaving}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
			{/if}
			{isSaving ? 'Saving…' : 'Save Visibility'}
		</Button>
	</Card.Footer>
</Card.Root>
