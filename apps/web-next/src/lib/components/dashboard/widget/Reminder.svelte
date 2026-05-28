<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	let {
		reminders = [
			{
				id: '1',
				title: 'Prepare Case Study',
				description: 'Document process, decisions, and final outcomes'
			},
			{
				id: '2',
				title: 'Prepare Case Study',
				description: 'Document process, decisions, and final outcomes'
			},
			{
				id: '3',
				title: 'Prepare Case Study',
				description: 'Document process, decisions, and final outcomes'
			}
		]
	}: {
		reminders?: { id: string; title: string; description: string }[];
	} = $props();

	console.log("remainder mounted");
	
</script>

<div class="w-full flex flex-col gap-3">
			<!-- Items -->
			{#each reminders as reminder (reminder.id)}
				<div class="flex flex-col gap-2 rounded-2xl bg-muted p-4">
					<p class="text-lg font-medium text-primary">{reminder.title}</p>
					<p class="text-base text-muted-foreground">{reminder.description}</p>
				</div>
			{/each}

</div>