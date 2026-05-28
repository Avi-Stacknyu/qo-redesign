<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import * as Select from '$lib/components/ui/select';
	import { loadReminders } from '$lib/remote/reminders.remote';
	import WidgetError from '../WidgetError.svelte';
	import WidgetSkeleton from '../WidgetSkeleton.svelte';

	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	const MONTH_NAMES = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	function getDaysInMonth(year: number, month: number) {
		return new Date(year, month + 1, 0).getDate();
	}

	function getFirstDay(year: number, month: number) {
		return new Date(year, month, 1).getDay();
	}

	function isSameDay(date1: Date, date2: Date) {
		return (
			date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate()
		);
	}

	let selectedDate = $state(new Date());
	let currentMonth = $state(new Date().getMonth());
	let currentYear = $state(new Date().getFullYear());
	let selectedMonthValue = $state(String(new Date().getMonth()));

	const days = $derived.by(() => {
		const daysInMonth = getDaysInMonth(currentYear, currentMonth);
		const firstDay = getFirstDay(currentYear, currentMonth);
		const calendarDays: (number | null)[] = [];

		for (let index = 0; index < firstDay; index += 1) {
			calendarDays.push(null);
		}

		for (let day = 1; day <= daysInMonth; day += 1) {
			calendarDays.push(day);
		}

		while (calendarDays.length % 7 !== 0) {
			calendarDays.push(null);
		}

		return calendarDays;
	});

	function handlePreviousMonth() {
		if (currentMonth === 0) {
			currentMonth = 11;
			currentYear -= 1;
			return;
		}

		currentMonth -= 1;
	}

	function handleNextMonth() {
		if (currentMonth === 11) {
			currentMonth = 0;
			currentYear += 1;
			return;
		}

		currentMonth += 1;
	}

	function handleSelectDate(day: number) {
		selectedDate = new Date(currentYear, currentMonth, day);
	}

	const remindersQuery = loadReminders();
	let reminderItems = $derived(remindersQuery.current ?? []);
	let selectedReminders = $derived(
		reminderItems.filter((reminder) => {
			if (!reminder.reminderDatetime) return false;
			const date = new Date(reminder.reminderDatetime);
			return isSameDay(date, selectedDate);
		})
	);

	function hasReminder(day: number) {
		return reminderItems.some((reminder) => {
			if (!reminder.reminderDatetime) return false;
			const date = new Date(reminder.reminderDatetime);
			return (
				date.getFullYear() === currentYear &&
				date.getMonth() === currentMonth &&
				date.getDate() === day
			);
		});
	}

	$effect(() => {
		const nextMonth = Number(selectedMonthValue);

		if (!Number.isNaN(nextMonth) && nextMonth !== currentMonth) {
			currentMonth = nextMonth;
		}
	});

	$effect(() => {
		const nextValue = String(currentMonth);

		if (selectedMonthValue !== nextValue) {
			selectedMonthValue = nextValue;
		}
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
	<div class="w-full">
		<div class="mb-6 flex items-center justify-between">
			<h2 class="text-2xl font-semibold tracking-[-0.5px] text-[#102048]">
				{String(selectedDate.getDate()).padStart(2, '0')} {MONTH_NAMES[selectedDate.getMonth()]}
			</h2>

			<Select.Root type="single" bind:value={selectedMonthValue}>
				<Select.Trigger class="rounded-full border border-[#E4E7EC] bg-white px-5 py-2 text-[15px] font-medium text-[#7D8495] shadow-none transition hover:bg-gray-50 focus-visible:ring-0 focus-visible:ring-offset-0">
					{MONTH_NAMES[currentMonth]}
				</Select.Trigger>

				<Select.Content class="rounded-3xl border border-[#E4E7EC] bg-white p-2 shadow-xl">
					{#each MONTH_NAMES as monthName, monthIndex}
						<Select.Item value={String(monthIndex)} class="rounded-2xl px-4 py-3 text-[15px] font-medium text-[#7D8495]">
							{monthName}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div class="mb-5 flex items-center justify-between px-1">
			<button onclick={handlePreviousMonth} class="flex h-8 w-8 items-center justify-center rounded-full text-[#7D8495] transition hover:bg-[#F3F4F6]">
				<ChevronLeft class="h-4 w-4" />
			</button>

			<p class="text-sm font-medium text-[#4B5563]">
				{MONTH_NAMES[currentMonth]} {currentYear}
			</p>

			<button onclick={handleNextMonth} class="flex h-8 w-8 items-center justify-center rounded-full text-[#7D8495] transition hover:bg-[#F3F4F6]">
				<ChevronRight class="h-4 w-4" />
			</button>
		</div>

		<div class="mb-3 grid grid-cols-7 gap-2">
			{#each DAY_NAMES as dayName}
				<div class="flex h-10 items-center justify-center rounded-xl bg-[#F3F4F6] text-sm font-medium text-[#102048]">
					{dayName}
				</div>
			{/each}
		</div>

		<div class="grid grid-cols-7 gap-y-3">
			{#each days as day}
				{#if !day}
					<div></div>
				{:else}
					{@const date = new Date(currentYear, currentMonth, day)}
					{@const isSelected = isSameDay(date, selectedDate)}
					{@const dayHasReminder = hasReminder(day)}

					<div class="flex items-center justify-center">
						<button
							onclick={() => handleSelectDate(day)}
							class={`relative flex h-10 w-10 items-center justify-center rounded-full text-[18px] transition-all ${
								isSelected ? 'bg-[#9B5CFF] font-semibold text-white' : 'text-[#102048] hover:bg-[#F3F4F6]'
							}`}
						>
							{day}
							{#if dayHasReminder}
								<span class={`absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${isSelected ? 'bg-white' : 'bg-[#9B5CFF]'}`}></span>
							{/if}
						</button>
					</div>
				{/if}
			{/each}
		</div>

		{#if selectedReminders.length > 0}
			<div class="mt-5 space-y-2 rounded-3xl border border-[#F6F6F6] bg-[#FBFCFF] p-4">
				<p class="text-xs font-semibold tracking-[0.18em] text-[#98A2B3] uppercase">Reminders</p>
				{#each selectedReminders as reminder (reminder.id)}
					<div class="rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
						<p class="text-sm font-semibold text-[#25324B]">{reminder.title}</p>
						{#if reminder.reminderDatetime}
							<p class="mt-1 text-xs text-[#7B8794]">{new Date(reminder.reminderDatetime).toLocaleString()}</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}