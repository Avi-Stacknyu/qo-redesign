<!-- HoldingsForm — Portfolio holdings input. -->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Loader2 } from '@lucide/svelte';

	interface Holding {
		symbol: string;
		name: string;
		quantity: number;
		avg_cost: number;
		current_price: number;
		asset_class: string;
	}

	let {
		onrun,
		running = false
	}: {
		onrun: (params: {
			holdings: Holding[];
			target_allocation?: Record<string, number>;
			risk_free_rate?: number;
		}) => void;
		running?: boolean;
	} = $props();

	const CLASSES = [
		{ value: 'equity', label: 'Equity' },
		{ value: 'debt', label: 'Debt' },
		{ value: 'gold', label: 'Gold' },
		{ value: 'cash', label: 'Cash' },
		{ value: 'real_estate', label: 'Real Estate' },
		{ value: 'crypto', label: 'Crypto' },
		{ value: 'other', label: 'Other' }
	];

	const BLANK: Holding = {
		symbol: '',
		name: '',
		quantity: 0,
		avg_cost: 0,
		current_price: 0,
		asset_class: 'equity'
	};

	let holdings = $state<Holding[]>([{ ...BLANK }]);
	let showAllocation = $state(false);
	let allocation = $state<Record<string, number>>({ equity: 60, debt: 30, gold: 10 });

	function addRow() {
		holdings.push({ ...BLANK });
	}
	function removeRow(i: number) {
		if (holdings.length > 1) holdings.splice(i, 1);
	}

	function handleSubmit() {
		const valid = holdings.filter((h) => h.symbol && h.quantity > 0);
		if (!valid.length) return;
		onrun({ holdings: valid, target_allocation: showAllocation ? allocation : undefined });
	}

	let validCount = $derived(holdings.filter((h) => h.symbol && h.quantity > 0).length);
</script>

<Card.Root class="rounded-[2rem] border-0 bg-white py-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
	<Card.Header class="border-b border-[#F0F0F0] p-5">
		<Card.Title class="text-xl font-bold text-[#1F1F1F]">Holdings</Card.Title>
		<Card.Description class="text-[#83899F]">Add your investments to analyze.</Card.Description>
	</Card.Header>

	<Card.Content class="space-y-3 p-5">
		{#each holdings as holding, i (i)}
			<div class="space-y-3 rounded-[1.5rem] border border-[#F0F0F0] bg-[#FAFAFA] p-4">
				<div class="grid grid-cols-2 gap-2">
					<div class="space-y-1">
						<Label class="text-[11px] font-semibold text-[#83899F]">Symbol</Label>
						<Input class="h-9 rounded-2xl border-0 bg-white font-mono text-xs uppercase shadow-none" bind:value={holding.symbol} />
					</div>
					<div class="space-y-1">
						<Label class="text-[11px] font-semibold text-[#83899F]">Name</Label>
						<Input class="h-9 rounded-2xl border-0 bg-white text-xs shadow-none" bind:value={holding.name} />
					</div>
				</div>

				<div class="grid grid-cols-3 gap-2">
					<div class="space-y-1">
						<Label class="text-[11px] font-semibold text-[#83899F]">Qty</Label>
						<Input
							class="h-9 rounded-2xl border-0 bg-white text-xs shadow-none tabular-nums"
							type="number"
							min="0"
							bind:value={holding.quantity}
						/>
					</div>
					<div class="space-y-1">
						<Label class="text-[11px] font-semibold text-[#83899F]">Avg Cost</Label>
						<Input
							class="h-9 rounded-2xl border-0 bg-white text-xs shadow-none tabular-nums"
							type="number"
							min="0"
							step="0.01"
							bind:value={holding.avg_cost}
						/>
					</div>
					<div class="space-y-1">
						<Label class="text-[11px] font-semibold text-[#83899F]">CMP</Label>
						<Input
							class="h-9 rounded-2xl border-0 bg-white text-xs shadow-none tabular-nums"
							type="number"
							min="0"
							step="0.01"
							bind:value={holding.current_price}
						/>
					</div>
				</div>

				<div class="flex items-end gap-2">
					<div class="min-w-0 flex-1 space-y-1">
						<Label class="text-[11px] font-semibold text-[#83899F]">Class</Label>
						<Select.Root
							type="single"
							value={holding.asset_class}
							onValueChange={(v) => (holding.asset_class = v)}
						>
							<Select.Trigger class="h-9 w-full rounded-2xl border-0 bg-white text-xs shadow-none">
								{CLASSES.find((c) => c.value === holding.asset_class)?.label ?? 'Select'}
							</Select.Trigger>
							<Select.Content>
								{#each CLASSES as cls (cls.value)}
									<Select.Item value={cls.value}>{cls.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<Button
						variant="ghost"
						size="sm"
						class="h-9 rounded-full px-3 text-xs text-[#83899F] hover:text-destructive"
						disabled={holdings.length <= 1}
						onclick={() => removeRow(i)}
					>
						Remove
					</Button>
				</div>
			</div>
		{/each}

		<button
			class="w-full rounded-full border-2 border-dashed border-[#D8D8D8] py-2.5 text-sm font-medium text-[#83899F] transition-colors hover:border-[#1F1F1F] hover:text-[#1F1F1F]"
			onclick={addRow}
		>
			+ Add holding
		</button>
	</Card.Content>

	<div class="space-y-3 border-t border-[#F0F0F0] p-5 pt-4">
		<label class="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#83899F]">
			<input
				type="checkbox"
				class="size-3.5 rounded border accent-[#1F1F1F]"
				bind:checked={showAllocation}
			/>
			Include target allocation
		</label>

		{#if showAllocation}
			<div class="grid grid-cols-3 gap-2">
				{#each Object.entries(allocation) as [key, val] (key)}
					<div class="space-y-1">
						<Label class="text-[11px] font-semibold text-[#83899F] capitalize">{key} %</Label>
						<Input
							class="h-9 rounded-2xl border-0 bg-[#F6F6F6] text-xs shadow-none tabular-nums"
							type="number"
							min="0"
							max="100"
							value={val}
							oninput={(e) => (allocation[key] = parseFloat(e.currentTarget.value) || 0)}
						/>
					</div>
				{/each}
			</div>
		{/if}

		<Button class="h-12 w-full rounded-full bg-[#1F1F1F] text-base font-semibold text-white shadow-none hover:bg-[#2A2A2A]" onclick={handleSubmit} disabled={running || validCount === 0}>
			{#if running}
				<Loader2 class="mr-2 size-4 animate-spin" />
				Analyzing…
			{:else}
				Run Analysis{validCount > 0 ? ` (${validCount})` : ''}
			{/if}
		</Button>
	</div>
</Card.Root>
