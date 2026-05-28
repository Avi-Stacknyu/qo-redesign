<script lang="ts">
	import { Plus } from '@lucide/svelte';

	type Props = {
		title?: string;
		tag?: string;
		description?: string;
		icon?: string;
		onAdd?: () => void;
	};

	let {
		title = 'Portfolio Risk Analyzer',
		tag = 'Analyzer',
		description = 'Try a cleaner dashboard layout with fewer.',
		icon = '/icons/analyzer.svg',
		onAdd
	}: Props = $props();
</script>

<div
	class="group relative flex w-full items-start gap-4 rounded-2xl border border-[#FFFFFF] bg-[#F6F6F6] px-6 py-5 transition-all duration-200 hover:shadow-sm"
>
	<div
		class="flex size-14 items-center justify-center rounded-2xl border border-[#F5D9C5] bg-[#F6F6F6]"
	>
		<img
			src={icon}
			alt={title}
			class="size-7 object-contain"
		/>
	</div>

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-3">
			<h3
				class="truncate text-lg font-semibold tracking-[-0.02em] text-[#14213D]"
			>
				{title}
			</h3>

			<span
				class="rounded-full text-sm font-medium text-[#A259FF]"
			>
				{tag}
			</span>
		</div>

		<p
			class="mt-5 text-base font-normal leading-relaxed text-muted-foreground"
		>
			{description}
		</p>
	</div>

	<!-- Action -->
	<button
		type="button"
		onclick={onAdd}
		class="mt-1 flex size-9 items-center justify-center rounded-full transition-all duration-200 hover:bg-black/5"
	>
		<Plus class="size-7 stroke-[1.75] text-[#7C8092]" />
	</button>
</div>