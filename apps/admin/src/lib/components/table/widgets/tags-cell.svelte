<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge';
	import { getNamespaceColor } from '$lib/utils/tag-helpers';

	let { tags = [] }: { tags: string[] } = $props();
</script>

{#if tags.length === 0}
	<span class="text-muted-foreground">—</span>
{:else}
	<div class="flex flex-wrap gap-1">
		{#each tags as tag}
			<Badge
				variant="outline"
				class="{getNamespaceColor(tag.split(':')[0] ?? '')} px-1.5 py-0 text-[10px]"
			>
				{tag}
			</Badge>
		{/each}
	</div>
{/if}
