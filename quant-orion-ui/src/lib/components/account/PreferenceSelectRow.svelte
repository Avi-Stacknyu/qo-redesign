<script lang="ts">
	import CustomSelect from '$lib/components/account/CustomSelect.svelte';
	import type { SelectOption } from '$lib/components/account/types';

	let {
		label,
		value = $bindable(),
		options = []
	}: {
		label: string;
		value?: string;
		options?: readonly SelectOption[];
	} = $props();
</script>

<div
	class="flex flex-col gap-4 border-b-2 border-[#E4E9EF] py-5 sm:flex-row sm:items-center sm:justify-between"
>
	<h2 class="font-Inter text-xl">{label}</h2>

	<CustomSelect bind:value options={options} class="w-full sm:w-auto" />
</div>