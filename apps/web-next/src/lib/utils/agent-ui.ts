import {
	Sparkles,
	Receipt,
	TrendingUp,
	Banknote,
	Building2,
	Landmark,
	Wallet,
	Briefcase,
	Scale,
	PieChart,
	LineChart,
	Brain,
	Compass
} from '@lucide/svelte';

export function getAgentIcon(name: string | undefined, id: string | undefined) {
	if (!name || !id) return Sparkles;
	const n = name.toLowerCase();
	if (n.includes('tax') || n.includes('audit')) return Receipt;
	if (n.includes('invest') || n.includes('stock')) return TrendingUp;
	if (n.includes('bank') || n.includes('debt')) return Banknote;
	if (n.includes('real estate') || n.includes('home')) return Building2;
	if (n.includes('retire') || n.includes('pension')) return Landmark;
	if (n.includes('budget') || n.includes('save')) return Wallet;
	if (n.includes('career') || n.includes('job')) return Briefcase;
	if (n.includes('legal') || n.includes('law')) return Scale;
	const icons = [PieChart, LineChart, Brain, Compass];
	return icons[id.charCodeAt(0) % icons.length];
}

export function getAgentColor(name: string | undefined, id: string | undefined) {
	if (!name || !id) return '#A1A1AA';
	// Basic reproducible color generation from ID hash or name
	const colors = [
		'#ef4444', // red-500
		'#f97316', // orange-500
		'#eab308', // yellow-500
		'#22c55e', // green-500
		'#06b6d4', // cyan-500
		'#3b82f6', // blue-500
		'#8b5cf6', // violet-500
		'#d946ef', // fuchsia-500
		'#f43f5e' // rose-500
	];
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = id.charCodeAt(i) + ((hash << 5) - hash);
	}
	return colors[Math.abs(hash) % colors.length];
}
