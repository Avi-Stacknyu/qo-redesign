<script lang="ts">
	import DashboardShell from '$lib/components/dashboard/DashboardShell.svelte';
	import { dashboard } from '$lib/state/dashboard.svelte';

	let { data } = $props();

	$effect(() => {
		dashboard.hydrateWidgets(data.layout, data.widgets);
	});

	const userName = $derived(data.user?.name || 'Trader');

	const currentDate = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	}).format(new Date());
</script>

<DashboardShell pageTitle="Dashboard — Quant Orion">
	{#snippet header()}
		<div class="space-y-1">
			<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
				{currentDate}
			</h2>
			<h1 class="text-4xl font-light tracking-tight text-foreground lg:text-5xl">
				Welcome back, <span
					class="bg-linear-to-r from-primary to-secondary bg-clip-text font-medium text-transparent"
					>{userName}</span
				>
			</h1>
		</div>
	{/snippet}
</DashboardShell>
