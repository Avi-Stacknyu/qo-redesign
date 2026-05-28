<script lang="ts">
	import Icon, { getIcon } from '@iconify/svelte';
	import { CircleQuestionMark } from '@lucide/svelte';

	let { icon, class: className }: { icon: string; class?: string } = $props();

	const isValidFormat = $derived(
		icon && icon.includes(':') && icon.split(':').length === 2 && icon.split(':')[1].length > 0
	);

	let isLoaded = $state(false);

	$effect(() => {
		if (icon && isValidFormat) {
			const data = getIcon(icon);
			isLoaded = !!data;
		} else {
			isLoaded = false;
		}
	});

	function handleIconLoad() {
		isLoaded = true;
	}
</script>

{#if !icon || !isValidFormat}
	<div class="flex items-center justify-center {className} rounded-md bg-slate-100">
		<CircleQuestionMark class="h-full w-full p-0.5 text-slate-300" />
	</div>
{:else}
	<div class="relative flex items-center justify-center {className}">
		{#if !isLoaded}
			<div
				class="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 opacity-20"
			>
				<CircleQuestionMark class="h-full w-full" />
			</div>
		{/if}
		<div class="relative z-10 h-full w-full">
			<Icon {icon} onload={handleIconLoad} class="h-full w-full" />
		</div>
	</div>
{/if}
