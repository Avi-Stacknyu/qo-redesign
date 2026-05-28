<script lang="ts">
	import CameraIcon from '@lucide/svelte/icons/camera';
	import ChartBarIcon from '@lucide/svelte/icons/chart-bar';
	import ChartDonutIcon from '@lucide/svelte/icons/chart-pie';
	import DashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import FileAiIcon from '@lucide/svelte/icons/file-text';
	import FileDescriptionIcon from '@lucide/svelte/icons/file-text';
	import FileWordIcon from '@lucide/svelte/icons/file-type';
	import FileUploadIcon from '@lucide/svelte/icons/upload';
	import InnerShadowTopIcon from '@lucide/svelte/icons/hexagon';
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import ListDetailsIcon from '@lucide/svelte/icons/list';
	import ReportIcon from '@lucide/svelte/icons/file-chart-line';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import UsersIcon from '@lucide/svelte/icons/users';
	import TagIcon from '@lucide/svelte/icons/tag';
	import ToggleLeftIcon from '@lucide/svelte/icons/toggle-left';
	import ToolsIcon from '@lucide/svelte/icons/wrench';
	import WidgetIcon from '@lucide/svelte/icons/component';
	import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
	import UserScanIcon from '@lucide/svelte/icons/scan-face';

	import * as Sidebar from '$lib/components/shadcn/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import type { SessionUser } from '@repo/db/auth';
	import NavSystem from './nav-system.svelte';
	import NavMain from './nav-main.svelte';
	import NavSecondary from './nav-secondary.svelte';
	import NavUser from './nav-user.svelte';

	const data = {
		navMain: [
			// {
			// 	title: 'Dashboard',
			// 	url: '/',
			// 	icon: DashboardIcon
			// },
			{
				title: 'Users',
				url: '/users',
				icon: ListDetailsIcon
			},
			{
				title: 'Agents',
				url: '/agents',
				icon: UsersIcon
			},
			{
				title: 'Tags',
				url: '/tags',
				icon: TagIcon
			},

			{
				title: 'Pricing',
				url: '/settings/pricing',
				icon: ReportIcon
			},
			{
				title: 'AI Analytics',
				url: '/costing',
				icon: ChartBarIcon
			},
			{
				title: 'Analytics',
				url: '/analytics',
				icon: ChartDonutIcon
			}
		],
		systemConfig: [
			{
				name: 'AI Providers',
				url: '/providers',
				icon: DatabaseIcon
			},
			{
				name: 'AI Models',
				url: '/models',
				icon: DatabaseIcon
			},
			{
				name: 'AI Tools',
				url: '/tools',
				icon: ToolsIcon
			},
			{
				name: 'System Uploads',
				url: '/system-uploads',
				icon: FileUploadIcon
			},
			{
				name: 'Profilers',
				url: '/profilers',
				icon: UserScanIcon
			},
			{
				name: 'Dashboard Templates',
				url: '/dashboard-templates',
				icon: LayoutDashboardIcon
			},
			{
				name: 'Widgets',
				url: '/dashboard-widgets',
				icon: WidgetIcon
			},
			{
				name: 'Analytical Tools',
				url: '/analytical-tools',
				icon: FlaskConicalIcon
			}
		],
		navClouds: [
			{
				title: 'Capture',
				icon: CameraIcon,
				isActive: true,
				url: '#',
				items: [
					{
						title: 'Active Proposals',
						url: '#'
					},
					{
						title: 'Archived',
						url: '#'
					}
				]
			},
			{
				title: 'Proposal',
				icon: FileDescriptionIcon,
				url: '#',
				items: [
					{
						title: 'Active Proposals',
						url: '#'
					},
					{
						title: 'Archived',
						url: '#'
					}
				]
			},
			{
				title: 'Prompts',
				icon: FileAiIcon,
				url: '#',
				items: [
					{
						title: 'Active Proposals',
						url: '#'
					},
					{
						title: 'Archived',
						url: '#'
					}
				]
			}
		],
		navSecondary: [
			{
				title: 'Settings',
				url: '/settings/pricing',
				icon: SettingsIcon
			},
			{
				title: 'Plans',
				url: '/settings/plans',
				icon: SettingsIcon
			},
			{
				title: 'Attributes',
				url: '/settings/attributes',
				icon: SettingsIcon
			},
			{
				title: 'Infra Config',
				url: '/settings/infra',
				icon: SettingsIcon
			},
			{
				title: 'Onboarding Profiles',
				url: '/settings/onboarding/profiles',
				icon: SettingsIcon
			},
			{
				title: 'Feature Flags',
				url: '/settings/feature-flags',
				icon: ToggleLeftIcon
			}
			// {
			// 	title: 'Get Help',
			// 	url: '#',
			// 	icon: HelpIcon
			// },
			// {
			// 	title: 'Search',
			// 	url: '#',
			// 	icon: SearchIcon
			// }
		],
		documents: [
			{
				name: 'Data Library',
				url: '/flow/data-library',
				icon: DatabaseIcon
			},
			{
				name: 'Reports',
				url: '#',
				icon: ReportIcon
			},
			{
				name: 'Word Assistant',
				url: '#',
				icon: FileWordIcon
			}
		]
	};
	const fallbackUser = {
		name: 'Operator',
		email: 'operator@example.com',
		avatar: ''
	};

	let { user, ...restProps }: { user?: SessionUser } & ComponentProps<typeof Sidebar.Root> =
		$props();

	const sidebarUser = $derived(
		user
			? {
					name: user.name || user.email || fallbackUser.name,
					email: user.email || fallbackUser.email,
					avatar: user.image || fallbackUser.avatar
				}
			: fallbackUser
	);
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="data-[slot=sidebar-menu-button]:p-1.5!">
					{#snippet child({ props })}
						<a href="##" {...props}>
							<InnerShadowTopIcon class="size-5!" />
							<span class="text-base font-semibold">QuantPM Admin</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={data.navMain} />
		<NavSystem items={data.systemConfig} />
		<NavSecondary items={data.navSecondary} class="mt-auto" />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser user={sidebarUser} />
	</Sidebar.Footer>
</Sidebar.Root>
