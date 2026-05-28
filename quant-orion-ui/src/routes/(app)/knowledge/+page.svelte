<script>
	import Note from '$lib/components/dashboard/widget/Note.svelte';
	import WorkIdea from '$lib/components/knowledge/WorkIdea.svelte';

	const note = [
		{
			id: 1,
			title: 'Work Ideas',
			description:
				'Try a cleaner dashboard layout with fewer widgets. Focus more on hierarchy and spacing.',
			date: '20 MON',
			category: 'Personal'
		},
		{
			id: 2,
			title: 'Meeting Notes',
			description: 'Finalize onboarding flow and improve mobile responsiveness.',
			date: '18 SAT',
			category: 'Work'
		},
		{
			id: Date.now(),
			title: 'Meeting Notes',
			description: 'Finalize onboarding flow and improve mobile responsiveness.',
			date: '18 SAT',
			category: 'Work'
		},
		{
			id: 4,
			title: 'Meeting Notes',
			description: 'Finalize onboarding flow and improve mobile responsiveness.',
			date: '18 SAT',
			category: 'Work'
		},
		{
			id: 5,
			title: 'Meeting Notes',
			description: 'Finalize onboarding flow and improve mobile responsiveness.',
			date: '18 SAT',
			category: 'Work'
		},
		{
			id: 6,
			title: 'Meeting Notes',
			description: 'Finalize onboarding flow and improve mobile responsiveness.',
			date: '18 SAT',
			category: 'Work'
		},
		{
			id: 7,
			title: 'Meeting Notes',
			description: 'Finalize onboarding flow and improve mobile responsiveness.',
			date: '18 SAT',
			category: 'Work'
		}
	];
</script>

<div class="flex w-full gap-3">
	<Note title="Recent Notes" notes={note} />
	<section class="w-full">
		<WorkIdea />
	</section>
</div>
