<script lang="ts">
	import { Bell, BellOff, Repeat, Plus, Trash2 } from '@lucide/svelte';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import WidgetError from '../WidgetError.svelte';
	import {
		loadReminders,
		createReminder,
		toggleReminderDone,
		deleteReminder
	} from '$lib/remote/reminders.remote';
	import type { RemindersConfig } from '$lib/types/widgets';

	let { config }: { config: RemindersConfig } = $props();

	let newTitle = $state('');
	let newDateTime = $state('');
	let adding = $state(false);

	const reminders = loadReminders();

	let filtered = $derived.by(() => {
		const now = new Date();
		let result = [...(reminders.current ?? [])];

		if (config.category) {
			result = result.filter((r) => r.category === config.category);
		}

		if (!config.showCompleted) {
			result = result.filter((r) => !r.sent);
		}

		const cutoff = new Date(now);
		if (config.timeGroup === 'today') cutoff.setHours(23, 59, 59, 999);
		else if (config.timeGroup === 'week') cutoff.setDate(cutoff.getDate() + 7);
		else cutoff.setMonth(cutoff.getMonth() + 1);

		result = result.filter((r) => r.reminderDatetime && new Date(r.reminderDatetime) <= cutoff);
		result.sort(
			(a, b) => new Date(a.reminderDatetime!).getTime() - new Date(b.reminderDatetime!).getTime()
		);

		return result.slice(0, config.limit);
	});

	function relativeTime(dateStr: string): string {
		const diffMs = new Date(dateStr).getTime() - Date.now();
		const diffMins = Math.round(diffMs / 60000);
		const diffHours = Math.round(diffMs / 3600000);
		const diffDays = Math.round(diffMs / 86400000);

		if (diffMs < 0) return 'overdue';
		if (diffMins < 60) return `in ${diffMins}m`;
		if (diffHours < 24) return `in ${diffHours}h`;
		if (diffDays === 1) return 'tomorrow';
		return `in ${diffDays}d`;
	}

	async function handleAdd() {
		if (!newTitle.trim() || adding) return;
		adding = true;
		try {
			const dt = newDateTime ? new Date(newDateTime) : new Date(Date.now() + 3600000);
			await createReminder({
				title: newTitle.trim(),
				reminder_datetime: dt.toISOString(),
				category: config.category
			});
			newTitle = '';
			newDateTime = '';
		} catch {
			/* error propagated via query */
		} finally {
			adding = false;
		}
	}

	async function handleToggle(id: string, sent: boolean) {
		try {
			await toggleReminderDone({ reminderId: id, sent: !sent });
		} catch {
			/* error propagated via query */
		}
	}

	async function handleDelete(id: string) {
		try {
			await deleteReminder({ reminderId: id });
		} catch {
			/* error propagated via query */
		}
	}
</script>

{#if reminders.loading && !reminders.current}
	<WidgetSkeleton lines={3} />
{:else if reminders.error}
	<WidgetError
		message={reminders.error?.message ?? 'Failed to load reminders'}
		onRetry={() => loadReminders().refresh()}
	/>
{:else}
	<!-- Inline Add -->
	<form
		class="mb-3 space-y-2"
		onsubmit={(e) => {
			e.preventDefault();
			handleAdd();
		}}
	>
		<div class="flex items-center gap-2">
			<Input
				placeholder="Add a reminder..."
				class="h-8 flex-1 border-border/40 bg-muted/20 text-sm"
				bind:value={newTitle}
				disabled={adding}
			/>
			<Button
				variant="ghost"
				size="icon"
				class="size-8 shrink-0"
				type="submit"
				disabled={!newTitle.trim() || adding}
			>
				<Plus class="size-3.5" />
			</Button>
		</div>
		{#if newTitle.trim()}
			<Input
				type="datetime-local"
				class="h-7 border-border/40 bg-muted/20 text-xs"
				bind:value={newDateTime}
				placeholder="When? (defaults to 1h from now)"
			/>
		{/if}
	</form>

	{#if filtered.length === 0}
		<div class="flex min-h-16 flex-col items-center justify-center gap-2 p-4">
			<BellOff class="size-6 text-muted-foreground/50" />
			<p class="text-sm text-muted-foreground">No upcoming reminders</p>
		</div>
	{:else}
		<div class="flex flex-col gap-1">
			{#each filtered as reminder (reminder.id)}
				<div
					class="group/rem flex items-start gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted/40"
				>
					<button
						class="mt-0.5 rounded-full p-1.5 transition-colors {reminder.sent
							? 'bg-primary/20'
							: 'bg-muted/60'} hover:bg-primary/30"
						onclick={() => handleToggle(reminder.id, !!reminder.sent)}
						aria-label="Toggle done"
					>
						<Bell class="size-3.5 text-muted-foreground" />
					</button>
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span
							class="truncate text-sm leading-tight text-foreground {reminder.sent
								? 'line-through opacity-60'
								: ''}">{reminder.title}</span
						>
						<div class="flex items-center gap-1.5">
							<span class="text-xs text-muted-foreground"
								>{relativeTime(reminder.reminderDatetime ?? '')}</span
							>
							{#if reminder.recurring && reminder.recurring !== 'none'}
								<Badge variant="outline" class="h-4 gap-0.5 px-1.5 text-[0.6rem]">
									<Repeat class="size-2.5" />
									{reminder.recurring}
								</Badge>
							{/if}
						</div>
					</div>
					<button
						class="mt-0.5 opacity-0 transition-opacity group-hover/rem:opacity-100"
						onclick={() => handleDelete(reminder.id)}
						aria-label="Delete reminder"
					>
						<Trash2 class="size-3.5 text-muted-foreground hover:text-destructive" />
					</button>
				</div>
			{/each}
		</div>
	{/if}
{/if}
