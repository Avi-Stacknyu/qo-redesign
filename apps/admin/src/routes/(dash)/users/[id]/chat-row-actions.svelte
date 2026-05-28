<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Eye } from '@lucide/svelte';

	let { onView } = $props<{ onView: () => void }>();
</script>

<Button variant="ghost" size="icon" onclick={onView}>
	<Eye class="h-4 w-4" />
</Button>
