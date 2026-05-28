<script lang="ts">
	import { Bell, SlidersHorizontal } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Button from './ui/button/button.svelte';
	import * as Avatar from './ui/avatar';
	import { goto } from '$app/navigation';

	let {
		pageTitle,
		header,
		headerVerticalAlign = 'end',
		headerTabs,
		headerUtilities,
		children
	}: {
		pageTitle: string;
		header?: Snippet;
		headerVerticalAlign?: 'end' | 'center';
		headerTabs?: Snippet;
		headerUtilities?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="relative min-h-[calc(100vh-4rem)] w-full">
	<!-- Header -->
	<div
		class={`mb-8 flex flex-col justify-between gap-4 md:flex-row ${headerVerticalAlign === 'center' ? 'md:items-center' : 'md:items-end'}`}
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

		<div class="flex items-center gap-2 md:ml-6">
			<Button class="size-12 rounded-full bg-white shadow-sm" variant="secondary">
				<SlidersHorizontal class="size-5" />
			</Button>

			<Button class="size-12 rounded-full bg-white shadow-sm" variant="secondary">
				<Bell class="size-5" />
			</Button>

			<Button class="size-12 rounded-full bg-white p-0 shadow-sm cursor-pointer" variant="secondary" onclick={() => goto("/account")}>
				<Avatar.Root class="size-12">
					<Avatar.Image
						class="size-12 rounded-full object-cover"
						src="https://github.com/shadcn.png"
						alt="@shadcn"
					/>
					<Avatar.Fallback class="size-12 rounded-full">CN</Avatar.Fallback>
				</Avatar.Root>
			</Button>
		</div>
	</div>

	{#if children}
		{@render children()}
	{/if}
</div>
