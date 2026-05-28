<script lang="ts">
	import { BrainCircuit, ShieldCheck, Sparkles } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="min-h-svh overflow-hidden bg-[#f2f4f5] text-slate-950">
	<div
		class="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(162,89,255,0.30),rgba(225,201,255,0.16)_34%,transparent_70%)]"
	></div>
	<div class="pointer-events-none fixed inset-x-0 top-0 h-36 bg-white/55 blur-3xl"></div>

	<main class="relative mx-auto grid min-h-svh w-full max-w-7xl items-center gap-6 px-4 py-6 lg:grid-cols-[1fr_460px] lg:px-6 xl:grid-cols-[1fr_520px]">
		<section class="hidden h-[calc(100svh-3rem)] min-h-[640px] flex-col justify-between rounded-[2rem] border border-white/80 bg-white/72 p-6 shadow-[0_24px_90px_rgba(30,36,54,0.10)] backdrop-blur-xl lg:flex">
			<div class="flex items-center gap-3">
				<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
					<BrainCircuit class="h-5 w-5" />
				</div>
				<div>
					<p class="text-sm font-semibold text-slate-950">Quant Orion</p>
					<p class="text-xs text-slate-500">Private intelligence workspace</p>
				</div>
			</div>

			<div class="mx-auto w-full max-w-xl">
				<div class="rounded-[2rem] border border-slate-200/80 bg-slate-50/80 p-5">
					<div class="grid grid-cols-6 gap-2">
						{#each Array(24) as _, index (index)}
							<div
								class="h-12 rounded-2xl bg-white shadow-sm"
								style:opacity={index % 5 === 0 ? 1 : 0.42 + (index % 6) * 0.07}
							></div>
						{/each}
					</div>
				</div>
				<div class="mt-6 grid gap-3 sm:grid-cols-2">
					<div class="rounded-3xl border border-slate-200/80 bg-white/85 p-4">
						<ShieldCheck class="h-5 w-5 text-violet-600" />
						<p class="mt-3 text-sm font-semibold text-slate-950">Secure by default</p>
						<p class="mt-1 text-xs leading-5 text-slate-500">Session, onboarding, and file access stay behind the same live backend guards.</p>
					</div>
					<div class="rounded-3xl border border-slate-200/80 bg-white/85 p-4">
						<Sparkles class="h-5 w-5 text-violet-600" />
						<p class="mt-3 text-sm font-semibold text-slate-950">Ready for context</p>
						<p class="mt-1 text-xs leading-5 text-slate-500">Sign in to continue with your profile, chat history, tools, and knowledge workspace.</p>
					</div>
				</div>
			</div>

			<div class="flex items-center justify-between border-t border-slate-200/80 pt-5 text-xs text-slate-500">
				<span>Quant Orion</span>
				<span>Backend connected</span>
			</div>
		</section>

		<section class="mx-auto w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/84 p-5 shadow-[0_24px_90px_rgba(30,36,54,0.12)] backdrop-blur-xl sm:p-7 lg:p-8">
			<div class="mb-7 flex items-center gap-3 lg:hidden">
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
					<BrainCircuit class="h-5 w-5" />
				</div>
				<div>
					<p class="text-sm font-semibold text-slate-950">Quant Orion</p>
					<p class="text-xs text-slate-500">Private intelligence workspace</p>
				</div>
			</div>
			{@render children()}
		</section>
	</main>
</div>
