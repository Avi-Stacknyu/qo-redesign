<script lang="ts">
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { ArrowRight, CircleCheck } from '@lucide/svelte';
</script>

<div class="space-y-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>What Are Attributes?</Card.Title>
			<Card.Description>
				Attributes are <strong>variables that get injected into agent prompts</strong> at runtime. They
				personalize agent behavior for each user.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="rounded-lg border bg-muted/30 p-4">
				<div class="flex items-center gap-3">
					<div class="flex-1 rounded border bg-background p-3">
						<p class="mb-1 text-xs font-medium text-muted-foreground">Agent prompt contains</p>
						<p class="font-mono text-sm">
							You are helping a user in <Badge variant="outline">{'{{residence_country}}'}</Badge>
						</p>
					</div>
					<ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" />
					<div class="flex-1 rounded border bg-background p-3">
						<p class="mb-1 text-xs font-medium text-muted-foreground">At runtime becomes</p>
						<p class="font-mono text-sm">
							You are helping a user in <Badge variant="secondary">India</Badge>
						</p>
					</div>
				</div>
			</div>
			<p class="text-sm text-muted-foreground">
				The flow editor uses <code class="rounded bg-muted px-1.5 py-0.5 text-sm"
					>{'{{placeholder}}'}</code
				>
				syntax in agent prompts. Each placeholder maps to an attribute defined here. At runtime, the system
				resolves the actual value and injects it into the prompt.
			</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Attribute Sources</Card.Title>
			<Card.Description>
				Each attribute pulls its value from a specific source at runtime.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-3">
				<div class="flex items-start gap-3 rounded-lg border p-3">
					<Badge variant="secondary" class="mt-0.5 shrink-0">User Fact</Badge>
					<div>
						<p class="text-sm font-medium">From Graph Memory</p>
						<p class="text-xs text-muted-foreground">
							Value stored during onboarding or conversations. Example:
							<code class="rounded bg-muted px-1 text-xs">residence_country</code> → "India". This is
							the most common source — stable, user-specific data.
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg border p-3">
					<Badge variant="secondary" class="mt-0.5 shrink-0">CF Header</Badge>
					<div>
						<p class="text-sm font-medium">From Cloudflare Request Headers</p>
						<p class="text-xs text-muted-foreground">
							Live request data like IP country, timezone. <strong>Changes when user travels</strong
							>. Use sparingly — prefer User Fact for stable values like residence country.
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg border p-3">
					<Badge variant="secondary" class="mt-0.5 shrink-0">Client Provided</Badge>
					<div>
						<p class="text-sm font-medium">From Frontend Request</p>
						<p class="text-xs text-muted-foreground">
							Values sent by the client app in request headers (e.g. timezone, locale).
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg border p-3">
					<Badge variant="secondary" class="mt-0.5 shrink-0">Explicit</Badge>
					<div>
						<p class="text-sm font-medium">System Values</p>
						<p class="text-xs text-muted-foreground">
							Direct system paths like <code class="rounded bg-muted px-1 text-xs">user.id</code> or
							<code class="rounded bg-muted px-1 text-xs">user.email</code>. Always available.
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg border p-3">
					<Badge variant="secondary" class="mt-0.5 shrink-0">Derived</Badge>
					<div>
						<p class="text-sm font-medium">Computed from Other Attributes</p>
						<p class="text-xs text-muted-foreground">
							Calculated at runtime from other resolved attributes. Useful for combining or
							transforming values.
						</p>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Allowed Usages</Card.Title>
			<Card.Description>
				Each attribute declares where it can be used in the system.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-2 gap-3">
				<div class="rounded-lg border p-3">
					<Badge variant="outline" class="mb-2">prompt_injection</Badge>
					<p class="text-xs text-muted-foreground">
						Injected into agent prompts via <code class="rounded bg-muted px-1 text-xs"
							>{'{{key}}'}</code
						>
						placeholders. This is the primary use case — enables personalized agent behavior.
					</p>
				</div>
				<div class="rounded-lg border p-3">
					<Badge variant="outline" class="mb-2">notifications</Badge>
					<p class="text-xs text-muted-foreground">
						Available for notification templates and scheduling logic.
					</p>
				</div>
				<div class="rounded-lg border p-3">
					<Badge variant="outline" class="mb-2">compliance</Badge>
					<p class="text-xs text-muted-foreground">
						Used for regulatory compliance checks and data residency rules.
					</p>
				</div>
				<div class="rounded-lg border p-3">
					<Badge variant="outline" class="mb-2">analytics</Badge>
					<p class="text-xs text-muted-foreground">
						Available for analytics segmentation and reporting.
					</p>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Step-by-Step: Adding a Prompt Variable</Card.Title>
			<Card.Description
				>How to make a new <code class="rounded bg-muted px-1 text-xs">{'{{placeholder}}'}</code> available
				in agent prompts.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<ol class="space-y-3">
				<li class="flex items-start gap-3">
					<span
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
						>1</span
					>
					<div>
						<p class="text-sm font-medium">Create the attribute here</p>
						<p class="text-xs text-muted-foreground">
							Set the <strong>attribute key</strong> (e.g.
							<code class="rounded bg-muted px-1">preferred_language</code>), choose a source type,
							and enable <code class="rounded bg-muted px-1">prompt_injection</code> usage.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
						>2</span
					>
					<div>
						<p class="text-sm font-medium">Use in agent prompt</p>
						<p class="text-xs text-muted-foreground">
							In the flow editor, add <code class="rounded bg-muted px-1"
								>{'{{preferred_language}}'}</code
							> anywhere in the agent's system prompt. The attribute key must match exactly.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<CircleCheck class="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
					<div>
						<p class="text-sm font-medium">Done — value resolves at runtime</p>
						<p class="text-xs text-muted-foreground">
							When a user chats, the system resolves the attribute from its source and injects it
							before the prompt reaches the AI model.
						</p>
					</div>
				</li>
			</ol>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Attributes vs Tags</Card.Title>
			<Card.Description
				>These are two separate systems that serve different purposes.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-2 gap-4">
				<div class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
					<p class="mb-1 text-sm font-semibold text-amber-600">Attributes (this page)</p>
					<p class="text-xs text-muted-foreground">
						Control <strong>what gets injected into agent prompts</strong>. Variables like
						<code class="rounded bg-muted px-1 text-xs">{'{{residence_country}}'}</code> are resolved
						at runtime. Used for personalization — does not affect which agents a user can see.
					</p>
				</div>
				<div class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
					<p class="mb-1 text-sm font-semibold text-blue-600">Tags (Tags page)</p>
					<p class="text-xs text-muted-foreground">
						Control <strong>who can see which agents</strong>. Simple AND logic — user must have all
						required tags. Used for access gating, not prompt personalization.
					</p>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
