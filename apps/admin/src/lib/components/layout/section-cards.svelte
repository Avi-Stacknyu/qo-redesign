<script lang="ts">
	import TrendingDownIcon from '@lucide/svelte/icons/trending-down';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';

	let {
		data = [
			{
				description: 'Total Visitors',
				value: '23.4K',
				change: {
					percentage: '12.5%',
					trend: 'positive',
					note: 'Compared to last month'
				}
			},
			{
				description: 'New Users',
				value: '1.2K',
				change: {
					percentage: '8.3%',
					trend: 'negative',
					note: 'Compared to last month'
				}
			},
			{
				description: 'Sales',
				value: '$15.6K',
				change: {
					percentage: '5.4%',
					trend: 'positive',
					note: 'Compared to last month'
				}
			},
			{
				description: 'Active Subscriptions',
				value: '3.4K',
				change: {
					percentage: '3.1%',
					trend: 'positive',
					note: 'Compared to last month'
				}
			}
		]
	}: {
		data?: {
			description: string;
			value: string;
			change: {
				percentage: string;
				trend: 'positive' | 'negative';
				note: string;
			};
		}[];
	} = $props();
</script>

<div
	class="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card"
>
	{#each data as card}
		<Card.Root class="@container/card">
			<Card.Header>
				<Card.Description>{card.description}</Card.Description>
				<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{card.value}
				</Card.Title>
				<Card.Action>
					<Badge variant="outline">
						{#if card.change.trend === 'negative'}
							-
						{:else}
							+
						{/if}
						{card.change.percentage}
					</Badge>
				</Card.Action>
			</Card.Header>
			<Card.Footer class="flex-col items-start gap-1.5 text-sm">
				<div class="line-clamp-1 flex gap-2 font-medium">
					{card.change.note}
					{#if card.change.trend === 'negative'}
						<TrendingDownIcon class="size-4" />
					{:else}
						<TrendingUpIcon class="size-4" />
					{/if}
				</div>
				<!-- <div class="text-muted-foreground">Visitors for the last 6 months</div> -->
			</Card.Footer>
		</Card.Root>
	{/each}
</div>
