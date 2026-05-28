<script lang="ts">
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { ArrowRight, Eye, EyeOff, CircleCheck } from '@lucide/svelte';
</script>

<div class="space-y-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>What Are Tags?</Card.Title>
			<Card.Description>
				Tags control <strong>which agents a user can see</strong>. They follow a
				<code class="rounded bg-muted px-1.5 py-0.5 text-sm">namespace:value</code> format.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div class="rounded-lg border p-4">
					<p class="mb-2 text-sm font-medium">Tier Tags</p>
					<p class="mb-2 text-xs text-muted-foreground">Gate agents by pricing plan</p>
					<div class="flex flex-wrap gap-1">
						<Badge variant="outline" class="bg-purple-500/10 text-purple-500">tier:free</Badge>
						<Badge variant="outline" class="bg-purple-500/10 text-purple-500">tier:pro</Badge>
						<Badge variant="outline" class="bg-purple-500/10 text-purple-500">tier:enterprise</Badge
						>
					</div>
				</div>
				<div class="rounded-lg border p-4">
					<p class="mb-2 text-sm font-medium">Geo Tags</p>
					<p class="mb-2 text-xs text-muted-foreground">Gate agents by user's country</p>
					<div class="flex flex-wrap gap-1">
						<Badge variant="outline" class="bg-blue-500/10 text-blue-500">geo:in</Badge>
						<Badge variant="outline" class="bg-blue-500/10 text-blue-500">geo:us</Badge>
						<Badge variant="outline" class="bg-blue-500/10 text-blue-500">geo:uk</Badge>
					</div>
				</div>
				<div class="rounded-lg border p-4">
					<p class="mb-2 text-sm font-medium">Role Tags</p>
					<p class="mb-2 text-xs text-muted-foreground">Gate agents by user's profession</p>
					<div class="flex flex-wrap gap-1">
						<Badge variant="outline" class="bg-amber-500/10 text-amber-500">role:doctor</Badge>
						<Badge variant="outline" class="bg-amber-500/10 text-amber-500">role:trader</Badge>
						<Badge variant="outline" class="bg-amber-500/10 text-amber-500">role:student</Badge>
					</div>
				</div>
				<div class="rounded-lg border p-4">
					<p class="mb-2 text-sm font-medium">Segment Tags</p>
					<p class="mb-2 text-xs text-muted-foreground">Custom admin-assigned segments</p>
					<div class="flex flex-wrap gap-1">
						<Badge variant="outline" class="bg-emerald-500/10 text-emerald-500">segment:vip</Badge>
						<Badge variant="outline" class="bg-emerald-500/10 text-emerald-500">segment:beta</Badge>
					</div>
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				Tags are always lowercase. You can create any namespace — the four above are built-in
				conventions. Custom namespaces like
				<code class="rounded bg-muted px-1">industry:fintech</code> work too.
			</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>How Visibility Works</Card.Title>
			<Card.Description>
				An agent is visible to a user only if the user has <strong>ALL</strong> of the agent's required
				tags (AND logic).
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="rounded-lg border bg-muted/30 p-4">
				<div class="flex items-center gap-3">
					<div class="flex-1 rounded border bg-background p-3">
						<p class="mb-1 text-xs font-medium text-muted-foreground">Agent requires</p>
						<div class="flex gap-1">
							<Badge variant="outline" class="bg-purple-500/10 text-purple-500">tier:pro</Badge>
							<Badge variant="outline" class="bg-blue-500/10 text-blue-500">geo:in</Badge>
						</div>
					</div>
					<ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" />
					<div class="flex-1 rounded border bg-background p-3">
						<p class="mb-1 text-xs font-medium text-muted-foreground">User has</p>
						<div class="flex gap-1">
							<Badge variant="outline" class="bg-purple-500/10 text-purple-500">tier:pro</Badge>
							<Badge variant="outline" class="bg-blue-500/10 text-blue-500">geo:in</Badge>
							<Badge variant="outline" class="bg-amber-500/10 text-amber-500">role:doctor</Badge>
						</div>
					</div>
					<ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" />
					<div class="flex items-center gap-1.5 text-sm font-medium text-green-600">
						<Eye class="h-4 w-4" />
						Visible
					</div>
				</div>
			</div>
			<div class="rounded-lg border bg-muted/30 p-4">
				<div class="flex items-center gap-3">
					<div class="flex-1 rounded border bg-background p-3">
						<p class="mb-1 text-xs font-medium text-muted-foreground">Agent requires</p>
						<div class="flex gap-1">
							<Badge variant="outline" class="bg-purple-500/10 text-purple-500">tier:pro</Badge>
							<Badge variant="outline" class="bg-blue-500/10 text-blue-500">geo:in</Badge>
						</div>
					</div>
					<ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" />
					<div class="flex-1 rounded border bg-background p-3">
						<p class="mb-1 text-xs font-medium text-muted-foreground">User has</p>
						<div class="flex gap-1">
							<Badge variant="outline" class="bg-purple-500/10 text-purple-500">tier:free</Badge>
							<Badge variant="outline" class="bg-blue-500/10 text-blue-500">geo:us</Badge>
						</div>
					</div>
					<ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" />
					<div class="flex items-center gap-1.5 text-sm font-medium text-red-500">
						<EyeOff class="h-4 w-4" />
						Hidden
					</div>
				</div>
			</div>
			<div class="space-y-2 text-xs text-muted-foreground">
				<p><strong>Special cases:</strong></p>
				<ul class="ml-4 list-disc space-y-1">
					<li>
						<strong>Universal agents</strong> — always visible regardless of tags (toggle in agent settings).
					</li>
					<li>
						<strong>No required tags + not universal</strong> — hidden from everyone. Either add tags
						or mark as universal.
					</li>
					<li>
						<strong>Extra user tags are ignored</strong> — user having
						<code class="rounded bg-muted px-1">role:doctor</code> doesn't affect an agent that only
						requires <code class="rounded bg-muted px-1">tier:pro</code>.
					</li>
				</ul>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Where Do Users Get Tags?</Card.Title>
			<Card.Description>
				A user's effective tag set is the union of tags from all three sources.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-3">
				<div class="flex items-start gap-3 rounded-lg border p-3">
					<Badge variant="secondary" class="mt-0.5 shrink-0">Plan</Badge>
					<div>
						<p class="text-sm font-medium">From their subscription plan</p>
						<p class="text-xs text-muted-foreground">
							Each plan has <code class="rounded bg-muted px-1 text-xs">granted_tags</code>. Pro
							plan grants
							<code class="rounded bg-muted px-1 text-xs">tier:free, tier:pro</code>. Enterprise
							adds
							<code class="rounded bg-muted px-1 text-xs">tier:enterprise</code>.
						</p>
						<p class="mt-1 text-xs text-muted-foreground">
							Configure in <strong>Settings → Plans</strong> → edit plan → Granted Tags.
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg border p-3">
					<Badge variant="secondary" class="mt-0.5 shrink-0">Onboarding</Badge>
					<div>
						<p class="text-sm font-medium">Auto-assigned during onboarding</p>
						<p class="text-xs text-muted-foreground">
							Country detected from IP → <code class="rounded bg-muted px-1 text-xs">geo:in</code>.
							Profession detected by AI →
							<code class="rounded bg-muted px-1 text-xs">role:doctor</code>.
						</p>
						<p class="mt-1 text-xs text-muted-foreground">
							Geo tags use the user's <em>residence at sign-up</em>, not their current travel
							location.
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg border p-3">
					<Badge variant="secondary" class="mt-0.5 shrink-0">Admin</Badge>
					<div>
						<p class="text-sm font-medium">Manually assigned by admin</p>
						<p class="text-xs text-muted-foreground">
							e.g. <code class="rounded bg-muted px-1 text-xs">segment:vip</code> or
							<code class="rounded bg-muted px-1 text-xs">segment:beta</code> for special access.
						</p>
						<p class="mt-1 text-xs text-muted-foreground">
							Assign in <strong>Users → select user → User Tags</strong>.
						</p>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Step-by-Step: Setting Up Tag-Based Visibility</Card.Title>
			<Card.Description
				>Common workflow for restricting an agent to a group of users.</Card.Description
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
						<p class="text-sm font-medium">Create the tag</p>
						<p class="text-xs text-muted-foreground">
							Add it in this Tag Catalog (e.g. <code class="rounded bg-muted px-1">tier:pro</code>).
							Choose the right namespace.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
						>2</span
					>
					<div>
						<p class="text-sm font-medium">Assign the tag to agents</p>
						<p class="text-xs text-muted-foreground">
							Go to <strong>Agents → agent detail → Settings → Visibility</strong> and add the tag
							as a required tag. Or use <strong>Agents list → select multiple → Set Tags</strong> for
							bulk assignment.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<span
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
						>3</span
					>
					<div>
						<p class="text-sm font-medium">Grant the tag to users</p>
						<p class="text-xs text-muted-foreground">
							For tier tags: go to <strong>Settings → Plans</strong> and add the tag to a plan's Granted
							Tags. For segment tags: assign directly on the user's profile.
						</p>
					</div>
				</li>
				<li class="flex items-start gap-3">
					<CircleCheck class="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
					<div>
						<p class="text-sm font-medium">Done — visibility is automatic</p>
						<p class="text-xs text-muted-foreground">
							When a user loads agents, the system computes their full tag set (plan + onboarding +
							admin) and shows only agents whose required tags are all satisfied.
						</p>
					</div>
				</li>
			</ol>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Tags vs Attributes</Card.Title>
			<Card.Description
				>These are two separate systems that serve different purposes.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-2 gap-4">
				<div class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
					<p class="mb-1 text-sm font-semibold text-blue-600">Tags (this page)</p>
					<p class="text-xs text-muted-foreground">
						Control <strong>who can see which agents</strong>. Simple AND logic — user must have all
						required tags. Used for access gating.
					</p>
				</div>
				<div class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
					<p class="mb-1 text-sm font-semibold text-amber-600">
						Attributes (Settings → Attributes)
					</p>
					<p class="text-xs text-muted-foreground">
						Control <strong>what gets injected into agent prompts</strong>. Variables like
						<code class="rounded bg-muted px-1 text-xs">{'{{residence_country}}'}</code> in agent prompts
						are resolved from attributes. Used for personalization, not access control.
					</p>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
