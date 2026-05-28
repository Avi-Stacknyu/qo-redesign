<!--
	@deprecated This page is deprecated. Trial plans are now auto-activated after onboarding.
	This page is kept for backwards compatibility but will redirect via +page.server.ts.
-->
<script lang="ts">
	import { LoaderCircle } from '@lucide/svelte';
</script>

<div class="flex min-h-svh items-center justify-center">
	<div class="flex flex-col items-center gap-3">
		<LoaderCircle class="h-8 w-8 animate-spin text-emerald-500" />
		<p class="text-sm text-slate-500">Redirecting...</p>
	</div>
</div>
