<script lang="ts">
	import { type Snippet } from 'svelte';
	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="grid min-h-svh grid-cols-1 lg:grid-cols-2">
	<div
		class="relative hidden overflow-hidden bg-black lg:flex lg:flex-1 lg:items-center lg:justify-center"
	>
		<div
			class="absolute top-10 left-10 flex items-center gap-3 text-3xl font-bold tracking-tight text-white 2xl:top-15 2xl:left-20"
		>
			<div class=" inset-0 rounded-2xl bg-linear-to-br from-slate-50 to-slate-200 opacity-100">
				<svg
					viewBox="0 0 24 24"
					class="relative z-10 h-8 w-8 text-slate-900 drop-shadow-sm"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" class="opacity-20" />
					<path
						d="M12 2a10 10 0 0 1 10 10"
						class="origin-center animate-spin text-emerald-500"
						stroke-linecap="round"
					/>
					<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
					<path d="M12 12l4 4" />
				</svg>
			</div>

			Quant xAI
		</div>

		<div class="absolute inset-0 z-0">
			<div
				class="absolute top-1/2 left-1/2 size-200 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-900/10 mix-blend-screen blur-[150px]"
			></div>
		</div>

		<!-- Abstract Constellation / Data Network -->
		<div class="perspective-1000 relative z-10 flex h-full w-full items-center justify-center">
			<div
				class="absolute size-175 animate-[spin_60s_linear_infinite] rounded-full border border-white/3"
			></div>
			<div
				class="absolute size-137.5 animate-[spin_45s_linear_infinite_reverse] rounded-full border border-white/4 opacity-50"
			></div>
			<div
				class="absolute size-100 animate-[spin_20s_linear_infinite] rounded-full border border-dashed border-white/8"
			></div>

			<!-- The Neural Network: Finding Hidden Signals -->
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="absolute size-200 animate-[spin_10s_linear_infinite]">
					<div
						class="h-full w-full rotate-45 transform bg-linear-to-t from-transparent via-emerald-500/10 to-transparent opacity-30"
						style="clip-path: polygon(50% 50%, 0 0, 100% 0);"
					></div>
				</div>

				<div
					class="relative z-20 flex h-32 w-32 animate-pulse items-center justify-center rounded-full bg-emerald-500/10 blur-xl"
				>
					<div
						class="absolute h-16 w-16 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-white/10"
					></div>
					<div class="h-2 w-2 rounded-full bg-white shadow-[0_0_20px_white]"></div>
				</div>

				<!-- Live Data Constellation -->
				<svg class="absolute size-150 overflow-visible opacity-80" viewBox="0 0 600 600">
					<defs>
						<radialGradient id="signalGlow" cx="0.5" cy="0.5" r="0.5">
							<stop offset="0%" stop-color="#10b981" stop-opacity="0.8" />
							<stop offset="100%" stop-color="#10b981" stop-opacity="0" />
						</radialGradient>
					</defs>

					<!-- Hidden Data Points (Dim) -->
					{#each Array(20) as _, i}
						<circle
							cx={300 + Math.cos(i * 18) * (100 + Math.random() * 150)}
							cy={300 + Math.sin(i * 18) * (100 + Math.random() * 150)}
							r={Math.random() * 1.5 + 0.5}
							fill="white"
							opacity="0.1"
							class="animate-pulse"
							style="animation-delay: {Math.random() * 2}s"
						/>
					{/each}

					<!-- "Found" Signals (Bright & Connected) -->
					<!-- Signal Group 1: Bottom Left to Center (Emerald) -->
					<g class="animate-[fadeIn_0.5s_ease-out_1s_forwards] opacity-0">
						<line
							x1="180"
							y1="420"
							x2="240"
							y2="360"
							stroke="#10b981"
							stroke-width="0.5"
							stroke-opacity="0.4"
						/>
						<line
							x1="240"
							y1="360"
							x2="300"
							y2="300"
							stroke="#10b981"
							stroke-width="1"
							class="animate-[pulse-path_4s_ease-in-out_infinite_1s]"
						/>
						<circle
							cx="180"
							cy="420"
							r="2"
							fill="#34d399"
							class="animate-[pulse-node_4s_ease-in-out_infinite_1s]"
						/>
						<circle
							cx="240"
							cy="360"
							r="2"
							fill="#34d399"
							class="animate-[pulse-node_4s_ease-in-out_infinite_1s]"
						/>

						<!-- Label (Auto-reveal) -->
						<foreignObject
							x="140"
							y="430"
							width="120"
							height="40"
							class="animate-[label-reveal_4s_ease-in-out_infinite_1s] overflow-visible opacity-0"
						>
							<div
								xmlns="http://www.w3.org/1999/xhtml"
								class="rounded border border-emerald-500/30 bg-[#0f1218]/90 px-2 py-1 font-mono text-[10px] tracking-wide whitespace-nowrap text-emerald-400 shadow-lg backdrop-blur-sm"
							>
								ASSET_ALLOCATION
							</div>
						</foreignObject>
					</g>

					<!-- Signal Group 2: Top Right to Center (Blue) -->
					<g class="animate-[fadeIn_0.5s_ease-out_2s_forwards] opacity-0">
						<line
							x1="450"
							y1="150"
							x2="380"
							y2="220"
							stroke="#3b82f6"
							stroke-width="0.5"
							stroke-opacity="0.4"
						/>
						<line
							x1="380"
							y1="220"
							x2="300"
							y2="300"
							stroke="#3b82f6"
							stroke-width="1"
							class="animate-[pulse-path_5s_ease-in-out_infinite_3s]"
						/>
						<circle
							cx="450"
							cy="150"
							r="2"
							fill="#60a5fa"
							class="animate-[pulse-node_5s_ease-in-out_infinite_3s]"
						/>
						<circle
							cx="380"
							cy="220"
							r="2"
							fill="#60a5fa"
							class="animate-[pulse-node_5s_ease-in-out_infinite_3s]"
						/>

						<!-- Label (Auto-reveal) -->
						<foreignObject
							x="400"
							y="110"
							width="120"
							height="40"
							class="animate-[label-reveal_5s_ease-in-out_infinite_3s] overflow-visible opacity-0"
						>
							<div
								xmlns="http://www.w3.org/1999/xhtml"
								class="rounded border border-blue-500/30 bg-[#0f1218]/90 px-2 py-1 font-mono text-[10px] tracking-wide whitespace-nowrap text-blue-400 shadow-lg backdrop-blur-sm"
							>
								AUDIT_COMPLIANCE
							</div>
						</foreignObject>
					</g>

					<!-- Signal Group 3: Complex Pattern Detection (Purple) -->
					<g class="animate-[fadeIn_0.5s_ease-out_3s_forwards] opacity-0">
						<path
							d="M 400 400 L 350 420 L 320 380 L 300 300"
							fill="none"
							stroke="#a855f7"
							stroke-width="0.5"
							class="animate-[pulse-path_6s_ease-in-out_infinite_5s]"
						/>
						<circle
							cx="400"
							cy="400"
							r="1.5"
							fill="#c084fc"
							class="animate-[pulse-node_6s_ease-in-out_infinite_5s]"
						/>
						<circle
							cx="350"
							cy="420"
							r="1.5"
							fill="#c084fc"
							class="animate-[pulse-node_6s_ease-in-out_infinite_5s]"
						/>
						<circle
							cx="320"
							cy="380"
							r="1.5"
							fill="#c084fc"
							class="animate-[pulse-node_6s_ease-in-out_infinite_5s]"
						/>

						<!-- Label (Auto-reveal) -->
						<foreignObject
							x="360"
							y="430"
							width="140"
							height="40"
							class="animate-[label-reveal_6s_ease-in-out_infinite_5s] overflow-visible opacity-0"
						>
							<div
								xmlns="http://www.w3.org/1999/xhtml"
								class="rounded border border-purple-500/30 bg-[#0f1218]/90 px-2 py-1 font-mono text-[10px] tracking-wide whitespace-nowrap text-purple-400 shadow-lg backdrop-blur-sm"
							>
								RISK_ASSESSMENT
							</div>
						</foreignObject>
					</g>
				</svg>
			</div>

			<!-- Floating Background Particles (Noise) -->
			<!-- Using absolute positioning carefully to create a cloud effect -->
			<div class="absolute top-1/3 left-1/4 animate-[float_8s_ease-in-out_infinite]">
				<div class="h-1 w-1 rounded-full bg-white/20"></div>
			</div>
			<div class="absolute right-1/3 bottom-1/3 animate-[float_7s_ease-in-out_infinite_1s]">
				<div class="h-1.5 w-1.5 rounded-full bg-emerald-500/20"></div>
			</div>
			<div class="absolute top-1/4 right-1/4 animate-[float_9s_ease-in-out_infinite_2s]">
				<div class="h-1 w-1 rounded-full bg-blue-500/20"></div>
			</div>

			<!-- Minimal Status Text -->
			<div class="absolute z-20 w-full px-8 text-center lg:bottom-10 2xl:bottom-24">
				<div class="flex flex-col items-center lg:gap-6">
					<div
						class="hidden h-px w-24 bg-linear-to-r from-transparent via-emerald-500/50 to-transparent 2xl:block"
					></div>

					<div class="max-w-lg space-y-3 2xl:space-y-4">
						<h3 class="text-4xl leading-tight font-light tracking-tight text-white md:text-5xl">
							<span class="inline-flex items-center">
								<span
									class="typewriter-text bg-linear-to-br from-white to-slate-400 bg-clip-text pb-1 text-transparent"
									>See the market clearly.</span
								>
								<span class="ml-1 h-[1em] w-0.75 animate-[blink_1s_infinite] bg-emerald-500"></span>
							</span>
						</h3>

						<p
							class="animate-[fadeIn_0.5s_ease-out_2.5s_forwards] text-lg leading-relaxed font-light text-slate-400 opacity-0"
						>
							Orion processes millions of data points to find the <span
								class="font-normal text-emerald-400">signal</span
							> in the noise.
						</p>
					</div>

					<div
						class="mt-6 flex animate-[fadeIn_0.5s_ease-out_3s_forwards] items-center gap-3 font-mono text-xs tracking-[0.2em] text-emerald-500/80 uppercase opacity-0"
					>
						<span class="relative flex h-2 w-2">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
							></span>
							<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
						</span>
						System Online
					</div>
				</div>
			</div>
		</div>
	</div>

	<div
		class="relative flex min-h-svh flex-col overflow-hidden bg-gray-50 lg:min-h-auto lg:justify-center lg:px-24 xl:px-32"
	>
		<!-- Subtle Grid -->
		<div
			class="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-size-[24px_24px] opacity-60"
		></div>

		<!-- Gradient Glow -->
		<div
			class="pointer-events-none absolute -top-40 -right-40 h-96 w-96 animate-[pulse-glow_8s_ease-in-out_infinite] rounded-full bg-emerald-100/40 mix-blend-multiply blur-3xl"
		></div>
		<div
			class="pointer-events-none absolute bottom-0 -left-20 h-80 w-80 animate-[pulse-glow_10s_ease-in-out_infinite_2s] rounded-full bg-blue-100/40 mix-blend-multiply blur-3xl"
		></div>

		<!-- Main Content Container -->
		<div
			class="relative z-10 flex flex-1 flex-col justify-center px-8 py-12 md:mx-auto md:w-full md:max-w-sm lg:px-0 lg:py-0"
		>
			<!-- Logo Header -->
			<div class="mb-10 flex w-full flex-col items-center gap-6 text-center md:hidden">
				<div class="group relative">
					<!-- Subtle Glow behind logo -->
					<div
						class="absolute inset-0 animate-pulse rounded-full bg-emerald-500/20 blur-xl transition-all duration-500 group-hover:bg-emerald-500/30"
					></div>
					<div
						class="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3"
					>
						<!-- Brand Icon (Abstract 'Q' / Lens) -->
						<div
							class="absolute inset-0 rounded-2xl bg-linear-to-br from-slate-50 to-slate-100 opacity-50"
						></div>
						<svg
							viewBox="0 0 24 24"
							class="relative z-10 h-8 w-8 text-slate-900 drop-shadow-sm"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" class="opacity-20" />
							<path d="M12 2a10 10 0 0 1 10 10" class="text-emerald-500" stroke-linecap="round" />
							<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
							<path d="M12 12l4 4" />
						</svg>
					</div>
					<!-- Minimal Floating Badge -->
					<div
						class="absolute -top-2 -right-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-emerald-600 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100"
					>
						V2.0
					</div>
				</div>

				<div class="space-y-1 text-center">
					<span class="block text-2xl font-bold tracking-tight text-slate-900">Quant Orion</span>
					<p class="text-sm font-medium tracking-wide text-slate-500">Enterprise Intelligence</p>
				</div>
			</div>

			{@render children()}

			<div class="mt-12 text-center text-xs text-slate-400">
				&copy; {new Date().getFullYear()} Quant Orion. All rights reserved.
			</div>
		</div>
	</div>

	<style>
		.typewriter-text {
			display: inline-block;
			overflow: hidden;
			white-space: nowrap;
			border-right: 3px solid transparent; /* Cursor placeholder */
			width: 0;
			animation: typing 2.5s steps(30, end) forwards;
		}

		@keyframes typing {
			from {
				width: 0;
			}
			to {
				width: 100%;
			}
		}

		@keyframes blink {
			0%,
			100% {
				opacity: 1;
			}
			50% {
				opacity: 0;
			}
		}

		@keyframes float {
			0%,
			100% {
				transform: translateY(0px) translateX(0px);
			}
			50% {
				transform: translateY(-15px) translateX(5px);
			}
		}

		@keyframes float-reverse {
			0%,
			100% {
				transform: translateY(0px) translateX(0px);
			}
			50% {
				transform: translateY(15px) translateX(-5px);
			}
		}

		@keyframes spin {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}

		@keyframes fadeIn {
			from {
				opacity: 0;
				transform: translateY(10px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		@keyframes pulse-glow {
			0%,
			100% {
				opacity: 0.3;
				transform: scale(1);
			}
			50% {
				opacity: 0.6;
				transform: scale(1.05);
			}
		}

		@keyframes label-reveal {
			0%,
			20%,
			100% {
				opacity: 0;
				transform: translateY(5px);
			}
			30%,
			70% {
				opacity: 1;
				transform: translateY(0);
			}
			80% {
				opacity: 0;
				transform: translateY(-5px);
			}
		}

		@keyframes pulse-path {
			0%,
			100% {
				stroke-width: 1;
				filter: drop-shadow(0 0 0 rgba(0, 0, 0, 0));
			}
			40%,
			60% {
				stroke-width: 2.5;
				filter: drop-shadow(0 0 10px currentColor);
			}
		}

		@keyframes pulse-node {
			0%,
			100% {
				r: 1.5;
			}
			40%,
			60% {
				r: 4;
			}
		}

		.perspective-1000 {
			perspective: 1000px;
		}
	</style>
</div>
