<script lang="ts">
	import Appearance from '$lib/components/account/Appearance.svelte';
	import CustomSelect from '$lib/components/account/CustomSelect.svelte';
	import AgentTab from '$lib/components/account/AgentTab.svelte';
	import BillingTabContent from '$lib/components/account/BillingTab.svelte';
	import MemoryTab from '$lib/components/account/memory/MemoryTab.svelte';
	import CategoryTabs from '$lib/components/CategoryTabs.svelte';
	import Search2 from '$lib/components/Search2.svelte';
	import Shell from '$lib/components/Shell.svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import type { AppLayoutState, HeaderCategoryTabsProps } from '$lib/constants/data';
	import { PaintRoller, Sparkles, SquareChartGantt, User, Waypoints } from '@lucide/svelte';
	import { getContext } from 'svelte';

	const appLayoutState = getContext<AppLayoutState>('app-layout');

	const tabs = $state<HeaderCategoryTabsProps[]>([
		{
			label: 'General',
			value: 'general',
			icon: User,
			variant: 'secondary'
		},
		{
			label: 'Appearance',
			value: 'appearance',
			icon: PaintRoller,
			variant: 'secondary'
		},
		{
			label: 'Billing & Plans',
			value: 'billing',
			icon: SquareChartGantt,
			variant: 'secondary'
		},
		{
			label: 'Agent',
			value: 'agent',
			icon: Sparkles,
			variant: 'secondary'
		},
		{
			label: 'Memory',
			value: 'memory',
			icon: Waypoints,
			variant: 'secondary'
		}
	]);

	let activeTab = $state(tabs[0]?.value ?? 'general');
	let selectedAppearanceGroup = $state<'base' | 'premium' | 'brand'>('base');
	let selectedColorMode = $state<'light' | 'dark' | 'system'>('dark');

	const appearanceGroupOptions = [
		{ value: 'base', label: 'Base' },
		{ value: 'premium', label: 'Premium' },
		{ value: 'brand', label: 'Brand' }
	] as const;

	const modeOptions = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System' }
	] as const;
</script>

<Shell pageTitle="Account">
	{#snippet header()}
		<Search2 />
	{/snippet}

	<!-- sidebar transition div -->
	<div
		class={`transition-[margin] duration-300 ${
			appLayoutState.sidebarVisible ? 'ml-0' : '-ml-16 sm:-ml-18 lg:-ml-22'
		}`}
	>
		<CategoryTabs {tabs} bind:activeTab />

		<!-- main content -->
		<div class="mt-8">
			{#if activeTab === 'general'}
				<div class="flex flex-col gap-5">
					<div class="flex flex-col gap-20">
						<section class="flex flex-col gap-1">
							<h1 class="font-Inter text-3xl font-medium text-primary">Profile Information</h1>
							<p class="text-muted-foreground">Your personal details and public identity.</p>
						</section>
						<!-- Avatar -->
						<section class="flex w-full justify-between">
							<!-- avatar + name + email -->
							<div class="flex gap-5">
								<Button class="rounded-full bg-white p-0 shadow-sm" variant="secondary">
									<Avatar.Root class="size-25">
										<Avatar.Image
											class=" rounded-full object-cover"
											src="https://github.com/shadcn.png"
											alt="@shadcn"
										/>
										<Avatar.Fallback class="rounded-full">CN</Avatar.Fallback>
									</Avatar.Root>
								</Button>
								<div>
									<h3 class="font-Inter text-xl font-medium text-primary">Alexa Alexa</h3>
									<p class="text-muted-foreground">alexarawles@gmail.com</p>
								</div>
							</div>

							<!-- buttons (save & cancel) -->
							<div class="flex gap-3">
								<Button variant="custom">Save</Button>
								<Button variant="customSecondary">Cancel</Button>
							</div>
						</section>

						<!-- Full Name + Email -->
						<section class="flex gap-15">
							<!-- full name -->
							<div class="flex w-full flex-col gap-2">
								<Label
									for="full-name"
									class="font-Inter text-sm text-primary dark:text-neutral-200"
								>
									Full Name
								</Label>

								<Input
									id="full-name"
									placeholder="Your First Name"
									class="h-12 rounded-xl border-0 bg-white px-4 text-sm shadow-none ring-0 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-300 dark:bg-neutral-900"
								/>
							</div>
							<!-- Email -->
							<div class="flex w-full flex-col gap-2">
								<Label class="font-Inter text-sm text-primary dark:text-neutral-200">Email</Label>

								<Input
									placeholder="Your Email"
									class="h-12 rounded-xl border-0 bg-white px-4 text-sm shadow-none ring-0 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-300 dark:bg-neutral-900"
								/>
							</div>
						</section>
					</div>

					<!-- appereance -->
					<div class="flex flex-col gap-10">
						<section class="flex flex-col gap-1">
							<h1 class="font-Inter text-3xl font-medium text-primary">Appearance</h1>
							<p class="text-muted-foreground">Change the appearance of your interface</p>
						</section>

						<section class="flex flex-col gap-5">
							<img
								src="/images/rainbow.png"
								alt="Rainbow Img"
								class="max-h-60 w-full rounded-2xl object-cover"
							/>

							<!-- mode section -->
							<div class="flex items-center justify-between">
								<div class="flex flex-col gap-1">
									<h2 class="text-2xl font-medium text-primary">Choose the mode</h2>
									<p class="text-muted-foreground">Change the appearance of your interface</p>
								</div>

								<!-- selector -->
								<CustomSelect
									bind:value={selectedColorMode}
									options={modeOptions}
									placeholder="Choose Mode"
								/>
							</div>
						</section>

						<section class="flex flex-col gap-3">
							<div class="flex items-center justify-between">
								<h2 class="text-2xl font-medium text-primary">Accent Colors</h2>

								<!-- selector -->
								<CustomSelect
									bind:value={selectedAppearanceGroup}
									options={appearanceGroupOptions}
									placeholder="Base"
								/>
							</div>

							<Appearance selectedMode={selectedAppearanceGroup} />
						</section>
					</div>
				</div>
			{:else if activeTab === 'billing'}
				<BillingTabContent />
			{:else if activeTab === 'agent'}
				<AgentTab />
			{:else if activeTab === 'memory'}
				<MemoryTab />
			{/if}
		</div>
	</div>

	
</Shell
>
