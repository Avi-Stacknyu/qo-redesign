<script lang="ts">
	import { onMount } from 'svelte';

	let mounted = $state(false);
	let currentTime = $state(new Date());

	onMount(() => {
		mounted = true;
		const interval = setInterval(() => {
			currentTime = new Date();
		}, 1000);
		return () => clearInterval(interval);
	});

	const formattedTime = $derived(
		currentTime.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		})
	);
</script>

<div
	class="relative min-h-screen w-full overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-slate-950"
>
	<!-- Animated background elements -->
	<div class="absolute inset-0 overflow-hidden">
		<!-- Gradient orbs -->
		<div
			class="absolute -top-32 -left-32 h-96 w-96 animate-pulse rounded-full bg-linear-to-br from-violet-600/20 to-transparent blur-3xl"
		></div>
		<div
			class="absolute -right-32 -bottom-32 h-96 w-96 animate-pulse rounded-full bg-linear-to-tl from-cyan-500/20 to-transparent blur-3xl"
			style="animation-delay: 1s;"
		></div>
		<div
			class="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-linear-to-r from-purple-500/10 to-pink-500/10 blur-3xl"
			style="animation-delay: 2s;"
		></div>

		<!-- Grid pattern -->
		<div
			class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[72px_72px]"
		></div>

		<!-- Floating particles -->
		{#each Array(20) as _, i}
			<div
				class="animate-float absolute h-1 w-1 rounded-full bg-white/20"
				style="
					left: {Math.random() * 100}%;
					top: {Math.random() * 100}%;
					animation-delay: {Math.random() * 5}s;
					animation-duration: {5 + Math.random() * 10}s;
				"
			></div>
		{/each}
	</div>

	<!-- Main content -->
	<div
		class="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center"
	>
		<!-- Logo/Brand area -->
		<div
			class="mb-8 transition-all duration-700"
			class:opacity-100={mounted}
			class:opacity-0={!mounted}
			class:translate-y-0={mounted}
			class:-translate-y-4={!mounted}
		>
			<div
				class="relative inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-purple-600 shadow-2xl shadow-violet-500/30"
			>
				<svg
					class="h-10 w-10 text-white"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
					/>
				</svg>
				<!-- Glow ring -->
				<div
					class="absolute -inset-1 animate-ping rounded-2xl bg-violet-500/30"
					style="animation-duration: 3s;"
				></div>
			</div>
		</div>

		<!-- Title -->
		<h1
			class="mb-4 bg-linear-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent transition-all delay-100 duration-700 sm:text-6xl md:text-7xl"
			class:opacity-100={mounted}
			class:opacity-0={!mounted}
			class:translate-y-0={mounted}
			class:-translate-y-4={!mounted}
		>
			Major Upgrades
			<span class="block bg-linear-to-r from-violet-400 to-cyan-400 bg-clip-text">In Progress</span>
		</h1>

		<!-- Subtitle -->
		<p
			class="mb-8 max-w-lg text-lg text-slate-400 transition-all delay-200 duration-700 sm:text-xl"
			class:opacity-100={mounted}
			class:opacity-0={!mounted}
			class:translate-y-0={mounted}
			class:-translate-y-4={!mounted}
		>
			We're working around the clock to bring you an enhanced experience.
		</p>

		<!-- Progress indicator -->
		<div
			class="mb-10 w-full max-w-md transition-all delay-300 duration-700"
			class:opacity-100={mounted}
			class:opacity-0={!mounted}
			class:translate-y-0={mounted}
			class:-translate-y-4={!mounted}
		>
			<div class="relative h-2 overflow-hidden rounded-full bg-slate-800">
				<div
					class="absolute inset-y-0 left-0 w-2/3 animate-pulse rounded-full bg-linear-to-r from-violet-500 via-purple-500 to-cyan-500"
				></div>
				<!-- Shimmer effect -->
				<div
					class="animate-shimmer absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/20 to-transparent"
				></div>
			</div>
			<div class="mt-3 flex items-center justify-between text-sm text-slate-500">
				<span>Optimizing features</span>
				<span class="font-mono">{formattedTime}</span>
			</div>
		</div>

		<!-- Feature cards -->
		<div
			class="mb-12 grid max-w-2xl grid-cols-1 gap-4 transition-all delay-500 duration-700 sm:grid-cols-2"
			class:opacity-100={mounted}
			class:opacity-0={!mounted}
			class:translate-y-0={mounted}
			class:-translate-y-4={!mounted}
		>
			<div
				class="group rounded-2xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm transition-all hover:border-violet-500/50 hover:bg-slate-800/50"
			>
				<div
					class="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 transition-colors group-hover:bg-violet-500/20"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 10V3L4 14h7v7l9-11h-7z"
						/>
					</svg>
				</div>
				<h3 class="mb-1 font-semibold text-white">Faster</h3>
				<p class="text-sm text-slate-400">Lightning quick performance</p>
			</div>

			<div
				class="group rounded-2xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm transition-all hover:border-purple-500/50 hover:bg-slate-800/50"
			>
				<div
					class="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 transition-colors group-hover:bg-purple-500/20"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
						/>
					</svg>
				</div>
				<h3 class="mb-1 font-semibold text-white">Refined</h3>
				<p class="text-sm text-slate-400">Polished user experience</p>
			</div>
		</div>

		<!-- Email notification -->

		<!-- Footer -->
		<p
			class="mt-12 text-sm text-slate-600 transition-all delay-1000 duration-700"
			class:opacity-100={mounted}
			class:opacity-0={!mounted}
		>
			The site will be live soon • Stay tuned
		</p>
	</div>
</div>

<style>
	@keyframes float {
		0%,
		100% {
			transform: translateY(0) translateX(0);
			opacity: 0.2;
		}
		25% {
			transform: translateY(-20px) translateX(10px);
			opacity: 0.5;
		}
		50% {
			transform: translateY(-40px) translateX(-10px);
			opacity: 0.3;
		}
		75% {
			transform: translateY(-20px) translateX(5px);
			opacity: 0.6;
		}
	}

	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(200%);
		}
	}

	:global(.animate-float) {
		animation: float 10s ease-in-out infinite;
	}

	:global(.animate-shimmer) {
		animation: shimmer 2s ease-in-out infinite;
	}
</style>
