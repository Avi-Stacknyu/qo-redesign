<script lang="ts">
	import { BookOpen } from '@lucide/svelte';

	import ConversationPanel from '$lib/components/chat/ConversationPanel.svelte';

	const coursePlannerMessages = [
		{
			id: 1,
			role: 'assistant' as const,
			text: "Hi! I'm your Course Planner Agent. I help students build a strategic academic plan from middle school through senior year.\n\nTo get started, what grade is the student in right now, and do you have a sense of their post-high school goals?"
		},
		{
			id: 2,
			role: 'user' as const,
			text: "My son is starting 9th grade. We're looking at top-tier engineering programs for college, so we need a rigorous math and science track."
		},
		{
			id: 3,
			role: 'assistant' as const,
			text: "That's an excellent goal. For 9th grade, we should focus on a strong foundation while looking ahead to AP or IB tracks. I recommend making sure he's on track for Honors Geometry or Algebra II this year. For science, Biology is standard, but we can also look at specialized electives if they are available. Would you like me to draft a 4-year curriculum map?"
		}
	];

	const coursePlannerReply =
		"Great question. I'll put together a personalized four-year map and factor in the requirements for top engineering programs as we sequence the next steps.";
</script>

<div class="mx-auto h-[calc(100vh-2rem)] w-full px-2 py-2 md:px-4">
	<ConversationPanel
		class="h-full"
		title="Course Planner"
		status="Online · Active now"
		icon={BookOpen}
		initialMessages={coursePlannerMessages}
		replyText={coursePlannerReply}
		inputPlaceholder="Type a message..."
		showStar={true}
		showMenu={true}
	/>
</div>