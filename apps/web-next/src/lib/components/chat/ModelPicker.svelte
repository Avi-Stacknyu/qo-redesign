<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Popover from '$lib/components/shadcn/popover/index.js';
	import * as Tooltip from '$lib/components/shadcn/tooltip/index.js';
	import type { AvailableModel } from '$lib/remote/models.remote';
	import { cn } from '$lib/utils';
	import { ArrowUpRight, Check, ChevronDown, Lock, Star } from '@lucide/svelte';
	import type { PinnedModelInfo } from '@repo/shared/utils';

	let {
		models,
		selectedModelId = null,
		onModelChange,
		allowedModelIds = null,
		pinnedModelInfo = null
	}: {
		models: AvailableModel[];
		selectedModelId?: string | null;
		onModelChange?: (modelId: string | null) => void;
		allowedModelIds?: string[] | null;
		pinnedModelInfo?: PinnedModelInfo | null;
	} = $props();

	let popoverOpen = $state(false);

	const allowedSet = $derived(allowedModelIds?.length ? new Set(allowedModelIds) : null);

	function isRestricted(modelId: string): boolean {
		return allowedSet !== null && !allowedSet.has(modelId);
	}

	const selectedModel = $derived(models.find((m) => m.id === selectedModelId) ?? null);
	const systemDefault = $derived(models.find((m) => m.is_system_default) ?? null);

	/** Provider accent dot color. */
	const PROVIDER_COLORS: Record<string, string> = {
		openai: 'bg-emerald-500',
		anthropic: 'bg-amber-500',
		google: 'bg-blue-500',
		xai: 'bg-zinc-400',
		cloudflare: 'bg-orange-500'
	};

	function providerColor(key: string): string {
		return PROVIDER_COLORS[key] ?? 'bg-muted-foreground';
	}

	function formatContext(tokens?: number): string | null {
		if (!tokens) return null;
		return tokens >= 1_000_000
			? `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
			: `${Math.round(tokens / 1000)}K`;
	}

	const groupedModels = $derived.by(() => {
		const groups: Array<{ providerName: string; key: string; models: AvailableModel[] }> = [];
		for (const m of models) {
			const existing = groups.find((group) => group.key === m.provider_key);
			if (existing) existing.models.push(m);
			else
				groups.push({
					providerName: m.provider_name,
					key: m.provider_key,
					models: [m]
				});
		}
		return groups.sort((a, b) => a.key.localeCompare(b.key));
	});

	function handleSelect(modelId: string | null) {
		onModelChange?.(modelId);
		popoverOpen = false;
	}

	const triggerLabel = $derived(selectedModel ? selectedModel.display_name : 'Auto');
	const triggerDotColor = $derived(
		selectedModel ? providerColor(selectedModel.provider_key) : 'bg-primary'
	);
</script>

{#if pinnedModelInfo}
	<Tooltip.Provider delayDuration={0}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<div
					class="flex h-8 items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 text-sm font-medium text-amber-700 shadow-sm backdrop-blur-md dark:text-amber-300"
				>
					<Lock class="size-3.5 shrink-0" />
					<span class="max-w-36 truncate sm:max-w-none">{pinnedModelInfo.label}</span>
				</div>
			</Tooltip.Trigger>
			<Tooltip.Content side="top" class="max-w-64 text-xs leading-relaxed">
				{pinnedModelInfo.message}
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{:else}
	<Popover.Root bind:open={popoverOpen}>
		<Popover.Trigger
			class={cn(
				'group flex h-8 items-center gap-1.5 rounded-full border border-border/50 bg-background/80 px-3 text-sm font-medium shadow-sm backdrop-blur-md transition-all',
				'hover:border-primary/40 hover:bg-card/90 hover:shadow-md',
				popoverOpen && 'border-primary/40 bg-card/90'
			)}
		>
			<span class={cn('size-1.5 shrink-0 rounded-full', triggerDotColor)}></span>
			<span class="max-w-28 truncate text-foreground/80 sm:max-w-none">{triggerLabel}</span>
			<ChevronDown
				class={cn(
					'size-3 text-muted-foreground/50 transition-transform duration-200',
					popoverOpen && 'rotate-180'
				)}
			/>
		</Popover.Trigger>

		<Popover.Content
			align="start"
			sideOffset={8}
			class="z-50 flex max-h-[min(60vh,24rem)] w-64 flex-col rounded-xl border border-border/60 bg-card/95 p-2 shadow-lg backdrop-blur sm:w-72"
		>
			<button
				type="button"
				onclick={() => handleSelect(null)}
				class={cn(
					'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-muted/50',
					!selectedModelId && 'bg-primary/10'
				)}
			>
				<span class="size-1.5 shrink-0 rounded-full bg-primary"></span>
				<span class="flex-1 text-sm text-foreground">Auto</span>
				{#if systemDefault}
					<span class="text-[10px] text-muted-foreground">{systemDefault.display_name}</span>
				{/if}
				{#if !selectedModelId}
					<Check class="size-3.5 shrink-0 text-primary" />
				{/if}
			</button>

			<div class="mx-2 my-1.5 border-t border-border/40"></div>

			<div class="flex min-h-0 flex-col gap-0.5 overflow-y-auto [scrollbar-width:thin]">
				{#each groupedModels as group, gi (group.key)}
					{#if gi > 0}
						<div class="mx-2 my-1 border-t border-border/30"></div>
					{/if}
					<p
						class="flex items-center gap-1.5 px-2 pt-1 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase"
					>
						<span class={cn('size-1.5 rounded-full', providerColor(group.key))}></span>
						{group.providerName}
					</p>
					{#each group.models as model (model.id)}
						{@const isSelected = model.id === selectedModelId}
						{@const ctx = formatContext(model.context_window)}
						{@const locked = isRestricted(model.id)}
						{#if locked}
							<Tooltip.Provider delayDuration={0}>
								<Tooltip.Root>
									<Tooltip.Trigger class="w-full">
										<a
											href={resolve('/preferences/billing')}
											class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left opacity-50 transition-all hover:bg-amber-500/5 hover:opacity-70"
										>
											<span class="flex-1 truncate text-sm text-muted-foreground">
												{model.display_name}
											</span>
											<Lock class="size-3 shrink-0 text-amber-500/70" />
										</a>
									</Tooltip.Trigger>
									<Tooltip.Content side="right" class="flex items-center gap-1.5 text-xs">
										<ArrowUpRight class="size-3 text-amber-500" />
										Upgrade your plan to unlock
									</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
						{:else}
							<button
								type="button"
								onclick={() => handleSelect(model.id)}
								class={cn(
									'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all hover:bg-muted/50',
									isSelected && 'bg-primary/10'
								)}
							>
								<span
									class={cn(
										'flex-1 truncate text-sm',
										isSelected ? 'font-medium text-foreground' : 'text-foreground/85'
									)}
								>
									{model.display_name}
								</span>
								{#if model.is_system_default}
									<Star class="size-3 shrink-0 fill-amber-400 text-amber-400" />
								{/if}
								{#if ctx}
									<span class="shrink-0 text-[10px] text-muted-foreground/50 tabular-nums"
										>{ctx}</span
									>
								{/if}
								{#if isSelected}
									<Check class="size-3.5 shrink-0 text-primary" />
								{/if}
							</button>
						{/if}
					{/each}
				{/each}
			</div>
		</Popover.Content>
	</Popover.Root>
{/if}
