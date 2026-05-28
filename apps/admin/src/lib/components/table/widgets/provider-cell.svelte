<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge';
	import Icon from '@iconify/svelte';

	let { value } = $props<{ value: string }>();

	const providerConfig: Record<string, { label: string; icon: string; color: string }> = {
		openai: {
			label: 'OpenAI',
			icon: 'simple-icons:openai',
			color: 'bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-200'
		},
		anthropic: {
			label: 'Anthropic',
			icon: 'simple-icons:anthropic',
			color: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-200'
		},
		google: {
			label: 'Google',
			icon: 'simple-icons:google',
			color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200'
		},
		xai: {
			label: 'xAI',
			icon: 'simple-icons:x',
			color: 'bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 border-slate-200'
		},
		cloudflare: {
			label: 'Cloudflare',
			icon: 'simple-icons:cloudflare',
			color: 'bg-[#F38020]/10 text-[#F38020] hover:bg-[#F38020]/20 border-[#F38020]/20'
		},
		global: {
			label: 'Global',
			icon: 'lucide:globe',
			color: 'bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border-indigo-200'
		}
	};

	const config = $derived(
		providerConfig[value.toLowerCase()] || {
			label: value,
			icon: 'lucide:bot',
			color: 'bg-gray-500/10 text-gray-600 border-gray-200'
		}
	);
</script>

<Badge variant="outline" class="{config.color} gap-1.5 px-2 py-0.5 font-medium">
	<Icon icon={config.icon} class="h-3.5 w-3.5" />
	{config.label}
</Badge>
