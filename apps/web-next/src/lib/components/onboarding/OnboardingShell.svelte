<script lang="ts">
	import { BrainCircuit, CheckCircle2, Sparkles } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface AnsweredFact {
		label: string;
		value: string;
	}

	interface Props {
		children: Snippet;
		currentStep: number;
		totalSteps: number;
		answeredFacts?: AnsweredFact[];
	}

	let { currentStep, totalSteps, children, answeredFacts = [] }: Props = $props();

	const progressValue = $derived(Math.min(100, ((currentStep + 1) / Math.max(totalSteps, 1)) * 100));
	const visibleFacts = $derived(answeredFacts.slice(0, 5));
</script>

<div class="min-h-svh overflow-hidden bg-[#f2f4f5] text-slate-950">
	<div
		class="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(162,89,255,0.28),rgba(225,201,255,0.16)_34%,transparent_68%)]"
	></div>
	<div class="pointer-events-none fixed inset-x-0 top-0 h-40 bg-white/55 blur-3xl"></div>

	<div class="relative mx-auto grid min-h-svh w-full max-w-7xl gap-6 px-4 py-5 lg:grid-cols-[360px_1fr] lg:px-6 lg:py-6 xl:grid-cols-[420px_1fr]">
		<aside class="hidden lg:flex lg:flex-col">
			<div class="sticky top-6 flex min-h-[calc(100svh-3rem)] flex-col rounded-[2rem] border border-white/80 bg-white/70 p-5 shadow-[0_24px_80px_rgba(30,36,54,0.10)] backdrop-blur-xl">
				<div class="flex items-center gap-3">
					<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
						<BrainCircuit class="h-5 w-5" />
					</div>
					<div>
						<p class="text-sm font-semibold text-slate-950">Quant Orion</p>
						<p class="text-xs text-slate-500">Profile onboarding</p>
					</div>
				</div>

				<div class="mt-8 rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4">
					<div class="flex items-center justify-between gap-4">
						<div>
							<p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Progress</p>
							<p class="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
								Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}
							</p>
						</div>
						<div class="flex h-12 w-12 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700">
							{Math.round(progressValue)}%
						</div>
					</div>
					<div class="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
						<div
							class="h-full rounded-full bg-violet-500 transition-all duration-500"
							style:width={`${progressValue}%`}
						></div>
					</div>
				</div>

				<div class="mt-5 flex-1 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-4">
					<div class="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
						<Sparkles class="h-4 w-4 text-violet-500" />
						Profile signals
					</div>
					{#if visibleFacts.length > 0}
						<div class="space-y-3">
							{#each visibleFacts as fact (`${fact.label}-${fact.value}`)}
								<div class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
									<div class="flex items-start gap-2">
										<CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
										<div class="min-w-0">
											<p class="truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
												{fact.label}
											</p>
											<p class="mt-1 line-clamp-2 text-sm text-slate-700">{fact.value}</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex h-full min-h-64 flex-col justify-end rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
							<div class="grid grid-cols-3 gap-2 opacity-80">
								{#each Array(9) as _, index (index)}
									<div class="h-14 rounded-2xl bg-white shadow-sm" style:opacity={0.35 + index * 0.05}></div>
								{/each}
							</div>
							<p class="mt-5 text-sm text-slate-500">
								Your answers will appear here as compact context cards while onboarding continues.
							</p>
						</div>
					{/if}
				</div>
			</div>
		</aside>

		<main class="flex min-h-[calc(100svh-2.5rem)] items-center justify-center py-4 lg:min-h-[calc(100svh-3rem)]">
			<div class="w-full max-w-3xl rounded-[2rem] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_rgba(30,36,54,0.12)] backdrop-blur-xl sm:p-7 lg:p-9">
				<div class="mb-7 lg:hidden">
					<div class="flex items-center justify-between gap-4">
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
								<BrainCircuit class="h-5 w-5" />
							</div>
							<div>
								<p class="text-sm font-semibold text-slate-950">Quant Orion</p>
								<p class="text-xs text-slate-500">Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}</p>
							</div>
						</div>
						<p class="text-sm font-semibold text-violet-700">{Math.round(progressValue)}%</p>
					</div>
					<div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
						<div class="h-full rounded-full bg-violet-500" style:width={`${progressValue}%`}></div>
					</div>
				</div>

				{@render children()}
			</div>
		</main>
	</div>
</div>
