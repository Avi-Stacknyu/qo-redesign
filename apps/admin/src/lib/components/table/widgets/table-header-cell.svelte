<script lang="ts">
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
	import { cn } from '$lib/utils.js';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import type { Column } from '@tanstack/table-core';
	import type { HTMLAttributes } from 'svelte/elements';
	let {
		column,
		title,
		class: className,
		...restProps
	}: { column: Column<any>; title: string } & HTMLAttributes<HTMLDivElement> = $props();
</script>

{#if !column?.getCanSort()}
	<div class={className} {...restProps}>
		{title}
	</div>
{:else}
	<div class={cn('flex items-center', className)} {...restProps}>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="sm"
						class="-ml-3 h-8 data-[state=open]:bg-accent"
					>
						<span>
							{title}
						</span>
						{#if column.getIsSorted() === 'desc'}
							<ArrowDownIcon />
						{:else if column.getIsSorted() === 'asc'}
							<ArrowUpIcon />
						{:else}
							<ChevronsUpDownIcon />
						{/if}
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="start">
				<DropdownMenu.Item onclick={() => column.toggleSorting(false)}>
					<ArrowUpIcon class="mr-2 size-3.5 text-muted-foreground/70" />
					Asc
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => column.toggleSorting(true)}>
					<ArrowDownIcon class="mr-2 size-3.5 text-muted-foreground/70" />
					Desc
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onclick={() => column.toggleVisibility(false)}>
					<EyeOffIcon class="mr-2 size-3.5 text-muted-foreground/70" />
					Hide
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
{/if}
