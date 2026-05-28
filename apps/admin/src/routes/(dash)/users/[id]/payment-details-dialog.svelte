<script lang="ts">
	import * as Dialog from '$lib/components/shadcn/dialog';
	import { Button } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Separator } from '$lib/components/shadcn/separator';
	import type { PlanPaymentTransactionRow } from '@repo/db/types';

	let { open = $bindable(false), payment } = $props<{
		open: boolean;
		payment: PlanPaymentTransactionRow | null;
	}>();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-125">
		<Dialog.Header>
			<Dialog.Title>Payment Details</Dialog.Title>
			<Dialog.Description>Detailed information about this payment transaction.</Dialog.Description>
		</Dialog.Header>

		{#if payment}
			<div class="grid gap-4 py-4">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-muted-foreground">Status</span>
					<Badge
						variant={payment.status === 'completed'
							? 'default'
							: payment.status === 'failed'
								? 'destructive'
								: 'secondary'}
						class="capitalize"
					>
						{payment.status}
					</Badge>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1">
						<span class="text-xs text-muted-foreground">Amount</span>
						<div class="font-mono text-lg font-bold">
							{Number(payment.amount || 0).toFixed(2)}
							<span class="text-sm text-muted-foreground">{payment.currency.toUpperCase()}</span>
						</div>
					</div>
					<div class="space-y-1">
						<span class="text-xs text-muted-foreground">Provider</span>
						<div class="font-medium capitalize">{payment.provider}</div>
					</div>
				</div>

				<Separator />

				<div class="space-y-1">
					<span class="text-xs text-muted-foreground">Transaction ID</span>
					<div class="rounded bg-muted p-2 font-mono text-xs">{payment.providerPaymentId}</div>
				</div>

				<div class="space-y-1">
					<span class="text-xs text-muted-foreground">Internal ID</span>
					<div class="font-mono text-xs text-muted-foreground">{payment.id}</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1">
						<span class="text-xs text-muted-foreground">Created At</span>
						<div class="text-sm">{new Date(payment.created).toLocaleString()}</div>
					</div>
					<div class="space-y-1">
						<span class="text-xs text-muted-foreground">Updated At</span>
						<div class="text-sm">{new Date(payment.updated).toLocaleString()}</div>
					</div>
				</div>

				{#if payment.notes}
					<div class="space-y-1">
						<span class="text-xs text-muted-foreground">Notes</span>
						<div class="text-sm">{payment.notes}</div>
					</div>
				{/if}

				{#if payment.meta}
					<div class="space-y-1">
						<span class="text-xs text-muted-foreground">Metadata</span>
						<div class="rounded-md border bg-muted/50 p-2">
							<pre class="overflow-auto text-xs">{JSON.stringify(payment.meta, null, 2)}</pre>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="py-8 text-center text-muted-foreground">No payment details available.</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
