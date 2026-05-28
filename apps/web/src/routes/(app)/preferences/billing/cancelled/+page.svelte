<script lang="ts">
	import { goto } from '$app/navigation';
	import { XCircle } from '@lucide/svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		const timer = setTimeout(() => goto('/preferences/billing', { replaceState: true }), 5000);
		return () => clearTimeout(timer);
	});
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="flex max-w-sm flex-col items-center gap-4 text-center">
		<div
			class="flex size-16 items-center justify-center rounded-full bg-muted/30 text-muted-foreground"
		>
			<XCircle class="size-8" />
		</div>
		<h1 class="text-2xl font-semibold text-foreground">Payment Cancelled</h1>
		<p class="text-sm text-muted-foreground">Your payment was cancelled. No charges were made.</p>
		<a
			href="/preferences/billing"
			class="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
		>
			Back to Billing
		</a>
		<p class="text-[11px] text-muted-foreground/40">Redirecting automatically in 5 seconds…</p>
	</div>
</div>
