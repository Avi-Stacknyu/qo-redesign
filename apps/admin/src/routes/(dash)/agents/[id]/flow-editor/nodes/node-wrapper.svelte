<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		icon: Icon,
		colorClass = 'border-border',
		selected = false,
		children
	}: {
		label: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: any;
		colorClass?: string;
		selected?: boolean;
		children: Snippet;
	} = $props();
</script>

<div
	class="min-w-50 rounded-lg border-2 bg-background shadow-sm transition-all {colorClass}"
	class:ring-2={selected}
	class:ring-primary={selected}
	class:ring-offset-2={selected}
>
	<div
		class="flex items-center gap-2 border-b px-3 py-2 {colorClass
			.replace('border-', 'bg-')
			.replace('/30', '/5')}"
	>
		<div
			class="flex h-6 w-6 items-center justify-center rounded {colorClass
				.replace('border-', 'bg-')
				.replace('/30', '/20')}"
		>
			<Icon class="h-3.5 w-3.5" />
		</div>
		<span class="text-sm font-medium">{label}</span>
	</div>
	<div class="p-3">
		{@render children()}
	</div>
</div>
