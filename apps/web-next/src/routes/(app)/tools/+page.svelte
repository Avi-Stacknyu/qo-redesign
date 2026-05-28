<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import ToolCard from '$lib/components/tools/ToolCard.svelte';
	import {
		Search,
		Palette,
		SlidersHorizontal,
		Bell,
		ArrowUpDown,
		ListFilter,
		FlaskConical,
		X
	} from '@lucide/svelte';
	import type { AnalyticalToolCatalogItem } from '@repo/shared/types';

	let { data } = $props();

	let search = $state('');
	let selectedCategory = $state<string>('all');
	let filtersOpen = $state(false);
	let sortMode = $state<'default' | 'az'>('default');

	let tools = $derived(data.tools as AnalyticalToolCatalogItem[]);

	let categories = $derived([...new Set(tools.map((t) => t.category).filter(Boolean))]);

	let filtered = $derived.by(() => {
		let result = tools.filter((t) => {
			const matchesSearch =
				!search ||
				t.display_name.toLowerCase().includes(search.toLowerCase()) ||
				t.description.toLowerCase().includes(search.toLowerCase());
			const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
			return matchesSearch && matchesCategory;
		});

		if (sortMode === 'az') {
			result = [...result].sort((a, b) => a.display_name.localeCompare(b.display_name));
		}

		return result;
	});

	let recentTools = $derived(filtered.slice(0, 3));
	let browserTools = $derived(filtered);
</script>

<svelte:head>
	<title>Analytical Tools</title>
</svelte:head>

<div class="relative min-h-[calc(100vh-4rem)] w-full">
	<div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
		<div class="space-y-1">
			<h1 class="font-Inter text-3xl font-normal tracking-tight text-foreground lg:text-3xl">
				Analytical Tools
			</h1>
			<p class="text-sm text-muted-foreground">{filtered.length} available</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<Button
				class="size-11 rounded-full border border-border/50 bg-white shadow-sm transition-all hover:shadow-md sm:size-12"
				variant="secondary"
				onclick={() => (filtersOpen = !filtersOpen)}
				aria-label="Tool filters"
			>
				<SlidersHorizontal class="size-5 text-muted-foreground" />
			</Button>

			<Button
				class="size-11 rounded-full border border-border/50 bg-white shadow-sm transition-all hover:shadow-md sm:size-12"
				variant="secondary"
				aria-label="Notifications"
			>
				<Bell class="size-5 text-muted-foreground" />
			</Button>

			<Button
				class="size-11 rounded-full border border-border/50 bg-white shadow-sm transition-all hover:shadow-md sm:size-12"
				variant="secondary"
				aria-label="Appearance"
			>
				<Palette class="size-5 text-muted-foreground" />
			</Button>

			<Button
				class="size-11 rounded-full border border-border/50 bg-white p-0 shadow-sm transition-all hover:shadow-md sm:size-12"
				variant="secondary"
				aria-label="Account"
			>
				<Avatar.Root class="size-11 sm:size-12">
					<Avatar.Image
						class="size-11 rounded-full object-cover sm:size-12"
						src="https://github.com/shadcn.png"
						alt="Account"
					/>
					<Avatar.Fallback class="size-11 rounded-full sm:size-12">QO</Avatar.Fallback>
				</Avatar.Root>
			</Button>
		</div>
	</div>

	<div class="mb-10 flex flex-col items-center gap-4">
		<div class="relative w-full max-w-5xl">
			<Search class="absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />

			<Input
				type="text"
				placeholder="Search tools..."
				class="h-13 w-full rounded-2xl border border-border/60 bg-white pr-11 pl-13 text-sm shadow-sm transition-all outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 sm:h-14"
				bind:value={search}
			/>

			{#if search}
				<button
					type="button"
					onclick={() => (search = '')}
					class="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
					aria-label="Clear search"
				>
					<X class="size-4" />
				</button>
			{/if}
		</div>

		<div class="flex w-full max-w-5xl flex-wrap items-center justify-end gap-3">
			<Button
				variant="outline"
				class="h-11 rounded-full border-border/60 bg-white px-5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted/40 sm:h-12 sm:text-base"
				onclick={() => (filtersOpen = !filtersOpen)}
			>
				Filter
				<ListFilter class="ml-2 size-4" />
			</Button>

			<Button
				variant="outline"
				class="h-11 rounded-full border-border/60 bg-white px-5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted/40 sm:h-12 sm:text-base"
				onclick={() => (sortMode = sortMode === 'default' ? 'az' : 'default')}
			>
				{sortMode === 'az' ? 'A-Z' : 'Sort'}
				<ArrowUpDown class="ml-2 size-4" />
			</Button>
		</div>

		{#if filtersOpen}
			<div class="flex w-full max-w-5xl flex-wrap justify-end gap-2">
			<Button
				type="button"
				variant={selectedCategory === 'all' ? 'default' : 'outline'}
				class="h-9 rounded-full px-4"
				onclick={() => (selectedCategory = 'all')}
			>
				All
			</Button>
			{#each categories as cat (cat)}
				<Button
					type="button"
					variant={selectedCategory === cat ? 'default' : 'outline'}
					class="h-9 rounded-full bg-white px-4 capitalize"
					onclick={() => (selectedCategory = selectedCategory === cat ? 'all' : cat)}
				>
					{cat}
				</Button>
			{/each}
			</div>
		{/if}
	</div>

	<div class="flex flex-col gap-10">
		{#if filtered.length === 0}
			<div class="flex flex-col items-center justify-center py-20">
				<FlaskConical class="mb-3 size-10 text-muted-foreground/40" />
				<p class="text-lg font-medium text-muted-foreground">No tools found</p>
				<p class="text-sm text-muted-foreground/70">
					{search ? 'Try a different search term' : 'No analytical tools are available yet'}
				</p>
			</div>
		{:else}
			<div class="flex flex-col gap-5">
				<h2 class="font-Inter text-xl text-muted-foreground sm:text-2xl">Recent</h2>

				<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
					{#each recentTools as tool (tool.id)}
						<ToolCard
							title={tool.display_name}
							description={tool.description}
							tag={tool.category}
							icon="/images/tool.svg"
							href={`/tools/${tool.tool_key}`}
						/>
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-5">
				<h2 class="font-Inter text-xl text-muted-foreground sm:text-2xl">Browser</h2>

				<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
					{#each browserTools as tool (tool.id)}
						<ToolCard
							title={tool.display_name}
							description={tool.description}
							tag={tool.category}
							icon="/images/tool.svg"
							href={`/tools/${tool.tool_key}`}
						/>
					{/each}
				</div>
			</div>
		{/if}
		</div>
</div>
