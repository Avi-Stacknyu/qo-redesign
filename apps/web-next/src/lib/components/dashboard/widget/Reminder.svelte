<script lang="ts">
	import { Bell, BellOff, Plus, Repeat, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		createReminder,
		deleteReminder,
		loadReminders,
		toggleReminderDone
	} from '$lib/remote/reminders.remote';
	import type { RemindersConfig } from '$lib/types/widgets';
	import WidgetError from '../WidgetError.svelte';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';

	const DEFAULT_CONFIG: RemindersConfig = {
		timeGroup: 'week',
		showCompleted: false,
		limit: 5
	};

	let { config }: { config?: RemindersConfig } = $props();
	let resolvedConfig = $derived.by((): RemindersConfig => ({ ...DEFAULT_CONFIG, ...(config ?? {}) }));

	let newTitle = $state('');
	let newDateTime = $state('');
	let adding = $state(false);

	const reminders = loadReminders();

	let filtered = $derived.by(() => {
		const now = new Date();
		let result = [...(reminders.current ?? [])];

		if (resolvedConfig.category) {
			result = result.filter((reminder) => reminder.category === resolvedConfig.category);
		}

		if (!resolvedConfig.showCompleted) {
			result = result.filter((reminder) => !reminder.sent);
		}

		const cutoff = new Date(now);
		if (resolvedConfig.timeGroup === 'today') cutoff.setHours(23, 59, 59, 999);
		else if (resolvedConfig.timeGroup === 'week') cutoff.setDate(cutoff.getDate() + 7);
		else cutoff.setMonth(cutoff.getMonth() + 1);

		result = result.filter(
			(reminder) => reminder.reminderDatetime && new Date(reminder.reminderDatetime) <= cutoff
		);
		result.sort(
			(a, b) =>
				new Date(a.reminderDatetime ?? 0).getTime() - new Date(b.reminderDatetime ?? 0).getTime()
		);

		return result.slice(0, resolvedConfig.limit);
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
			const dateTime = newDateTime ? new Date(newDateTime) : new Date(Date.now() + 3600000);
			await createReminder({
				title: newTitle.trim(),
				reminder_datetime: dateTime.toISOString(),
				category: resolvedConfig.category
			});
			newTitle = '';
			newDateTime = '';
		} catch {
			/* error surfaced through query state */
		} finally {
			adding = false;
		}
	}

	async function handleToggle(id: string, sent: boolean) {
		try {
			await toggleReminderDone({ reminderId: id, sent: !sent });
		} catch {
			/* error surfaced through query state */
		}
	}

	async function handleDelete(id: string) {
		try {
			await deleteReminder({ reminderId: id });
		} catch {
			/* error surfaced through query state */
		}
	}
</script>

{#if reminders.loading && !reminders.current}
	<WidgetSkeleton lines={3} />
{:else if reminders.error}
	<WidgetError message={reminders.error?.message ?? 'Failed to load reminders'} onRetry={() => loadReminders().refresh()} />
{:else}
	<form
		class="mb-3 space-y-2"
		onsubmit={(event) => {
			event.preventDefault();
			handleAdd();
		}}
	>
		<div class="flex items-center gap-2">
			<Input
				placeholder="Add a reminder..."
				class="h-10 flex-1 rounded-2xl border-[#F6F6F6] bg-[#F6F6F6] text-sm"
				bind:value={newTitle}
				disabled={adding}
			/>
			<Button
				variant="ghost"
				size="icon"
				class="size-10 shrink-0 rounded-2xl bg-[#F6F6F6] text-[#83899F] hover:bg-[#E7EDF7]"
				type="submit"
				disabled={!newTitle.trim() || adding}
			>
				<Plus class="size-4" />
			</Button>
		</div>

		{#if newTitle.trim()}
			<Input
				type="datetime-local"
				class="h-9 rounded-2xl border-[#F6F6F6] bg-[#F6F6F6] text-xs"
				bind:value={newDateTime}
				placeholder="When?"
			/>
		{/if}
	</form>

	{#if filtered.length === 0}
		<div class="flex min-h-32 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200">
			<BellOff class="size-7 text-slate-300" />
			<p class="text-sm font-medium text-slate-400">No upcoming reminders</p>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each filtered as reminder (reminder.id)}
				<div class="group rounded-3xl border border-[#F6F6F6] bg-white p-4 shadow-none transition-all hover:shadow-sm">
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-start gap-3">
							<button
								type="button"
								class={`mt-1 rounded-full p-2 transition-colors ${reminder.sent ? 'bg-[#E9FBF2]' : 'bg-[#F6F6F6]'}`}
								onclick={() => handleToggle(reminder.id, !!reminder.sent)}
								aria-label="Toggle reminder"
							>
								<Bell class={`size-4 ${reminder.sent ? 'text-[#12B76A]' : 'text-[#83899F]'}`} />
							</button>

							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<p class={`text-lg font-medium leading-5 text-slate-700 ${reminder.sent ? 'line-through text-slate-400' : ''}`}>
									{reminder.title}
								</p>
								{#if reminder.description}
									<p class="text-sm text-[#83899F]">{reminder.description}</p>
								{/if}
							</div>
						</div>

						<button
							type="button"
							class="size-8 rounded-lg text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
							onclick={() => handleDelete(reminder.id)}
							aria-label="Delete reminder"
						>
							<Trash2 class="size-4" />
						</button>
					</div>

					<div class="mt-4 flex items-center gap-2">
						<div class="rounded-lg border border-[#F6F6F6] bg-[#F6F6F6] px-3 py-1 text-sm font-medium text-[#83899F]">
							{relativeTime(reminder.reminderDatetime ?? '')}
						</div>

						{#if reminder.recurring && reminder.recurring !== 'none'}
							<div class="inline-flex items-center gap-1 rounded-2xl border border-[#F6F6F6] px-3 py-1 text-xs font-medium text-[#83899F]">
								<Repeat class="size-3" />
								{reminder.recurring}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/if}