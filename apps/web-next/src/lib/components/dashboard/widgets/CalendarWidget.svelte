<script lang="ts">
	import { Calendar as CalendarIcon } from '@lucide/svelte';
	import { RangeCalendar, Day } from '$lib/components/ui/range-calendar/index.js';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';
	import WidgetError from '../WidgetError.svelte';
	import { loadReminders } from '$lib/remote/reminders.remote';
	import type { DateValue } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';

	let value = $state<DateRange | undefined>(undefined);

	const remindersQuery = loadReminders();

	let reminderItems = $derived(remindersQuery.current ?? []);

	function dateHasReminder(day: DateValue): boolean {
		return reminderItems.some((r) => {
			if (!r.reminderDatetime) return false;
			const d = new Date(r.reminderDatetime);
			return (
				d.getFullYear() === day.year && d.getMonth() + 1 === day.month && d.getDate() === day.day
			);
		});
	}

	let selectedReminders = $derived.by(() => {
		if (!value?.start) return [];
		const startMs = new Date(value.start.year, value.start.month - 1, value.start.day).getTime();
		const endMs = value.end
			? new Date(value.end.year, value.end.month - 1, value.end.day, 23, 59, 59).getTime()
			: startMs + 86_400_000 - 1;
		return reminderItems.filter((r) => {
			if (!r.reminderDatetime) return false;
			const t = new Date(r.reminderDatetime).getTime();
			return t >= startMs && t <= endMs;
		});
	});
</script>

{#if remindersQuery.loading && !remindersQuery.current}
	<WidgetSkeleton lines={5} />
{:else if remindersQuery.error}
	<WidgetError
		message={remindersQuery.error?.message ?? 'Failed to load reminders'}
		onRetry={() => loadReminders().refresh()}
	/>
{:else}
	<div class="calendar-wrap flex flex-col gap-1.5">
		<RangeCalendar
			bind:value
			numberOfMonths={2}
			weekdayFormat="short"
			fixedWeeks={false}
			class="w-full rounded-md border-none bg-transparent p-0 shadow-none"
		>
			{#snippet day({ day: d, outsideMonth })}
				{@const hasReminder = !outsideMonth && dateHasReminder(d)}
				<Day class="relative text-[11px]">
					{d.day}
					{#if hasReminder}
						<span
							class="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"
						></span>
					{/if}
				</Day>
			{/snippet}
		</RangeCalendar>

		{#if selectedReminders.length > 0}
			<div class="w-full border-t border-border/40 pt-1.5">
				<p class="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
					Reminders
				</p>
				{#each selectedReminders as r (r.id)}
					<div class="flex items-center gap-1.5 py-0.5">
						<CalendarIcon class="size-2.5 text-primary" />
						<span class="truncate text-[11px] text-foreground">{r.title}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Container query needed to make cell size fluid — no Tailwind utility for cqi calc */
	.calendar-wrap {
		container-type: inline-size;
	}
	.calendar-wrap :global([data-bits-calendar-root]) {
		--cell-size: clamp(1rem, calc((100cqi - 2rem) / 14), 1.75rem);
	}
</style>
