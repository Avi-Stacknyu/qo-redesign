<script lang="ts">
	import { page } from '$app/stores';
	import { cn } from '$lib/utils';
	import { User, Palette, Bot, UserCircle, CreditCard } from '@lucide/svelte';

	let { children } = $props();

	const tabs = [
		{ href: '/preferences/general', label: 'General', icon: User },
		{ href: '/preferences/appearance', label: 'Appearance', icon: Palette },
		{ href: '/preferences/ai', label: 'AI Settings', icon: Bot },
		{ href: '/preferences/profile', label: 'Profile & Memory', icon: UserCircle },
		{ href: '/preferences/billing', label: 'Billing', icon: CreditCard }
	];

	let currentPath = $derived($page.url.pathname);
</script>

<svelte:head>
	<title>Preferences — Quant Orion</title>
</svelte:head>

<div class="relative mx-auto w-full max-w-7xl">
	<div class="mb-6 space-y-1 sm:mb-8">
		<h1 class="text-2xl font-light tracking-tight text-foreground sm:text-3xl lg:text-4xl">
			Preferences
		</h1>
		<p class="text-sm text-muted-foreground">Manage your account, preferences, and AI behavior.</p>
	</div>

	<div class="flex flex-col gap-4 md:flex-row md:gap-8">
		<!-- Sidebar Navigation -->
		<div
			class="w-full overflow-x-auto md:sticky md:top-20 md:w-44 md:shrink-0 md:self-start md:overflow-visible"
		>
			<nav
				class="inline-flex w-max gap-1 pb-2 md:w-full md:flex-col md:gap-0.5 md:border-r md:border-border/30 md:pr-4 md:pb-0"
			>
				{#each tabs as tab (tab.href)}
					{@const isActive = currentPath === tab.href}
					<a
						href={tab.href}
						data-sveltekit-noscroll
						class={cn(
							'group relative flex flex-none items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-all duration-200',
							'text-muted-foreground',
							'hover:bg-accent/50 hover:text-foreground',
							isActive && 'bg-accent text-foreground shadow-sm',
							'md:w-full md:justify-start'
						)}
					>
						<tab.icon
							class={cn(
								'size-3.5 shrink-0 transition-colors duration-200',
								'text-muted-foreground/70 group-hover:text-foreground/80',
								isActive && 'text-primary'
							)}
						/>
						<span>{tab.label}</span>
					</a>
				{/each}
			</nav>
		</div>

		<!-- Content Area -->
		<div class="min-w-0 flex-1">
			{@render children()}
		</div>
	</div>
</div>
