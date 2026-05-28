<script lang="ts">
	import { RefreshCw, AlertTriangle } from '@lucide/svelte';
	import { Button } from '$lib/components/shadcn/button/index.js';

	let {
		message = 'Failed to load data',
		onRetry
	}: {
		message?: string;
		onRetry?: () => void;
	} = $props();
</script>

<div class="flex min-h-24 flex-col items-center justify-center gap-3 p-4">
	<div class="rounded-full bg-destructive/10 p-2">
		<AlertTriangle class="size-4 text-destructive" />
	</div>
	<p class="text-center text-xs text-muted-foreground">{message}</p>
	{#if onRetry}
		<Button variant="ghost" size="sm" class="h-7 gap-1.5 text-xs" onclick={onRetry}>
			<RefreshCw class="size-3" />
			Retry
		</Button>
	{/if}
</div>
