<script lang="ts">
	import { fade } from 'svelte/transition';
	import { Sparkles } from '@lucide/svelte';

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
		class="mx-auto w-full max-w-3xl animate-in slide-in-from-bottom-5 fade-in duration-700"
		onmouseenter={() => (isPaused = true)}
		onmouseleave={() => (isPaused = false)}
		role="region"
		aria-label="Prompt Suggestions"
	>
		{#if isLoading}
			<div class="flex flex-wrap justify-center gap-3">
				{#each [0, 1, 2] as i (i)}
					<div
						class="h-10 w-36 animate-pulse rounded-full border border-primary/10 bg-muted/20"
					></div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center gap-5">
				<div class="flex flex-wrap justify-center gap-3">
					{#each suggestions.slice(0, 4) as suggestion, i}
						{@const isActive = i === activeIndex}

						<button
							onclick={() => onSelect(suggestion.prompt)}
							onmouseenter={() => (activeIndex = i)}
							class={`group relative overflow-hidden rounded-full p-px transition-all duration-300 ${
								isActive
									? 'scale-[1.03]'
									: 'hover:scale-[1.02]'
							}`}
							style="
								background: linear-gradient(
									90deg,
									rgba(162, 89, 255, 0.45) 0%,
									rgba(104, 117, 253, 0.45) 50%,
									rgba(255, 89, 180, 0.45) 100%
								);
							"
						>
							<div
								class={`relative flex items-center gap-2 rounded-full px-4 py-2 transition-all duration-300 ${
									isActive
										? 'bg-white shadow-[0px_4px_24px_rgba(221,194,255,0.45)]'
										: 'bg-white/90 hover:bg-white'
								}`}
							>
								{#if isActive}
									<div
										class="absolute bottom-0 left-0 h-0.5 rounded-full bg-primary/70"
										style="
											animation: progress-indicator 4s linear;
											animation-play-state: {isPaused ? 'paused' : 'running'};
										"
									></div>
								{/if}

								<div
									class={`flex items-center justify-center rounded-full transition-all duration-300 ${
										isActive
											? 'text-primary'
											: 'text-primary/70 group-hover:text-primary'
									}`}
								>
									<Sparkles class="size-4" />
								</div>

								<span
									class={`text-sm font-medium transition-colors duration-300 ${
										isActive
											? 'text-foreground'
											: 'text-muted-foreground group-hover:text-foreground'
									}`}
								>
									{suggestion.title}
								</span>
							</div>
						</button>
					{/each}
				</div>

				{#if suggestions.length > 0}
					<div class="flex min-h-10 w-full items-center justify-center px-4 text-center">
						{#key activeIndex}
							<button
								in:fade={{ duration: 250 }}
								onclick={() => onSelect(suggestions[activeIndex].prompt)}
								class="max-w-2xl cursor-pointer text-sm italic text-muted-foreground transition-colors hover:text-foreground"
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