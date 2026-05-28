<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Palette,
		SlidersHorizontal,
		Bell,
		Search,
		ArrowUpDown,
		ListFilter
	} from '@lucide/svelte';

	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import Input from '../ui/input/input.svelte';
	import ToolCard from './ToolCard.svelte';

	let {
		pageTitle,
		header
	}: {
		pageTitle: string;
		header: any;
	} = $props();

	const recentTools = [
		{
			title: 'Portfolio Risk Analyzer',
			tag: 'Analyzer',
			description: 'Try a cleaner dashboard layout with fewer.',
			icon: '/images/tool.svg'
		},
		{
			title: 'Finance Tracker',
			tag: 'Finance',
			description: 'Track all investment metrics in one place.',
			icon: '/images/tool.svg'
		},
		{
			title: 'Market Insights',
			tag: 'Insights',
			description: 'Monitor financial patterns and trends instantly.',
			icon: '/images/tool.svg'
		}
	];

	const browserTools = [
		{
			title: 'Portfolio Risk Analyzer',
			tag: 'Analyzer',
			description: 'Try a cleaner dashboard layout with fewer.',
			icon: '/images/tool.svg'
		},
		{
			title: 'Finance Tracker',
			tag: 'Finance',
			description: 'Track all investment metrics in one place.',
			icon: '/images/tool.svg'
		},
		{
			title: 'Market Insights',
			tag: 'Insights',
			description: 'Monitor financial patterns and trends instantly.',
			icon: '/images/tool.svg'
		},
		{
			title: 'Revenue Planner',
			tag: 'Planning',
			description: 'Forecast future revenue and expenses easily.',
			icon: '/images/tool.svg'
		},
		{
			title: 'Task Organizer',
			tag: 'Productivity',
			description: 'Organize workstreams and daily priorities fast.',
			icon: '/images/tool.svg'
		},
		{
			title: 'Growth Dashboard',
			tag: 'Analytics',
			description: 'Visualize performance metrics in real time.',
			icon: '/images/tool.svg'
		}
	];
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="relative w-full min-h-[calc(100vh-4rem)]">
	<div
		class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex-1">
			{@render header()}
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<Button
				class="size-11 rounded-full border border-border/50 bg-white shadow-sm transition-all hover:shadow-md sm:size-12"
				variant="secondary"
			>
				<SlidersHorizontal class="size-5 text-muted-foreground" />
			</Button>

			<Button
				class="size-11 rounded-full border border-border/50 bg-white shadow-sm transition-all hover:shadow-md sm:size-12"
				variant="secondary"
			>
				<Bell class="size-5 text-muted-foreground" />
			</Button>

			<Button
				class="size-11 rounded-full border border-border/50 bg-white shadow-sm transition-all hover:shadow-md sm:size-12"
				variant="secondary"
			>
				<Palette class="size-5 text-muted-foreground" />
			</Button>

			<Button
				class="size-11 rounded-full border border-border/50 bg-white p-0 shadow-sm transition-all hover:shadow-md sm:size-12"
				variant="secondary"
			>
				<Avatar.Root class="size-11 sm:size-12">
					<Avatar.Image
						class="size-11 rounded-full object-cover sm:size-12"
						src="https://github.com/shadcn.png"
						alt="@shadcn"
					/>
					<Avatar.Fallback class="size-11 rounded-full sm:size-12">
						CN
					</Avatar.Fallback>
				</Avatar.Root>
			</Button>
		</div>
	</div>

	<div class="mb-10 flex flex-col items-center gap-4">
		<div class="relative w-full max-w-5xl">
			<Search
				class="absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground"
			/>

			<Input
				type="text"
				placeholder="Search tools..."
				class="h-13 w-full rounded-2xl border border-border/60 bg-white pr-5 pl-13 text-sm shadow-sm transition-all outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 sm:h-14"
			/>
		</div>

		<div
			class="flex w-full max-w-5xl flex-wrap items-center justify-end gap-3"
		>
			<Button
				variant="outline"
				class="h-11 rounded-full border-border/60 bg-white px-5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted/40 sm:h-12 sm:text-base"
			>
				Filter
				<ListFilter class="ml-2 size-4" />
			</Button>

			<Button
				variant="outline"
				class="h-11 rounded-full border-border/60 bg-white px-5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted/40 sm:h-12 sm:text-base"
			>
				Sort
				<ArrowUpDown class="ml-2 size-4" />
			</Button>
		</div>
	</div>

	<div class="flex flex-col gap-10">
		<div class="flex flex-col gap-5">
			<h2 class="font-Inter text-xl text-muted-foreground sm:text-2xl">
				Recent
			</h2>

			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
				{#each recentTools as tool}
					<ToolCard
						title={tool.title}
						description={tool.description}
						tag={tool.tag}
						icon={tool.icon}
					/>
				{/each}
			</div>
		</div>

		<div class="flex flex-col gap-5">
			<h2 class="font-Inter text-xl text-muted-foreground sm:text-2xl">
				Browser
			</h2>

			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
				{#each browserTools as tool}
					<ToolCard
						title={tool.title}
						description={tool.description}
						tag={tool.tag}
						icon={tool.icon}
					/>
				{/each}
			</div>
		</div>
	</div>
</div>