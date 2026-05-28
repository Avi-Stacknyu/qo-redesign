<script lang="ts">
	import { fade } from 'svelte/transition';

	let {
		suggestions,
		isLoading,
		onSelect
	}: {
		suggestions: { title: string; prompt: string }[];
		isLoading: boolean;
		onSelect: (prompt: string) => void;
	} = $props();

	let activeIndex = $state(0);
	let isPaused = $state(false);

	$effect(() => {
		if (suggestions.length > 0 && !isLoading) {
			const interval = setInterval(() => {
				if (!isPaused) {
					activeIndex = (activeIndex + 1) % Math.min(suggestions.length, 4);
				}
			}, 4000);
			return () => clearInterval(interval);
		}
	});
</script>

{#if isLoading || suggestions.length > 0}
	<div
		class="w-full max-w-3xl animate-in delay-100 duration-700 slide-in-from-bottom-5 fade-in"
		onmouseenter={() => (isPaused = true)}
		onmouseleave={() => (isPaused = false)}
		role="region"
		aria-label="Prompt Suggestions"
	>
		{#if isLoading}
			<div class="flex flex-wrap justify-center gap-2">
				{#each [0, 1, 2] as i (i)}
					<div
						class="h-9 w-32 animate-pulse rounded-full border border-border/20 bg-muted/15"
					></div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center gap-5">
				<div class="flex flex-wrap justify-center gap-2">
					{#each suggestions.slice(0, 4) as suggestion, i}
						{@const isActive = i === activeIndex}
						<button
							onclick={() => onSelect(suggestion.prompt)}
							onmouseenter={() => (activeIndex = i)}
							class={'group relative flex items-center gap-2 overflow-hidden rounded-full border px-4 py-1.5 text-sm shadow-sm backdrop-blur-md transition-all duration-500 ' +
								(isActive
									? 'scale-[1.02] border-primary/40 bg-primary/10 shadow-md'
									: 'border-border/40 bg-background/60 hover:scale-[1.02] hover:border-primary/30')}
						>
							{#if isActive}
								<div
									class="absolute bottom-0 left-0 h-0.5 bg-primary/60"
									style="animation: progress-indicator 4s linear; animation-play-state: {isPaused
										? 'paused'
										: 'running'};"
								></div>
							{/if}
							<!-- Subtle Geometric Node icon -->
							<svg
								class={'size-3.5 transition-colors ' +
									(isActive ? 'text-primary' : 'text-primary/70 group-hover:text-primary')}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="3" />
								<path d="M12 2v7" />
								<path d="M12 15v7" />
								<path d="m4.93 4.93 4.95 4.95" />
								<path d="m14.12 14.12 4.95 4.95" />
								<path d="M2 12h7" />
								<path d="M15 12h7" />
								<path d="m4.93 19.07 4.95-4.95" />
								<path d="m14.12 9.88 4.95-4.95" />
							</svg>
							<span
								class={'font-medium transition-colors ' +
									(isActive
										? 'text-foreground'
										: 'text-muted-foreground group-hover:text-foreground')}
							>
								{suggestion.title}
							</span>
						</button>
					{/each}
				</div>

				<!-- Display the full prompt of the active suggestion -->
				{#if suggestions.length > 0}
					<div class="flex min-h-10 w-full items-center justify-center px-4 py-2 text-center">
						{#key activeIndex}
							<button
								in:fade={{ duration: 300, delay: 50 }}
								onclick={() => onSelect(suggestions[activeIndex].prompt)}
								class="cursor-pointer text-sm text-muted-foreground/80 italic transition-colors hover:text-foreground"
							>
								"{suggestions[activeIndex].prompt}"
							</button>
						{/key}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	@keyframes progress-indicator {
		0% {
			width: 0%;
		}
		100% {
			width: 100%;
		}
	}
</style>
