<script lang="ts">
	import * as Dialog from '$lib/components/shadcn/dialog';
	import { Button } from '$lib/components/shadcn/button';
	import { Input } from '$lib/components/shadcn/input';
	import { Label } from '$lib/components/shadcn/label';
	import * as Select from '$lib/components/shadcn/select';
	import { updateUserCredits, getUserCostStats } from './user-details.remote';
	import { toast } from 'svelte-sonner';

	let {
		open = $bindable(false),
		userId,
		onsuccess
	} = $props<{
		open: boolean;
		userId: string;
		onsuccess?: () => void;
	}>();

	let type = $state<'credit' | 'debit'>('credit');
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Manage User Credits</Dialog.Title>
			<Dialog.Description>
				Manually add or deduct credits from the user's balance.
			</Dialog.Description>
		</Dialog.Header>

		<form
			{...updateUserCredits.enhance(async ({ submit }) => {
				try {
					await submit().updates(getUserCostStats);
					toast.success('Credits updated successfully');
					open = false;
					onsuccess?.();
				} catch (error) {
					toast.error('Failed to update credits');
				}
			})}
			class="space-y-4"
		>
			<input type="hidden" name="userId" value={userId} />

			<div class="grid gap-2">
				<Label>Transaction Type</Label>
				<Select.Root
					type="single"
					value={type}
					onValueChange={(v) => {
						type = v as 'credit' | 'debit';
						// updateUserCredits.fields.type.set(v as 'credit' | 'debit'); // Not strictly needed if we use hidden input
					}}
				>
					<Select.Trigger>
						{type === 'credit' ? 'Add Credits (Bonus/Refund)' : 'Deduct Credits (Correction)'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="credit">Add Credits</Select.Item>
						<Select.Item value="debit">Deduct Credits</Select.Item>
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="type" value={type} />
			</div>

			<div class="grid gap-2">
				<Label>Amount</Label>
				<Input {...updateUserCredits.fields.amount.as('number')} min="0" step="0.01" />
			</div>

			<div class="grid gap-2">
				<Label>Description</Label>
				<Input
					{...updateUserCredits.fields.description.as('text')}
					placeholder="Reason for adjustment (e.g. Support Refund)"
				/>
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!updateUserCredits.pending}>
					{updateUserCredits.pending ? 'Processing...' : 'Confirm Adjustment'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
