<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import * as Select from '$lib/components/ui/select';

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

		// Empty cells before month starts
		for (let i = 0; i < firstDay; i++) {
			calendarDays.push(null);
		}

		// Month days
		for (let day = 1; day <= daysInMonth; day++) {
			calendarDays.push(day);
		}

		// Fill remaining cells
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

<div class="w-full">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between font-Inter">
		<h2 class="text-2xl font-semibold tracking-[-0.5px] text-[#102048]">
			{String(selectedDate.getDate()).padStart(2, '0')}
			{MONTH_NAMES[selectedDate.getMonth()]}
		</h2>

		<Select.Root type="single" bind:value={selectedMonthValue}>
			<Select.Trigger
				class="rounded-full border border-[#e4e7ec] bg-white px-5 py-2 text-[15px] font-medium text-[#7d8495] shadow-none transition hover:bg-gray-50 focus-visible:ring-0 focus-visible:ring-offset-0"
			>
				{MONTH_NAMES[currentMonth]}
			</Select.Trigger>

			<Select.Content class="rounded-3xl border border-[#e4e7ec] bg-white p-2 shadow-xl">
				{#each MONTH_NAMES as monthName, monthIndex}
					<Select.Item
						value={String(monthIndex)}
						class="rounded-2xl px-4 py-3 text-[15px] font-medium text-[#7d8495]"
					>
						{monthName}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<!-- Month Navigation -->
	<div class="mb-5 flex items-center justify-between px-1">
		<button
			onclick={handlePreviousMonth}
			class="flex h-8 w-8 items-center justify-center rounded-full text-[#7d8495] transition hover:bg-[#f3f4f6]"
		>
			<ChevronLeft class="h-4 w-4" />
		</button>

		<p class="text-sm font-medium text-[#4b5563]">
			{MONTH_NAMES[currentMonth]}
			{currentYear}
		</p>

		<button
			onclick={handleNextMonth}
			class="flex h-8 w-8 items-center justify-center rounded-full text-[#7d8495] transition hover:bg-[#f3f4f6]"
		>
			<ChevronRight class="h-4 w-4" />
		</button>
	</div>

	<!-- Weekdays -->
	<div class="mb-3 grid grid-cols-7 gap-2">
		{#each DAY_NAMES as day}
			<div
				class="flex h-10 items-center justify-center rounded-xl bg-[#f3f4f6] text-sm font-medium text-[#102048]"
			>
				{day}
			</div>
		{/each}
	</div>

	<!-- Days Grid -->
	<div class="grid grid-cols-7 gap-y-3">
		{#each days as day, index}
			{#if !day}
				<div></div>
			{:else}
				{@const date = new Date(currentYear, currentMonth, day)}
				{@const isSelected = isSameDay(date, selectedDate)}

				<div class="flex items-center justify-center">
					<button
						onclick={() => handleSelectDate(day)}
						class={`flex h-10 w-10 items-center justify-center rounded-full text-[18px] transition-all ${
							isSelected
								? 'bg-[#9b5cff] font-semibold text-white'
								: 'text-[#102048] hover:bg-[#f3f4f6]'
						}`}
					>
						{day}
					</button>
				</div>
			{/if}
		{/each}
	</div>
</div>
