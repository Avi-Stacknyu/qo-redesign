<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import * as Table from '$lib/components/shadcn/table';
	import { getOnboardingProfiles } from './profiles.remote';

	const data = await getOnboardingProfiles();
	let profiles = $derived(data?.profiles ?? []);

	function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'archived':
				return 'outline';
			default:
				return 'secondary';
		}
	}

	function tagCount(value: unknown): number {
		return Array.isArray(value) ? value.length : 0;
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<div class="space-y-6 px-4 lg:px-6">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold tracking-tight">Onboarding Profiles</h2>
				<p class="text-muted-foreground">
					Manage industry-specific onboarding profiles generated from markdown specs.
				</p>
			</div>
			<Button href="/settings/onboarding/profiles/new">New Profile</Button>
		</div>
	</div>

	<div class="px-4 lg:px-6">
		{#if profiles.length === 0}
			<div class="flex flex-col items-center gap-3 py-12 text-center">
				<p class="text-sm text-muted-foreground">No profiles yet.</p>
				<Button href="/settings/onboarding/profiles/new" variant="outline">
					Create your first profile
				</Button>
			</div>
		{:else}
			<Table.Root class="table-fixed">
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[40%]">Name</Table.Head>
						<Table.Head>Industry</Table.Head>
						<Table.Head>Visibility</Table.Head>
						<Table.Head class="text-center">Default Tags</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head class="text-center">Questions</Table.Head>
						<Table.Head>Updated</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each profiles as profile (profile.id)}
						<Table.Row class="cursor-pointer">
							<Table.Cell class="max-w-0">
								<a
									href={resolve(`/settings/onboarding/profiles/${profile.id}`)}
									class="font-medium hover:underline"
								>
									{profile.name ?? 'Untitled'}
								</a>
								{#if profile.description}
									<p
										class="max-w-full truncate text-xs text-muted-foreground"
										title={profile.description}
									>
										{profile.description}
									</p>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{profile.industryKey ?? '—'}
							</Table.Cell>
							<Table.Cell>
								<Badge variant="outline">{profile.visibility ?? 'public'}</Badge>
							</Table.Cell>
							<Table.Cell class="text-center">
								{tagCount(profile.defaultTags)}
							</Table.Cell>
							<Table.Cell>
								<Badge variant={statusVariant(profile.status)}>
									{profile.status ?? 'draft'}
								</Badge>
							</Table.Cell>
							<Table.Cell class="text-center">
								{profile.questionCount ?? 0}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">
								{formatDate(profile.updated)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</div>
</div>
