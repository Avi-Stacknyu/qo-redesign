<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge';
	import { Label } from '$lib/components/shadcn/label';
	import * as Collapsible from '$lib/components/shadcn/collapsible';
	import { ChevronDown, Bot } from '@lucide/svelte';
	import {
		getNamespaceColor,
		getTagNamespaceName,
		getFullTagString,
		type TagCatalogWithNamespace
	} from '$lib/utils/tag-helpers';

	let {
		tagOptions,
		selectedTags = $bindable([]),
		agentsByTag = {},
		hiddenValue = '[]'
	}: {
		tagOptions: TagCatalogWithNamespace[];
		selectedTags: string[];
		agentsByTag?: Record<string, { id: string; name: string }[]>;
		hiddenValue: string;
	} = $props();

	let groupedTags = $derived(Object.groupBy(tagOptions, (t) => getTagNamespaceName(t)));
	let catalogTagValues = $derived(new Set(tagOptions.map((tag) => getFullTagString(tag))));
	let uncatalogedSelectedTags = $derived(selectedTags.filter((tag) => !catalogTagValues.has(tag)));

	function toggleTag(tag: string) {
		selectedTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];
	}
</script>

<div class="grid gap-2">
	<Label>Granted Tags</Label>
	<div class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground">
		<p class="mb-1 text-sm font-medium text-blue-600">How plan tags work</p>
		<p class="mb-1.5">
			Selected tags are granted to every subscriber of this plan. Agents that require any of these
			tags become visible to subscribers.
		</p>
		<p class="mb-1.5">
			<strong>Tip — include lower tiers:</strong>
			A Pro plan should grant both <code class="rounded bg-muted px-1">tier:free</code> and
			<code class="rounded bg-muted px-1">tier:pro</code> so subscribers also see free-tier agents.
		</p>
	</div>
	<div class="max-h-80 space-y-4 overflow-y-auto rounded-md border p-4">
		{#each Object.entries(groupedTags) as [ns, tags]}
			{#if tags && tags.length > 0}
				<div class="space-y-2">
					<p class="text-xs font-semibold tracking-wide uppercase {getNamespaceColor(ns)}">
						{ns.charAt(0).toUpperCase() + ns.slice(1)}
					</p>
					{#each tags as tag}
						{@const prefixed = getFullTagString(tag)}
						{@const isSelected = selectedTags.includes(prefixed)}
						{@const agents = agentsByTag[prefixed] ?? []}
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<button type="button" onclick={() => toggleTag(prefixed)}>
									<Badge
										variant={isSelected ? 'default' : 'outline'}
										class="cursor-pointer transition-colors {isSelected
											? getNamespaceColor(ns) + ' border-current'
											: 'text-muted-foreground hover:text-foreground'}"
									>
										{prefixed}
									</Badge>
								</button>
								{#if agents.length > 0}
									<span class="text-[10px] text-muted-foreground">
										{agents.length} agent{agents.length !== 1 ? 's' : ''}
									</span>
								{/if}
							</div>
							{#if agents.length > 0}
								<Collapsible.Root>
									<Collapsible.Trigger
										class="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
									>
										<ChevronDown class="h-3 w-3" />
										Show agents requiring this tag
									</Collapsible.Trigger>
									<Collapsible.Content>
										<div class="mt-1 ml-4 space-y-0.5">
											{#each agents as agent}
												<div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
													<Bot class="h-3 w-3 shrink-0" />
													{agent.name}
												</div>
											{/each}
										</div>
									</Collapsible.Content>
								</Collapsible.Root>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/each}
		{#if uncatalogedSelectedTags.length > 0}
			<div class="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
				<p class="text-xs font-semibold tracking-wide text-amber-600 uppercase">
					Other Granted Tags
				</p>
				<p class="text-xs text-muted-foreground">
					These tags are currently stored on the plan but are not present in the tag catalog.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each uncatalogedSelectedTags as tag}
						<button type="button" onclick={() => toggleTag(tag)}>
							<Badge variant="outline" class="cursor-pointer border-amber-500/40 text-amber-700">
								{tag}
							</Badge>
						</button>
					{/each}
				</div>
			</div>
		{/if}
		{#if tagOptions.length === 0}
			<p class="text-sm text-muted-foreground">No tags available.</p>
		{/if}
	</div>
	{#if selectedTags.length > 0}
		<p class="text-xs text-muted-foreground">
			{selectedTags.length} tag(s) selected: {selectedTags.join(', ')}
		</p>
	{/if}
	<input type="hidden" name="granted_tags" value={hiddenValue} />
</div>
