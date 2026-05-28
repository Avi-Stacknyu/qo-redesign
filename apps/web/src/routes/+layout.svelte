<script lang="ts">
	import { page } from '$app/state';
	import { NavigationLoader } from '@wabosh/navigation-loader';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from 'svelte-sonner';
	import './layout.css';

	let { data, children } = $props();

	// Skip ModeWatcher on auth/onboarding routes — we force light mode server-side
	const isLightModeRoute = $derived(
		page.route.id?.startsWith('/(auth)') || page.route.id?.includes('onboarding') || false
	);
</script>

<svelte:head>
	<title>Quant xAi</title>
</svelte:head>

<Toaster richColors theme="light" position="top-right" />
<NavigationLoader animationDuration={200} color="#1dab4f" />
{#if !isLightModeRoute}
	<ModeWatcher track={false} />
{/if}
{@render children()}
