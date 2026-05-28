<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { CheckCircle } from '@lucide/svelte';
	import { onMount } from 'svelte';

	const sessionId = $derived($page.url.searchParams.get('session_id'));

	onMount(() => {
		const timer = setTimeout(() => goto('/preferences/billing', { replaceState: true }), 5000);
		return () => clearTimeout(timer);
	});
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="flex max-w-sm flex-col items-center gap-4 text-center">
		<div
			class="flex size-16 items-center justify-center rounded-full bg-green-500/10 text-green-500"
		>
			<CheckCircle class="size-8" />
		</div>
		<h1 class="text-2xl font-semibold text-foreground">Payment Successful</h1>
		<p class="text-sm text-muted-foreground">
			Your payment has been processed. Credits will be added to your account shortly.
		</p>
		{#if sessionId}
			<p class="text-xs text-muted-foreground/50 tabular-nums">
				Session: {sessionId.slice(0, 20)}…
			</p>
		{/if}
		<a
			href="/preferences/billing"
			class="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
		>
			Back to Billing
		</a>
		<p class="text-[11px] text-muted-foreground/40">Redirecting automatically in 5 seconds…</p>
	</div>
</div>
