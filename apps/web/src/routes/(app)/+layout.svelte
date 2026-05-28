<script lang="ts">
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import { dashboard } from '$lib/state/dashboard.svelte';

	let { children, data } = $props();

	$effect(() => {
		dashboard.hydrateProfiles(data.profiles, data.activeProfile);
	});
</script>

<!-- Global Background -->
<div class="fixed inset-0 z-[-1] bg-background transition-colors duration-500">
	<!-- Gradient Orb 1 (Top Left) -->
	<div
		class="absolute -top-40 -left-40 size-150 rounded-full bg-primary/20 mix-blend-screen blur-[120px] transition-colors duration-700"
	></div>

	<!-- Gradient Orb 2 (Bottom Right) -->
	<div
		class="absolute -right-40 -bottom-40 size-150 rounded-full bg-secondary/20 mix-blend-screen blur-[120px] transition-colors duration-700"
	></div>

	<!-- Grid Pattern -->
	<div
		class="absolute inset-0 bg-[linear-gradient(to_right,var(--muted)_1px,transparent_1px),linear-gradient(to_bottom,var(--muted)_1px,transparent_1px)] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-size-[24px_24px] opacity-20"
	></div>
</div>

<Sidebar.Provider>
	<AppSidebar user={data.user} agents={data.agents} features={data.features} />
	<Sidebar.Inset class="min-w-0 bg-transparent">
		<div class="flex flex-1 flex-col gap-4 p-4 sm:p-6">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
