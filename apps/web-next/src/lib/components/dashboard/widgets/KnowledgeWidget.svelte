<script lang="ts">
	import { Brain } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { KnowledgeConfig } from '$lib/types/widgets';

	let { config }: { config: KnowledgeConfig } = $props();

	const VIEW_LABELS: Record<string, string> = {
		card: 'Card View',
		list: 'List View'
	};
</script>

<div class="flex min-h-32 flex-col items-center justify-center gap-3 p-4">
	<div class="rounded-full bg-muted/60 p-3">
		<Brain class="size-6 text-muted-foreground/70" />
	</div>
	<p class="text-sm font-medium text-muted-foreground">Knowledge base coming soon</p>
	<div class="flex items-center gap-1.5">
		<Badge variant="outline">{VIEW_LABELS[config.viewMode] ?? config.viewMode}</Badge>
		<Badge variant="secondary">Limit: {config.limit}</Badge>
	</div>
</div>
