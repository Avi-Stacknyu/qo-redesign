<script lang="ts">
	import { Badge } from '$lib/components/shadcn/badge';
	import * as Card from '$lib/components/shadcn/card';
	import * as Table from '$lib/components/shadcn/table';
	import { getUserOnboardingAudit } from '../user-details.remote';

	const auditQuery = getUserOnboardingAudit();
	const data = $derived(auditQuery.current);
	const assignments = $derived(data?.assignments ?? []);
	const events = $derived(data?.auditEvents ?? []);

	function eventLabel(type: string): string {
		switch (type) {
			case 'question_answered':
				return 'Answer';
			case 'question_skipped':
				return 'Skipped';
			case 'ai_question_generated':
				return 'AI Question';
			case 'onboarding_completed':
				return 'Completed';
			default:
				return type.replace(/_/g, ' ');
		}
	}

	function eventVariant(
		type: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (type) {
			case 'onboarding_completed':
				return 'default';
			case 'question_skipped':
				return 'outline';
			default:
				return 'secondary';
		}
	}

	function formatTime(ts: string | null): string {
		if (!ts) return '—';
		return new Date(ts).toLocaleString();
	}
</script>

<div class="space-y-6 px-4 lg:px-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>Onboarding Assignments</Card.Title>
			<Card.Description>Profile assignments and their completion status.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if assignments.length === 0}
				<p class="text-sm text-muted-foreground">No onboarding assignments found.</p>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Profile</Table.Head>
							<Table.Head>Source</Table.Head>
							<Table.Head>Locked</Table.Head>
							<Table.Head>Started</Table.Head>
							<Table.Head>Completed</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each assignments as a (a.id)}
							<Table.Row>
								<Table.Cell class="font-medium">{a.profileName ?? a.profile}</Table.Cell>
								<Table.Cell>
									<Badge variant="outline">{a.resolutionSource}</Badge>
								</Table.Cell>
								<Table.Cell class="text-xs text-muted-foreground"
									>{formatTime(a.lockedAt)}</Table.Cell
								>
								<Table.Cell class="text-xs text-muted-foreground"
									>{formatTime(a.startedAt)}</Table.Cell
								>
								<Table.Cell>
									{#if a.completedAt}
										<Badge variant="default">Done</Badge>
									{:else}
										<Badge variant="secondary">In Progress</Badge>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Audit Trail</Card.Title>
			<Card.Description>Chronological log of onboarding decisions and events.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if events.length === 0}
				<p class="text-sm text-muted-foreground">No audit events recorded.</p>
			{:else}
				<div class="space-y-3">
					{#each events as evt (evt.id)}
						<div class="flex items-start gap-3 rounded-md border p-3">
							<Badge variant={eventVariant(evt.eventType)} class="mt-0.5 shrink-0">
								{eventLabel(evt.eventType)}
							</Badge>
							<div class="min-w-0 flex-1">
								{#if evt.prompt}
									<p class="text-sm font-medium">{evt.prompt}</p>
								{/if}
								{#if evt.answerText}
									<p class="text-sm text-muted-foreground">{evt.answerText}</p>
								{:else if evt.answer}
									<p class="text-sm text-muted-foreground">{evt.answer}</p>
								{/if}
								<!-- {#if evt.factKey}
									<span class="mt-1 inline-block font-mono text-xs text-muted-foreground"
										>{evt.factKey}</span
									>
								{/if} -->
							</div>
							<span class="shrink-0 text-xs text-muted-foreground"
								>{formatTime(evt.created)}</span
							>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
