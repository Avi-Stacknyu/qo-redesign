<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Bell, SlidersHorizontal } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Button from './ui/button/button.svelte';
	import * as Avatar from './ui/avatar';

	let {
		pageTitle,
		header,
		headerVerticalAlign = 'end',
		headerTabs,
		headerUtilities,
		profileHref = '/preferences/profile',
		children
	}: {
		pageTitle: string;
		header?: Snippet;
		headerVerticalAlign?: 'end' | 'center';
		headerTabs?: Snippet;
		headerUtilities?: Snippet;
		profileHref?: string;
		children?: Snippet;
	} = $props();

	let currentUser = $derived($page.data.user ?? null);
	let avatarSrc = $derived(currentUser?.avatar ?? '');
	let avatarAlt = $derived(currentUser?.name ?? currentUser?.email ?? 'User avatar');
	let avatarFallback = $derived(
		(currentUser?.name ?? currentUser?.email ?? 'User')
			.split(/\s+/)
			.map((part: string) => part[0] ?? '')
			.join('')
			.toUpperCase()
			.slice(0, 2) || 'U'
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="relative min-h-[calc(100vh-4rem)] w-full">
	<!-- Header -->
	<div
		class={`mb-10 flex flex-col justify-between gap-5 md:flex-row md:gap-6 ${headerVerticalAlign === 'center' ? 'md:items-center' : 'md:items-end'}`}
	>
		{#if header}
			<div class="min-w-0 flex-1">
				{@render header()}
			</div>
		{/if}

		{#if headerTabs}
			{@render headerTabs()}
		{/if}

		{#if headerUtilities}
			{@render headerUtilities()}
		{/if}

		<div class="flex items-center gap-2.5 md:ml-6">
			<Button class="size-12 rounded-full bg-white/90 shadow-sm ring-1 ring-border/20 backdrop-blur-sm" variant="secondary">
				<SlidersHorizontal class="size-5" />
			</Button>

			<Button class="size-12 rounded-full bg-white/90 shadow-sm ring-1 ring-border/20 backdrop-blur-sm" variant="secondary">
				<Bell class="size-5" />
			</Button>

			<Button
				class="size-12 cursor-pointer rounded-full bg-white/90 p-0 shadow-sm ring-1 ring-border/20 backdrop-blur-sm"
				variant="secondary"
				onclick={() => goto(profileHref)}
			>
				<Avatar.Root class="size-12">
					{#if avatarSrc}
						<Avatar.Image class="size-12 rounded-full object-cover" src={avatarSrc} alt={avatarAlt} />
					{/if}
					<Avatar.Fallback class="size-12 rounded-full">{avatarFallback}</Avatar.Fallback>
				</Avatar.Root>
			</Button>
		</div>
	</div>

	{#if children}
		{@render children()}
	{/if}
</div>
