<script lang="ts">
	import { CircleCheck, CircleAlert, ArrowLeft } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Verify Email — Quant Orion</title>
</svelte:head>

<div class="space-y-8">
	<div class="text-center">
		<div class="mb-6 flex justify-center">
			<div
				class="flex size-14 items-center justify-center rounded-full border {data.success
					? 'border-green-100 bg-green-50'
					: 'border-red-100 bg-red-50'}"
			>
				{#if data.success}
					<CircleCheck class="size-6 text-[#1e8558]" />
				{:else}
					<CircleAlert class="size-6 text-red-500" />
				{/if}
			</div>
		</div>
		<h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
			{data.success ? 'Email Verified' : 'Verification Failed'}
		</h1>
		<p class="mt-2 text-sm text-slate-500">{data.message}</p>
	</div>

	<div class="text-center">
		<a
			href="/login"
			class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-[#1e8558]"
		>
			<ArrowLeft class="size-4" />
			{data.success ? 'Continue to Login' : 'Back to Login'}
		</a>
	</div>
</div>
