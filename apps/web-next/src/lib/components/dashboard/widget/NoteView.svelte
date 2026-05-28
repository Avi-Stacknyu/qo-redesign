<script lang="ts">
	import { Pin } from '@lucide/svelte';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	type Note = {
		id: number;
		title: string;
		description: string;
		date?: string;
		category?: string;
		tags?: string[];
	};

	type Props = {
		note: Note;
	};

	let { note }: Props = $props();

	const defaultTags = ['Add Tag'];

	let tags = $derived(
		note.tags?.length
			? note.tags
			: [note.category, ...(note.date ? [note.date] : []), ...defaultTags].filter(Boolean)
	);
</script>

<Card class="h-full py-6 font-Inter shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-0 backdrop-blur-xl">
	<CardHeader class="flex items-center justify-between">
		<CardTitle class="font-Inter text-3xl font-semibold text-[#83899F]">
			{note.title}
		</CardTitle>

		<Button class="size-12 rounded-full bg-white shadow-sm" variant="secondary">
			<Pin class="size-5" />
		</Button>
	</CardHeader>

	<CardContent class="flex flex-col gap-3">
		<!-- Top badges -->
		<section class="flex gap-3">
			{#each tags as tag}
				<Button
					variant="secondary"
					class="
						flex
						w-fit
						gap-4
						rounded-full
						border-2
						border-dashed
						border-muted
						bg-white
						p-5
						text-lg
						font-medium
						text-muted-foreground
					"
				>
					{tag}
				</Button>
			{/each}
		</section>

		<p class="font-Inter text-lg font-normal text-[#83899F]">
			{note.description}
		</p>
	</CardContent>
</Card>
