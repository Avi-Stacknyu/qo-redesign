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
			<h2 class="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
				{currentDate}
			</h2>
			<h1 class="max-w-3xl text-3xl leading-tight font-medium tracking-tight text-foreground lg:text-4xl">
				{dashboardName}
			</h1>
		</div>
	{/snippet}
</DashboardShell>
