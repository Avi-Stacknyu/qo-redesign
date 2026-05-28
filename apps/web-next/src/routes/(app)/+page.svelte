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
			<h2 class="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
				{currentDate}
			</h2>
			<h1 class="max-w-3xl text-3xl leading-tight font-medium tracking-tight text-foreground lg:text-4xl">
				Welcome back, <span
					class="bg-linear-to-r from-primary to-secondary bg-clip-text font-semibold text-transparent"
					>{userName}</span
				>
			</h1>
		</div>
	{/snippet}
</DashboardShell>
