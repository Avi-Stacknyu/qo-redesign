
<script lang="ts">
	import { goto } from '$app/navigation';
	import Shell from '$lib/components/Shell.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';

	const suggestions = [
		'How can I set realistic financial goals and prioritize them?',
		'What are the best ways to reduce unnecessary expenses?'
	];

	function handleSubmit(text: string) {
		goto('/chat-detail');
	}
</script>

<Shell pageTitle="Budget" headerVerticalAlign="center">
	{#snippet header()}
		<div>
			<h1 class="font-Inter text-3xl font-normal tracking-tight text-foreground lg:text-3xl">
				Budgeting
			</h1>
		</div>
	{/snippet}

	<div
		class="flex min-h-[calc(100vh-2rem)] w-full items-center justify-center px-4 py-10 md:min-h-[calc(100vh-3rem)] md:px-6 md:py-12"
	>
		<div class="flex w-full max-w-5xl flex-col items-center gap-12 md:gap-20">
			<div class="w-full max-w-4xl text-center">
				<h2
					class="pb-2 text-4xl leading-[1.1] font-medium md:text-6xl lg:text-7xl"
					style="
                        background: linear-gradient(90deg, #A259FF 0%, #C89FFD 49.04%, #44187C 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    "
				>
					Chat with your tabs
				</h2>
			</div>

			<div class="flex w-full max-w-4xl flex-col gap-6 md:gap-8">
				<ChatInput placeholder="Search" onSubmit={handleSubmit} />

				<div class="flex w-full flex-col gap-3">
					{#each suggestions as suggestion, index}
						<button
							type="button"
							onclick={() => handleSubmit(suggestion)}
							class={`w-full cursor-pointer rounded-2xl border border-[#E4E9EF] px-4 py-3 text-left text-sm font-normal text-muted-foreground transition-all md:px-5 md:py-4 md:text-base ${
								index === suggestions.length - 1
									? 'pointer-events-none bg-white/70 blur-[1px]'
									: 'bg-white hover:border-purple-100'
							}`}
						>
							{suggestion}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</Shell>
