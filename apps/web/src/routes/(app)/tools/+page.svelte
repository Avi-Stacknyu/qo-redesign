<script lang="ts">
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Input } from '$lib/components/shadcn/input';
	import {
		Search,
		ShieldCheck,
		Calculator,
		TrendingUp,
		Settings2,
		FlaskConical
	} from '@lucide/svelte';
	import type { AnalyticalToolCatalogItem } from '@repo/shared/types';

	let { data } = $props();

	let search = $state('');
	let selectedCategory = $state<string | null>(null);

	let tools = $derived(data.tools as AnalyticalToolCatalogItem[]);

	let categories = $derived([...new Set(tools.map((t) => t.category).filter(Boolean))]);

	let filtered = $derived(
		tools.filter((t) => {
			const matchesSearch =
				!search ||
				t.display_name.toLowerCase().includes(search.toLowerCase()) ||
				t.description.toLowerCase().includes(search.toLowerCase());
			const matchesCategory = !selectedCategory || t.category === selectedCategory;
			return matchesSearch && matchesCategory;
		})
	);

	const CATEGORY_ICONS: Record<string, typeof ShieldCheck> = {
		analyzer: ShieldCheck,
		calculator: Calculator,
		forecaster: TrendingUp,
		optimizer: Settings2
	};

	function getCategoryIcon(category: string) {
		return CATEGORY_ICONS[category] ?? FlaskConical;
	}
</script>

<div class="relative mx-auto w-full max-w-7xl">
	<div class="mb-8 space-y-1">
		<h1 class="text-3xl font-light tracking-tight text-foreground lg:text-4xl">Analytical Tools</h1>
		<p class="text-sm text-muted-foreground">
			Run analytical tools on your data to get insights, risk metrics, and forecasts.
		</p>
	</div>

	<!-- Filters -->
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<div class="relative max-w-sm flex-1">
			<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input placeholder="Search tools…" class="pl-10" bind:value={search} />
		</div>
		<div class="flex gap-2">
			<button
				type="button"
				class="rounded-full border px-3 py-1 text-sm transition-colors {selectedCategory === null
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-border text-muted-foreground hover:bg-muted'}"
				onclick={() => (selectedCategory = null)}
			>
				All
			</button>
			{#each categories as cat (cat)}
				<button
					type="button"
					class="rounded-full border px-3 py-1 text-sm capitalize transition-colors {selectedCategory ===
					cat
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-border text-muted-foreground hover:bg-muted'}"
					onclick={() => (selectedCategory = selectedCategory === cat ? null : cat)}
				>
					{cat}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tool Cards Grid -->
	{#if filtered.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			<FlaskConical class="mb-3 size-10 text-muted-foreground/40" />
			<p class="text-lg font-medium text-muted-foreground">No tools found</p>
			<p class="text-sm text-muted-foreground/70">
				{search ? 'Try a different search term' : 'No analytical tools are available yet'}
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each filtered as tool (tool.id)}
				{@const Icon = getCategoryIcon(tool.category)}
				<a href="/tools/{tool.tool_key}" class="group">
					<Card.Root
						class="flex h-full flex-col gap-0 overflow-hidden p-0 transition-all group-hover:border-primary/40 group-hover:shadow-md"
					>
						<Card.Header class="flex flex-row items-start gap-3 px-5 pt-5 pb-3">
							<div
								class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
							>
								<Icon class="size-5" />
							</div>
							<div class="min-w-0 flex-1">
								<Card.Title class="text-base leading-tight font-semibold">
									{tool.display_name}
								</Card.Title>
								{#if tool.category}
									<Badge variant="secondary" class="mt-1 capitalize">{tool.category}</Badge>
								{/if}
							</div>
						</Card.Header>
						<Card.Content class="flex-1 px-5 pb-5">
							<p class="line-clamp-3 text-sm text-muted-foreground">
								{tool.description || 'No description available.'}
							</p>
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		</div>
	{/if}
</div>
