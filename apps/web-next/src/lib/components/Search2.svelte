<script>
	import { Search } from '@lucide/svelte';
	import Input from './ui/input/input.svelte';
</script>

<div class="relative w-full max-w-5xl">
	<Search class="absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />

	<Input
		type="text"
		placeholder="Search tools..."
		class="h-13 w-full rounded-2xl border border-border/60 bg-white pr-5 pl-13 text-sm shadow-sm transition-all outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 sm:h-14"
	/>
</div>
