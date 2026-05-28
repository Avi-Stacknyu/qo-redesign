<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Input } from '$lib/components/shadcn/input';
	import Search from '@lucide/svelte/icons/search';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import LineChart from '@lucide/svelte/icons/line-chart';
	import PieChart from '@lucide/svelte/icons/pie-chart';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Activity from '@lucide/svelte/icons/activity';
	import CheckSquare from '@lucide/svelte/icons/check-square';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Bell from '@lucide/svelte/icons/bell';
	import Mail from '@lucide/svelte/icons/mail';
	import Wallet from '@lucide/svelte/icons/wallet';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Banknote from '@lucide/svelte/icons/banknote';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Globe from '@lucide/svelte/icons/globe';
	import Star from '@lucide/svelte/icons/star';
	import Heart from '@lucide/svelte/icons/heart';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import Settings from '@lucide/svelte/icons/settings';
	import Zap from '@lucide/svelte/icons/zap';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Newspaper from '@lucide/svelte/icons/newspaper';
	import User from '@lucide/svelte/icons/user';
	import Users from '@lucide/svelte/icons/users';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import Target from '@lucide/svelte/icons/target';
	import Shield from '@lucide/svelte/icons/shield';
	import Home from '@lucide/svelte/icons/home';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Layers from '@lucide/svelte/icons/layers';
	import Brain from '@lucide/svelte/icons/brain';
	import Flag from '@lucide/svelte/icons/flag';
	import type { Component } from 'svelte';

	const ICONS: { value: string; label: string; icon: Component }[] = [
		{ value: 'bar-chart-3', label: 'Bar Chart', icon: BarChart3 },
		{ value: 'line-chart', label: 'Line Chart', icon: LineChart },
		{ value: 'pie-chart', label: 'Pie Chart', icon: PieChart },
		{ value: 'trending-up', label: 'Trending Up', icon: TrendingUp },
		{ value: 'activity', label: 'Activity', icon: Activity },
		{ value: 'check-square', label: 'Check Square', icon: CheckSquare },
		{ value: 'list-todo', label: 'Todo List', icon: ListTodo },
		{ value: 'clipboard-list', label: 'Clipboard', icon: ClipboardList },
		{ value: 'message-square', label: 'Message', icon: MessageSquare },
		{ value: 'bell', label: 'Bell', icon: Bell },
		{ value: 'mail', label: 'Mail', icon: Mail },
		{ value: 'wallet', label: 'Wallet', icon: Wallet },
		{ value: 'credit-card', label: 'Credit Card', icon: CreditCard },
		{ value: 'banknote', label: 'Banknote', icon: Banknote },
		{ value: 'piggy-bank', label: 'Piggy Bank', icon: PiggyBank },
		{ value: 'landmark', label: 'Landmark', icon: Landmark },
		{ value: 'globe', label: 'Globe', icon: Globe },
		{ value: 'star', label: 'Star', icon: Star },
		{ value: 'heart', label: 'Heart', icon: Heart },
		{ value: 'bookmark', label: 'Bookmark', icon: Bookmark },
		{ value: 'settings', label: 'Settings', icon: Settings },
		{ value: 'zap', label: 'Zap', icon: Zap },
		{ value: 'calendar', label: 'Calendar', icon: Calendar },
		{ value: 'newspaper', label: 'Newspaper', icon: Newspaper },
		{ value: 'user', label: 'User', icon: User },
		{ value: 'users', label: 'Users', icon: Users },
		{ value: 'briefcase', label: 'Briefcase', icon: Briefcase },
		{ value: 'target', label: 'Target', icon: Target },
		{ value: 'shield', label: 'Shield', icon: Shield },
		{ value: 'home', label: 'Home', icon: Home },
		{ value: 'book-open', label: 'Book', icon: BookOpen },
		{ value: 'layers', label: 'Layers', icon: Layers },
		{ value: 'brain', label: 'Brain', icon: Brain },
		{ value: 'flag', label: 'Flag', icon: Flag }
	];

	let {
		value = '',
		onchange,
		disabled = false
	}: {
		value: string;
		onchange: (value: string) => void;
		disabled?: boolean;
	} = $props();

	let open = $state(false);
	let search = $state('');

	let filtered = $derived(
		search
			? ICONS.filter(
					(i) =>
						i.label.toLowerCase().includes(search.toLowerCase()) ||
						i.value.toLowerCase().includes(search.toLowerCase())
				)
			: ICONS
	);

	let selectedIcon = $derived(ICONS.find((i) => i.value === value));

	function pick(iconValue: string) {
		onchange(iconValue);
		open = false;
		search = '';
	}
</script>

<div class="space-y-1.5">
	<Button
		type="button"
		variant="outline"
		class="h-9 w-full justify-between gap-2 font-normal"
		{disabled}
		onclick={() => {
			open = !open;
		}}
	>
		<span class="flex items-center gap-2">
			{#if selectedIcon}
				{@const Icon = selectedIcon.icon}
				<Icon class="size-4" />
				<span>{selectedIcon.label}</span>
			{:else}
				<span class="text-muted-foreground">Pick an icon…</span>
			{/if}
		</span>
		<ChevronDown
			class="size-3.5 text-muted-foreground transition-transform {open ? 'rotate-180' : ''}"
		/>
	</Button>

	{#if open}
		<div class="rounded-md border border-border/60 bg-background">
			<div class="flex items-center border-b border-border/40 px-3 py-2">
				<Search class="mr-2 size-3.5 text-muted-foreground" />
				<Input
					placeholder="Search icons…"
					class="h-7 border-0 px-0 text-sm shadow-none focus-visible:ring-0"
					bind:value={search}
				/>
			</div>
			<div class="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto p-2">
				{#each filtered as entry (entry.value)}
					{@const Icon = entry.icon}
					<button
						type="button"
						class="flex items-center justify-center rounded-md p-2 transition-colors
							{value === entry.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
						onclick={() => pick(entry.value)}
						title={entry.label}
					>
						<Icon class="size-4" />
					</button>
				{/each}
				{#if filtered.length === 0}
					<p class="col-span-8 py-4 text-center text-xs text-muted-foreground">No icons found</p>
				{/if}
			</div>
			{#if value}
				<div class="border-t border-border/40 px-3 py-1.5">
					<button
						type="button"
						class="text-xs text-muted-foreground hover:text-foreground"
						onclick={() => {
							onchange('');
							open = false;
						}}
					>
						Clear selection
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
