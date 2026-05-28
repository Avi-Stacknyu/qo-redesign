<script lang="ts">
	import { Shield, Key, Smartphone, Monitor, Trash2, AlertTriangle, Lock } from '@lucide/svelte';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Separator } from '$lib/components/shadcn/separator/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';

	let { userEmail }: { userEmail: string } = $props();

	const securityItems = [
		{
			icon: Key,
			label: 'Change Password',
			description: 'Update your account password'
		},
		{
			icon: Smartphone,
			label: 'Two-Factor Authentication',
			description: 'Add an extra layer of security'
		},
		{
			icon: Monitor,
			label: 'Active Sessions',
			description: 'View and manage logged-in devices'
		}
	];
</script>

<section class="space-y-6" aria-label="Advanced settings">
	<div class="space-y-1">
		<h2 class="text-xl font-semibold tracking-tight text-foreground">Advanced</h2>
		<p class="text-sm text-muted-foreground">Security, data export, and account management.</p>
	</div>

	<!-- Security Section -->
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
					<Shield class="size-6 text-muted-foreground" />
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
					Enhanced security features including 2FA and session management are in development.
				</p>
			</div>
		</div>

		<Card.Content class="p-6 opacity-30">
			<div class="mb-5 flex items-center gap-2.5">
				<div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Lock class="size-4" />
				</div>
				<div>
					<h3 class="text-sm font-semibold text-foreground">Security</h3>
					<p class="text-xs text-muted-foreground">Protect your account</p>
				</div>
			</div>

			<div class="space-y-1">
				{#each securityItems as item, i (item.label)}
					<div
						class="flex items-center justify-between gap-4 rounded-lg p-3 {i <
						securityItems.length - 1
							? 'border-b border-border/20'
							: ''}"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex size-8 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"
							>
								<item.icon class="size-4" />
							</div>
							<div>
								<Label class="text-sm font-medium text-foreground">{item.label}</Label>
								<p class="text-xs text-muted-foreground">{item.description}</p>
							</div>
						</div>
						<Button variant="outline" size="sm" class="text-xs" disabled>Configure</Button>
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>

	<Separator class="bg-border/30" />

	<!-- Danger Zone -->
	<div class="space-y-1">
		<h2 class="text-lg font-semibold tracking-tight text-destructive">Danger Zone</h2>
		<p class="text-sm text-muted-foreground">Irreversible actions. Proceed with extreme caution.</p>
	</div>

	<Card.Root
		class="relative overflow-hidden rounded-xl border-destructive/20 bg-destructive/5 shadow-lg"
	>
		<div
			class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl bg-background/70 backdrop-blur-md"
		>
			<div class="relative">
				<div class="absolute inset-0 animate-pulse rounded-full bg-destructive/10"></div>
				<div
					class="relative rounded-full border border-border/40 bg-card/90 p-4 shadow-lg backdrop-blur"
				>
					<AlertTriangle class="size-6 text-muted-foreground" />
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
					Account deletion and danger-zone actions are in development.
				</p>
			</div>
		</div>

		<Card.Content class="p-6 opacity-30">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-start gap-3">
					<div
						class="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
					>
						<Trash2 class="size-5" />
					</div>
					<div>
						<h3 class="text-sm font-semibold text-foreground">Delete Account</h3>
						<p class="text-xs leading-relaxed text-muted-foreground">
							Permanently remove your account and all associated data. This action cannot be undone.
						</p>
						{#if userEmail}
							<p class="mt-1 text-[11px] text-muted-foreground/60">
								Logged in as <span class="font-medium">{userEmail}</span>
							</p>
						{/if}
					</div>
				</div>
				<Button variant="destructive" size="sm" class="shrink-0 gap-2 rounded-lg text-xs" disabled>
					<AlertTriangle class="size-3.5" />
					Delete Account
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
</section>
