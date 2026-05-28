<script lang="ts">
	import { page } from '$app/state';
	import { Separator } from '$lib/components/shadcn/separator/index.js';
	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import ThemeSelector from '../theme-handler/ThemeSelector.svelte';

	const PAGE_TITLE_MAP: Record<string, string> = {
		'': 'Dashboard',
		users: 'Users',
		agents: 'Agents',
		models: 'AI Models',
		providers: 'Providers',
		tools: 'Tools',
		costing: 'AI Analytics',
		'settings/pricing': 'Pricing',
		'settings/infra': 'Infra Config',
		'settings/onboarding': 'Onboarding Profiles',
		dash: 'Dashboard'
	};

	const DETAIL_TITLE_MAP: Record<string, string> = {
		users: 'User Detail',
		agents: 'Agent Detail',
		models: 'Model Detail'
	};

	function formatSegment(segment: string) {
		return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
	}

	function resolveTitle(pathname: string) {
		const segments = pathname.split('/').filter(Boolean);
		if (segments.length === 0) {
			return PAGE_TITLE_MAP[''];
		}

		const first = segments[0];
		const firstTwoKey = segments.slice(0, 2).join('/');

		if (PAGE_TITLE_MAP[firstTwoKey]) {
			return PAGE_TITLE_MAP[firstTwoKey];
		}

		if (PAGE_TITLE_MAP[first]) {
			if (segments.length > 1 && DETAIL_TITLE_MAP[first]) {
				return DETAIL_TITLE_MAP[first];
			}
			return PAGE_TITLE_MAP[first];
		}

		return formatSegment(first);
	}

	const currentPageTitle = $derived(resolveTitle(page.url.pathname));
</script>

<!-- 
<header
	class="admin-header flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
> -->
<header class="flex h-16 shrink-0 items-center gap-2">
	<div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<h1 class="text-base font-medium">{currentPageTitle}</h1>
		<div class="ml-auto flex items-center gap-2">
			<ThemeSelector />
		</div>
	</div>
</header>
