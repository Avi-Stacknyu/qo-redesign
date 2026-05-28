<script lang="ts">
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import QIcon from '$lib/components/icons/QIcon.svelte';
	import { formatToolName } from '@repo/shared/utils';

	let {
		isThinking = false,
		currentToolName = '',
		agent
	}: {
		isThinking?: boolean;
		currentToolName?: string;
		agent?: { id: string; name: string; avatar_url?: string | null };
	} = $props();
</script>

{#if isThinking || currentToolName}
	<div class="w-full px-4 py-2">
		<div class="mx-auto max-w-4xl">
			<div class="flex gap-3">
				{#if agent}
					<AgentAvatar {agent} size="md" />
				{:else}
					<div
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
					>
						<QIcon class="h-4 w-4" />
					</div>
				{/if}
				<div
					class="rounded-2xl rounded-bl-md border border-border/60 bg-muted px-4 py-2.5 shadow-sm"
				>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						{#if currentToolName}
							<span class="inline-block h-2 w-2 animate-pulse rounded-full bg-primary"></span>
							<span>Using {formatToolName(currentToolName)}...</span>
						{:else}
							<div class="flex items-center gap-1">
								<span
									class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"
								></span>
								<span
									class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"
								></span>
								<span
									class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
								></span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
