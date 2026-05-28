import {
	ArrowDownIcon,
	ArrowRightIcon,
	ArrowUpIcon,
	CircleCheckIcon,
	CircleHelpIcon,
	CircleIcon,
	CircleOffIcon,
	TimerIcon
} from '@lucide/svelte';

export const labels = [
	{
		value: 'bug',
		label: 'Bug'
	},
	{
		value: 'feature',
		label: 'Feature'
	},
	{
		value: 'documentation',
		label: 'Documentation'
	}
];

export const priorities = [
	{
		label: 'Low',
		value: 'low',
		icon: ArrowDownIcon
	},
	{
		label: 'Medium',
		value: 'medium',
		icon: ArrowRightIcon
	},
	{
		label: 'High',
		value: 'high',
		icon: ArrowUpIcon
	}
];

export const statuses = [
	{
		value: 'backlog',
		label: 'Backlog',
		icon: CircleHelpIcon
	},
	{
		value: 'todo',
		label: 'Todo',
		icon: CircleIcon
	},
	{
		value: 'in progress',
		label: 'In Progress',
		icon: TimerIcon
	},
	{
		value: 'done',
		label: 'Done',
		icon: CircleCheckIcon
	},
	{
		value: 'canceled',
		label: 'Canceled',
		icon: CircleOffIcon
	}
];
