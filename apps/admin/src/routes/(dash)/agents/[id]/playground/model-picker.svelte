<script lang="ts">
	import * as Popover from '$lib/components/shadcn/popover/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { cn } from '$lib/utils';
	import {
		Check,
		ChevronDown,
		Sparkles,
		Brain,
		Globe,
		Zap,
		Cloud,
		Cpu,
		Star
	} from '@lucide/svelte';
	import type { ModelWithProvider } from '$lib/remote/agent.remote';
	import type { Component } from 'svelte';

	interface Props {
		models: ModelWithProvider[];
		selectedModelId?: string | null;
		onModelChange?: (modelId: string | null) => void;
	}

	let { models, selectedModelId = null, onModelChange }: Props = $props();

	let popoverOpen = $state(false);

	const selectedModel = $derived(models.find((m) => m.id === selectedModelId) ?? null);
	const systemDefault = $derived(models.find((m) => m.isSystemDefault) ?? null);

	/** Provider visual identity — icon + accent color. */
	const PROVIDERS: Record<string, { icon: Component; accent: string; bg: string }> = {
		openai: { icon: Sparkles, accent: 'text-emerald-500', bg: 'bg-emerald-500/10' },
		anthropic: { icon: Brain, accent: 'text-amber-500', bg: 'bg-amber-500/10' },
		google: { icon: Globe, accent: 'text-blue-500', bg: 'bg-blue-500/10' },
		xai: { icon: Zap, accent: 'text-zinc-400', bg: 'bg-zinc-400/10' },
		cloudflare: { icon: Cloud, accent: 'text-orange-500', bg: 'bg-orange-500/10' }
	};
	const DEFAULT_PROVIDER = { icon: Cpu, accent: 'text-muted-foreground', bg: 'bg-muted/50' };

	function provider(key: string) {
		return PROVIDERS[key] ?? DEFAULT_PROVIDER;
	}

	function formatContext(tokens?: string | null): string | null {
		if (!tokens) return null;
		const n = Number(tokens);
		return n >= 1_000_000
			? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
			: `${Math.round(n / 1000)}K`;
	}

	/** Models grouped by provider, sorted alphabetically. */
	const groupedModels = $derived.by(() => {
		const groups = new Map<
			string,
			{ providerName: string; key: string; models: ModelWithProvider[] }
		>();
		for (const m of models) {
			const providerKey = m.expand?.provider?.providerKey ?? 'unknown';
			const providerName = m.expand?.provider?.displayName ?? providerKey;
			const existing = groups.get(providerKey);
			if (existing) existing.models.push(m);
			else groups.set(providerKey, { providerName, key: providerKey, models: [m] });
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	function handleSelect(modelId: string | null) {
		onModelChange?.(modelId);
		popoverOpen = false;
	}

	const triggerLabel = $derived(selectedModel ? selectedModel.displayName : 'Auto');

	const triggerProvider = $derived(
		selectedModel ? provider(selectedModel.expand?.provider?.providerKey ?? '') : DEFAULT_PROVIDER
	);
</script>

<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				variant="ghost"
				size="sm"
				class={cn(
					'flex items-center gap-1.5 rounded-md border border-border/50 px-2.5 py-1 text-xs font-medium',
					'bg-background/60 transition-all duration-200',
					'hover:border-border hover:bg-accent/40',
					popoverOpen && 'border-primary/40 bg-accent/30'
				)}
				{...props}
			>
				<triggerProvider.icon class={cn('size-3', triggerProvider.accent)} />
				<span class="max-w-24 truncate text-foreground/80">{triggerLabel}</span>
				{#if !selectedModel && systemDefault}
					<span class="hidden text-[10px] text-muted-foreground sm:inline">
						({systemDefault.displayName})
					</span>
				{/if}
				<ChevronDown
					class={cn(
						'size-3 text-muted-foreground/50 transition-transform duration-200',
						popoverOpen && 'rotate-180'
					)}
				/>
			</Button>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content
		align="start"
		sideOffset={8}
		class={cn(
			'z-50 flex max-h-[min(65vh,26rem)] w-72 flex-col overflow-hidden',
			'rounded-lg border border-border/50 bg-popover/95 shadow-xl backdrop-blur-lg'
		)}
	>
		<!-- Header -->
		<div class="border-b border-border/30 px-3.5 pt-3 pb-2.5">
			<p class="text-[11px] font-medium tracking-wide text-muted-foreground/70">Override Model</p>
		</div>

		<!-- Default / Auto option -->
		<div class="px-1.5 pt-1.5">
			<button
				type="button"
				onclick={() => handleSelect(null)}
				class={cn(
					'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-150',
					'hover:bg-accent/50',
					!selectedModelId && 'bg-primary/8 ring-1 ring-primary/15'
				)}
			>
				<div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
					<Sparkles class="size-3.5 text-primary" />
				</div>
				<div class="flex flex-1 flex-col">
					<span
						class={cn(
							'text-[13px] font-medium',
							!selectedModelId ? 'text-primary' : 'text-foreground'
						)}
					>
						Auto (Flow Config)
					</span>
					{#if systemDefault}
						<span class="text-[10px] leading-tight text-muted-foreground">
							Default: {systemDefault.displayName}
						</span>
					{/if}
				</div>
				{#if !selectedModelId}
					<Check class="size-3.5 shrink-0 text-primary" />
				{/if}
			</button>
		</div>

		<div class="mx-3 my-1 h-px bg-border/30"></div>

		<!-- Grouped models list -->
		<div class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5 [scrollbar-width:thin]">
			{#each groupedModels as [, group], gi (group.key)}
				{@const prov = provider(group.key)}
				{#if gi > 0}
					<div class="mx-2 my-1 h-px bg-border/20"></div>
				{/if}
				<div class="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
					<prov.icon class={cn('size-3', prov.accent)} />
					<span class="text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
						{group.providerName}
					</span>
				</div>
				{#each group.models as model (model.id)}
					{@const isSelected = model.id === selectedModelId}
					{@const ctx = formatContext(model.contextWindow)}
					<button
						type="button"
						onclick={() => handleSelect(model.id)}
						class={cn(
							'group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all duration-150',
							'hover:bg-accent/50',
							isSelected && 'bg-primary/8 ring-1 ring-primary/15'
						)}
					>
						<span
							class={cn(
								'flex-1 truncate text-[13px]',
								isSelected ? 'font-medium text-primary' : 'text-foreground/85'
							)}
						>
							{model.displayName}
						</span>
						{#if model.isSystemDefault}
							<Star class="size-3 shrink-0 text-amber-500" />
						{/if}
						{#if ctx}
							<span
								class="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
							>
								{ctx}
							</span>
						{/if}
						{#if isSelected}
							<Check class="size-3.5 shrink-0 text-primary" />
						{/if}
					</button>
				{/each}
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
