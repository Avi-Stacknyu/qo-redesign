<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Avatar from '$lib/components/ui/avatar';
	import { cn } from '$lib/utils';

	import {
		FileSpreadsheet,
		FileText,
		LayoutGrid,
		PanelLeft,
		PencilRuler,
		Settings
	} from '@lucide/svelte';
	import { goto } from '$app/navigation';

	type PrimaryTab = 'dashboard' | 'files' | 'ruler' | 'file' | null;
	type SecondaryTab = 'settings' | 'sidebar' | 'account' | null;
	type PrimaryNavItem = {
		key: Exclude<PrimaryTab, null>;
		icon: typeof LayoutGrid;
		path: string;
	};
	type SecondaryNavItem = {
		key: Exclude<SecondaryTab, 'account' | null>;
		icon: typeof Settings;
		path: string;
	};

	let { visible = $bindable(true) }: { visible?: boolean } = $props();

	let selectedPrimaryTab = $state<PrimaryTab>('dashboard');
	let selectedSecondaryTab = $state<SecondaryTab>(null);

	const primaryTabs: PrimaryNavItem[] = [
		{
			key: 'dashboard' as const,
			icon: LayoutGrid,
			path: '/'
		},
		{
			key: 'files' as const,
			icon: FileSpreadsheet,
			path: '/knowledge'
		},
		{
			key: 'ruler' as const,
			icon: PencilRuler,
			path: '/tools'
		},
		{
			key: 'file' as const,
			icon: FileText,
			path: '/ai-chat'
		}
	];

	const secondaryTabs: SecondaryNavItem[] = [
		{
			key: 'settings' as const,
			icon: Settings,
			path: '/account'
		},
		{
			key: 'sidebar' as const,
			icon: PanelLeft,
			path: '#'
		}
	];

	const handlePrimaryClick = (item: PrimaryNavItem) => {
		selectedPrimaryTab = item.key;
		selectedSecondaryTab = null;
		visible = true;

		goto(item.path);
	};

	const handleSecondaryClick = (item: SecondaryNavItem) => {
		if (item.key === 'sidebar') {
			selectedSecondaryTab = null;
			visible = false;
			return;
		}

		selectedSecondaryTab = item.key;
		selectedPrimaryTab = null;

		if (item.path !== '#') {
			goto(item.path);
		}
	};
</script>

<main
	class={cn(
		'fixed top-[12.5%] left-4 z-30 flex w-fit flex-col gap-20 transition-all duration-300',
		visible ? 'translate-x-0 opacity-100' : '-translate-x-24 opacity-0 pointer-events-none'
	)}
	aria-hidden={!visible}
>
	<!-- 1st Section -->
	<Card.Root class="w-fit rounded-full p-2 shadow-none">
		<Card.Content class="flex flex-col items-center gap-4 p-2">
			{#each primaryTabs as tab}
				<button
					type="button"
					class={`inline-flex cursor-pointer rounded-full p-2 transition-colors ${
						selectedPrimaryTab === tab.key
							? 'bg-[#904EFF] text-primary-foreground'
							: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
					}`}
					onclick={() => handlePrimaryClick(tab)}
				>
					<tab.icon
						size={25}
						class={selectedPrimaryTab === tab.key ? 'text-primary-foreground' : 'text-current'}
					/>
				</button>
			{/each}
		</Card.Content>
	</Card.Root>

	<!-- 2nd Section -->
	<Card.Root class="w-fit rounded-full p-2 shadow-none">
		<Card.Content class="flex flex-col items-center gap-4 p-2">
			{#each secondaryTabs as tab}
				<button
					type="button"
					class={`inline-flex cursor-pointer rounded-full p-2 transition-colors ${
						selectedSecondaryTab === tab.key
							? 'bg-[#904EFF] text-primary-foreground'
							: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
					}`}
					onclick={() => handleSecondaryClick(tab)}
				>
					<tab.icon
						size={25}
						class={selectedSecondaryTab === tab.key ? 'text-primary-foreground' : 'text-current'}
					/>
				</button>
			{/each}

			<button
				type="button"
				class={`flex items-center justify-center rounded-full border-2 transition-colors cursor-pointer ${
					selectedSecondaryTab === 'account' ? 'border-[#904EFF]' : 'hover:bg-muted'
				}`}
				onclick={() => {
					selectedSecondaryTab = 'account';
					selectedPrimaryTab = null;
					visible = true;
					goto('/account');
				}}
			>
				<Avatar.Root class="flex items-center justify-center">
					<Avatar.Image src="https://github.com/shadcn.png" alt="@shadcn" />
					<Avatar.Fallback>CN</Avatar.Fallback>
				</Avatar.Root>
			</button>
		</Card.Content>
	</Card.Root>
</main>
