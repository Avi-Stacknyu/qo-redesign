<script lang="ts">
	import { SpendAreaChart, StatCard } from '$lib/components/analytics';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Dialog from '$lib/components/shadcn/dialog/index.js';
	import { type ModelDrilldownDto } from '$lib/types/analytics-charts';

	type Props = {
		open: boolean;
		model: string | null;
		data: ModelDrilldownDto | null;
		pending?: boolean;
		errorMessage?: string | null;
		selectedLabel: string;
		onclose?: () => void;
	};

	let {
		open,
		model,
		data,
		pending = false,
		errorMessage = null,
		selectedLabel,
		onclose
	}: Props = $props();

	function formatUsd(value: number) {
		return value.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 4
		});
	}

	function formatCompact(value: number) {
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
		return value.toLocaleString('en-US');
	}
</script>

<Dialog.Root {open} onOpenChange={(nextOpen) => !nextOpen && onclose?.()}>
	<Dialog.Content class="max-h-[85vh] max-w-3xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title class="font-mono text-lg">{model ?? 'Model drilldown'}</Dialog.Title>
			<Dialog.Description>
				{#if data}
					Provider: <Badge variant="secondary">{data.provider}</Badge> — {selectedLabel}
				{:else if errorMessage}
					Unable to load drilldown.
				{:else}
					Loading drilldown…
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if pending}
			<div class="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>
		{:else if errorMessage}
			<div class="py-12 text-center text-sm text-destructive">{errorMessage}</div>
		{:else if data}
			<div class="mt-4 grid gap-3 sm:grid-cols-4">
				<StatCard title="Total Spend" value={formatUsd(data.totals.costUsd)} />
				<StatCard title="Total Tokens" value={formatCompact(data.totals.tokens)} />
				<StatCard title="Requests" value={formatCompact(data.totals.requestCount)} />
				<StatCard title="Avg $/Request" value={formatUsd(data.totals.avgCostPerRequest)} />
			</div>

			<div class="mt-4">
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Daily Spend</Card.Title>
					</Card.Header>
					<Card.Content>
						<SpendAreaChart data={data.spendTimeline} height="h-52" gradientId="fillDrilldown" />
					</Card.Content>
				</Card.Root>
			</div>
		{:else}
			<div class="py-12 text-center text-sm text-muted-foreground">
				No model drilldown data available.
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
