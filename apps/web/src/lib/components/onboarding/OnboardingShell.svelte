<script lang="ts">
	import { BrainCircuit, Sparkles } from '@lucide/svelte';
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

	const progressValue = $derived(Math.min(100, ((currentStep + 1) / totalSteps) * 100));

	const factSlots = [
		// ox/oy: Outer Node, mx/my: Mid Node, lx/ly: Label Position
		{ ox: 160, oy: 420, mx: 220, my: 360, lx: 60, ly: 430 }, // Bottom Left
		{ ox: 440, oy: 160, mx: 380, my: 220, lx: 380, ly: 110 }, // Top Right
		{ ox: 420, oy: 400, mx: 360, my: 350, lx: 360, ly: 410 }, // Bottom Right
		{ ox: 160, oy: 180, mx: 220, my: 240, lx: 60, ly: 130 }, // Top Left
		{ ox: 480, oy: 290, mx: 400, my: 300, lx: 440, ly: 250 }, // Right
		{ ox: 120, oy: 300, mx: 200, my: 300, lx: 20, ly: 260 }, // Left
		{ ox: 340, oy: 480, mx: 320, my: 400, lx: 280, ly: 490 }, // Bottom
		{ ox: 260, oy: 120, mx: 280, my: 200, lx: 200, ly: 70 } // Top
	];

	// Simplified colors for nodes - lines use a shared subtle color
	const factColors = [
		{ fill: '#34d399', text: '#6ee7b7' }, // Emerald
		{ fill: '#60a5fa', text: '#93c5fd' }, // Blue
		{ fill: '#c084fc', text: '#d8b4fe' }, // Purple
		{ fill: '#fbbf24', text: '#fde68a' }, // Amber
		{ fill: '#22d3ee', text: '#67e8f9' }, // Cyan
		{ fill: '#fb7185', text: '#fda4af' }, // Rose
		{ fill: '#a78bfa', text: '#c4b5fd' }, // Violet
		{ fill: '#fb923c', text: '#fdba74' } // Orange
	];

	function formatFactLabel(label: string): string {
		return label.toUpperCase().replace(/\s+/g, '_').slice(0, 22);
	}
</script>

<div
	class="grid min-h-svh w-full grid-cols-1 overflow-x-hidden lg:grid-cols-[400px_1fr] xl:grid-cols-[480px_1fr]"
>
	<div class="relative hidden h-full flex-col overflow-hidden bg-black lg:flex">
		<div
			class="absolute top-8 left-8 z-20 flex items-center gap-3 text-xl font-bold tracking-tight text-white"
		>
			<div class="relative flex h-10 w-10 items-center justify-center">
				<div class="absolute inset-0 rounded-xl bg-linear-to-br from-slate-50 to-slate-200"></div>
				<svg
					viewBox="0 0 24 24"
					class="relative z-10 h-6 w-6 text-slate-900"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path
						d="M12 2a10 10 0 0 1 10 10"
						class="origin-center animate-[spin_8s_linear_infinite] text-emerald-500"
						stroke-linecap="round"
					/>
					<circle cx="12" cy="12" r="10" class="opacity-20" />
					<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
					<path d="M12 12l4 4" />
				</svg>
			</div>
			<span>Quant<span class="text-emerald-500">xAI</span></span>
		</div>

		<div class="absolute inset-0 z-0">
			<div
				class="absolute top-1/2 left-1/2 size-200 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-900/20 mix-blend-screen blur-[120px]"
			></div>
		</div>

		<div
			class="relative z-10 flex size-full scale-90 items-center justify-center opacity-80 transition-all duration-1000"
		>
			<div
				class="absolute size-137.5 animate-[spin_45s_linear_infinite_reverse] rounded-full border border-white/4 opacity-50"
			></div>
			<div
				class="absolute size-100 animate-[spin_20s_linear_infinite] rounded-full border border-dashed border-white/8"
			></div>

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

				<svg
					class="absolute h-full max-h-150 w-full max-w-150 overflow-visible opacity-80"
					viewBox="0 0 600 600"
					preserveAspectRatio="xMidYMid meet"
				>
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

					{#if answeredFacts.length === 0}
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
					{/if}

					<!-- Dynamic constellation nodes from user answers -->
					{#each answeredFacts.slice(0, 8) as fact, i}
						{@const slot = factSlots[i]}
						{@const color = factColors[i % factColors.length]}
						<g
							class="animate-[fadeIn_0.6s_ease-out_forwards] opacity-0"
							style="animation-delay: {i * 150}ms"
						>
							<!-- Line: outer node → mid node -->
							<line
								x1={slot.ox}
								y1={slot.oy}
								x2={slot.mx}
								y2={slot.my}
								stroke="rgba(255, 255, 255, 0.2)"
								stroke-width="0.5"
							/>
							<!-- Line: mid node → center (pulsing) -->
							<line
								x1={slot.mx}
								y1={slot.my}
								x2="300"
								y2="300"
								stroke="rgba(255, 255, 255, 0.15)"
								stroke-width="1"
								class="animate-[pulse-path_4s_ease-in-out_infinite]"
								style="animation-delay: {i * 0.7}s"
							/>
							<!-- Outer node -->
							<circle
								cx={slot.ox}
								cy={slot.oy}
								r="2.5"
								fill={color.fill}
								class="animate-[pulse-node_4s_ease-in-out_infinite]"
								style="animation-delay: {i * 0.7}s"
							/>
							<!-- Mid node -->
							<circle
								cx={slot.mx}
								cy={slot.my}
								r="1.5"
								fill={color.fill}
								class="animate-[pulse-node_4s_ease-in-out_infinite]"
								style="animation-delay: {i * 0.7}s"
							/>
							<!-- Label tag -->
							<foreignObject
								x={slot.lx}
								y={slot.ly}
								width="180"
								height="46"
								class="overflow-visible"
							>
								<div
									xmlns="http://www.w3.org/1999/xhtml"
									class="flex flex-col rounded border border-white/10 bg-[#0f1218]/90 px-2.5 py-1.5 shadow-lg backdrop-blur-md"
								>
									<span
										class="font-mono text-[9px] tracking-wider opacity-50"
										style="color: {color.text}">{formatFactLabel(fact.label)}</span
									>
									<span
										class="max-w-40 truncate font-mono text-[11px] font-medium tracking-tight text-white/90"
										>{fact.value}</span
									>
								</div>
							</foreignObject>
						</g>
					{/each}
				</svg>
			</div>
		</div>

		<!-- Footer Status -->
		<div class="absolute bottom-10 w-full px-10">
			<div class="flex items-center justify-between border-t border-white/10 pt-6">
				<div class="flex items-center gap-2 text-xs font-medium text-slate-400">
					<Sparkles class="h-3 w-3 text-emerald-500" />
					<span>Personalizing Experience</span>
				</div>
				<div class="font-mono text-xs text-slate-600">
					ID: {(totalSteps * 1000 + currentStep).toString(36).toUpperCase()}
				</div>
			</div>
		</div>
	</div>

	<!-- Right Side: Form Content -->
	<div class="relative flex min-h-svh flex-col bg-slate-50 transition-colors duration-500">
		<!-- Subtle Grid -->
		<div
			class="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-size-[24px_24px] opacity-60"
		></div>

		<!-- Gradient Glows -->
		<div
			class="pointer-events-none absolute -top-[20%] -right-[10%] h-125 w-125 rounded-full bg-emerald-100/40 opacity-50 mix-blend-multiply blur-3xl"
		></div>
		<div
			class="pointer-events-none absolute bottom-0 left-0 h-100 w-100 rounded-full bg-blue-100/30 opacity-50 mix-blend-multiply blur-3xl"
		></div>

		<!-- Mobile Header (Visible only on small screens) -->
		<div class="relative z-20 flex h-16 w-full items-center justify-between px-6 lg:hidden">
			<div class="flex items-center gap-2 font-bold text-slate-900">
				<div class="relative flex h-8 w-8 items-center justify-center">
					<div
						class="absolute inset-0 rounded-lg border border-slate-200 bg-linear-to-br from-white to-slate-100 shadow-sm"
					></div>
					<BrainCircuit class="relative z-10 h-4 w-4 text-emerald-600" />
				</div>
				<span>Quant<span class="text-emerald-600">xAI</span></span>
			</div>
			<div class="text-xs font-semibold text-slate-500">
				Step {currentStep + 1}<span class="text-slate-300">/</span>{totalSteps}
			</div>
		</div>

		<div class="absolute top-0 left-0 z-30 h-1 w-full bg-slate-100">
			<div
				class="h-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
				style="width: {progressValue}%"
			></div>
		</div>

		<div
			class="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12 lg:px-24"
		>
			<div class="w-full max-w-2xl">
				{@render children()}
			</div>
		</div>

		<div class="absolute right-8 bottom-6 hidden text-xs font-medium text-slate-400 lg:block">
			Press <kbd
				class="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans font-bold text-slate-600 shadow-sm"
				>Enter ↵</kbd
			> to continue
		</div>
	</div>
</div>
