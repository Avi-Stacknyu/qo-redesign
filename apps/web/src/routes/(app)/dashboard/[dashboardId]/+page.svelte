<script lang="ts">
	import DashboardShell from '$lib/components/dashboard/DashboardShell.svelte';
	import { dashboard } from '$lib/state/dashboard.svelte';

	let { data } = $props();

	$effect(() => {
		if (data.dashboardId && data.dashboardId !== dashboard.activeProfileId) {
			dashboard.switchProfile(data.dashboardId);
		}
		dashboard.hydrateWidgets(data.layout, data.widgets);
	});

	const dashboardName = $derived(
		dashboard.profiles.find((p) => p.id === data.dashboardId)?.profile_name ?? 'Dashboard'
	);

	const currentDate = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	}).format(new Date());
</script>

<DashboardShell pageTitle="{dashboardName} — Quant Orion">
	{#snippet header()}
		<div class="space-y-1">
			<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
				{currentDate}
			</h2>
			<h1 class="text-4xl font-light tracking-tight text-foreground lg:text-5xl">
				{dashboardName}
			</h1>
		</div>
	{/snippet}
</DashboardShell>
