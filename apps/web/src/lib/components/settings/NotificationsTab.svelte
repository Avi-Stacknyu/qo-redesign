<script lang="ts">
	import { Bell, Mail, BarChart3, Clock } from '@lucide/svelte';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Switch } from '$lib/components/shadcn/switch/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';

	const notificationGroups = [
		{
			icon: Mail,
			label: 'Email Notifications',
			description: 'Receive important account alerts via email',
			enabled: true
		},
		{
			icon: BarChart3,
			label: 'Weekly Analytics Report',
			description: 'Get a weekly summary of your portfolio performance',
			enabled: false
		},
		{
			icon: Clock,
			label: 'Reminder Alerts',
			description: 'Push notifications for scheduled reminders',
			enabled: true
		},
		{
			icon: Bell,
			label: 'AI Insights',
			description: 'Notifications when AI detects opportunities or risks',
			enabled: false
		}
	];
</script>

<section class="space-y-6" aria-label="Notification settings">
	<div class="space-y-1">
		<h2 class="text-xl font-semibold tracking-tight text-foreground">Notifications</h2>
		<p class="text-sm text-muted-foreground">
			Control how and when Quant Orion communicates with you.
		</p>
	</div>

	<Card.Root
		class="relative overflow-hidden rounded-xl border-border/40 bg-card/90 shadow-lg backdrop-blur"
	>
		<!-- Coming Soon Overlay -->
		<div
			class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl bg-background/70 backdrop-blur-md"
		>
			<div class="relative">
				<div class="absolute inset-0 animate-pulse rounded-full bg-primary/10"></div>
				<div
					class="relative rounded-full border border-border/40 bg-card/90 p-4 shadow-lg backdrop-blur"
				>
					<Bell class="size-6 text-muted-foreground" />
				</div>
			</div>
			<div class="flex flex-col items-center gap-2">
				<Badge
					variant="secondary"
					class="rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide"
				>
					Coming Soon
				</Badge>
				<p class="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
					Notification preferences will be available in an upcoming release. We're building
					something thoughtful.
				</p>
			</div>
		</div>

		<!-- Blurred Placeholder Content -->
		<Card.Content class="p-6 opacity-30">
			<div class="space-y-1">
				{#each notificationGroups as group, i (group.label)}
					<div
						class="flex items-center justify-between gap-4 rounded-lg p-3 {i <
						notificationGroups.length - 1
							? 'border-b border-border/20'
							: ''}"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex size-8 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"
							>
								<group.icon class="size-4" />
							</div>
							<div>
								<Label class="text-sm font-medium text-foreground">{group.label}</Label>
								<p class="text-xs text-muted-foreground">{group.description}</p>
							</div>
						</div>
						<Switch checked={group.enabled} disabled />
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>
</section>
