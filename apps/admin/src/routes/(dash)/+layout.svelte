<script>
	import AppSidebar from '$lib/components/layout/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import SiteHeader from '$lib/components/layout/site-header.svelte';

	let { children, data } = $props();
	const currentUser = $derived(data?.user);
</script>

<Sidebar.Provider>
	<AppSidebar variant="inset" user={currentUser} />
	<Sidebar.Inset>
		<SiteHeader />
		<div class="admin-shell flex flex-1 flex-col">
			<div class="admin-content @container/main flex flex-1 flex-col gap-2">
				{@render children?.()}
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
