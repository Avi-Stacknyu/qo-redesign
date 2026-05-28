<svelte:head>
	<title>Maintenance - Quant Orion Admin</title>
</svelte:head>

<div class="flex min-h-svh items-center justify-center bg-neutral-50 px-6">
	<div class="max-w-sm text-center">
		<div
			class="mx-auto mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200"
		>
			<span class="pulse h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
		</div>
		<h1 class="text-lg font-semibold text-neutral-900">Admin is updating</h1>
		<p class="mt-2 text-sm leading-relaxed text-neutral-500">
			The control panel is briefly offline for maintenance. Check back shortly.
		</p>
	</div>
</div>

<style>
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
	:global(.pulse) {
		animation: pulse 2s ease-in-out infinite;
	}
</style>
