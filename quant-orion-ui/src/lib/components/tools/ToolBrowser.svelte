<script lang="ts">
	import { ArrowUpDown, ListFilter } from '@lucide/svelte';

	import Search2 from '$lib/components/Search2.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import ToolCard from './ToolCard.svelte';

	type ToolItem = {
		title: string;
		tag: string;
		description: string;
		icon: string;
	};

	const recentTools: ToolItem[] = [
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

	const browserTools: ToolItem[] = [
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

<div class="mb-10 flex flex-col items-center gap-4">
	<Search2 />

	<div class="flex w-full max-w-5xl flex-wrap items-center justify-end gap-3">
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
		<h2 class="font-Inter text-xl text-muted-foreground sm:text-2xl">Recent</h2>

		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each recentTools as tool (tool.title)}
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
		<h2 class="font-Inter text-xl text-muted-foreground sm:text-2xl">Browser</h2>

		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each browserTools as tool (tool.title)}
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
