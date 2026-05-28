<script lang="ts">
	import { page } from '$app/state';
	import { Toaster } from '$lib/components/shadcn/sonner';
	import {
		applyServerThemePreference,
		setThemeServerPersistenceEnabled
	} from '$lib/components/theme-handler/themeStore.svelte';
	import { NavigationLoader } from '@wabosh/navigation-loader';
	import { toast } from 'svelte-sonner';
	import { getFlash } from 'sveltekit-flash-message';
	import '../app.css';
	import MaintenancePage from '$lib/components/maintenance/MaintenancePage.svelte';

	let { data, children } = $props();
	let { user } = $derived(data);

	const flash = getFlash(page);

	// Track if we've already initialized the theme to avoid re-applying on navigation
	let themeInitialized = $state(false);

	$effect(() => {
		const isAuthenticated = Boolean(user);
		setThemeServerPersistenceEnabled(isAuthenticated);

		// Only initialize theme once when user is authenticated
		// applyServerThemePreference() internally calls applyTheme() which handles route exclusion
		if (isAuthenticated && !themeInitialized) {
			const preference = data.themePreference ?? undefined;
			const recordId = data.themeCustomizationRecordId ?? null;

			if (preference?.preset) {
				applyServerThemePreference(preference, recordId);
			}
			themeInitialized = true;
		}

		// Reset flag when user logs out
		if (!isAuthenticated && themeInitialized) {
			themeInitialized = false;
		}
	});

	$effect(() => {
		const flashValue = $flash;
		if (!flashValue) return;

		// Use setTimeout to avoid state updates during render
		setTimeout(() => {
			if (flashValue.type === 'success') {
				toast.success(flashValue.message);
			} else {
				toast.error(flashValue.message);
			}
			$flash = undefined;
		}, 0);
	});
</script>

<svelte:head>
	<title>{'Quant xAi'}</title>
</svelte:head>

<Toaster richColors theme="light" position="top-right" />
<NavigationLoader animationDuration={200} color="#1dab4f" />

{#if data.maintenanceMode}
	<MaintenancePage />
{:else}
	{@render children()}
{/if}
