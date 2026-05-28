<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import OnboardingShell from '$lib/components/onboarding/OnboardingShell.svelte';
	import { ArrowRight, CircleAlert, KeyRound, UserCircle } from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form: actionResult }: { data: PageData; form: ActionData } = $props();

	let isSubmitting = $state(false);
	const resumeOnboarding = $derived(data.resumeOnboarding ?? null);

	const error = $derived(
		actionResult && 'error' in actionResult
			? (actionResult.error as string)
			: data.error || undefined
	);
</script>

<svelte:head>
	<title>Get Started | Quant Orion</title>
</svelte:head>

<OnboardingShell currentStep={0} totalSteps={1}>
	<div class="mx-auto w-full max-w-lg space-y-8">
		<!-- Header -->
		<div class="text-center">
			{#if resumeOnboarding}
				<h1 class="text-2xl font-bold tracking-tight text-slate-900">Onboarding paused</h1>
				<p class="mt-2 text-sm text-slate-500">
					You chose not to continue right now. You can return to the disclosures whenever you are
					ready.
				</p>
			{:else}
				<h1 class="text-2xl font-bold tracking-tight text-slate-900">Welcome to Quant Orion</h1>
				<p class="mt-2 text-sm text-slate-500">
					Enter an invite code or choose a profile to get started.
				</p>
			{/if}
		</div>

		<!-- Error display -->
		{#if error && !resumeOnboarding}
			<div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
				<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
				<p class="text-sm font-medium text-red-700">{error}</p>
			</div>
		{/if}

		{#if resumeOnboarding}
			<div class="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
				<div class="mb-4 flex items-start gap-3">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"
					>
						<CircleAlert class="h-5 w-5" />
					</div>
					<div class="space-y-1">
						<h2 class="text-base font-semibold text-slate-900">{resumeOnboarding.profileName}</h2>
						{#if resumeOnboarding.profileDescription}
							<p class="text-sm text-slate-500">{resumeOnboarding.profileDescription}</p>
						{/if}
					</div>
				</div>
				<div
					class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
				>
					{resumeOnboarding.rejectMessage}
				</div>
				<div class="mt-5 flex flex-col gap-3 sm:flex-row">
					<Button href="/onboarding/run" class="sm:flex-1">
						Review disclosures again
						<ArrowRight class="ml-2 h-4 w-4" />
					</Button>
					<Button href="/" variant="outline" class="sm:flex-1">Not now</Button>
				</div>
			</div>
		{:else}
			<!-- Invite code form -->
			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="mb-4 flex items-center gap-2">
					<KeyRound class="h-5 w-5 text-violet-600" />
					<h2 class="text-base font-semibold text-slate-900">Have an invite code?</h2>
				</div>
				<form
					method="POST"
					action="?/applyInviteCode"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
						};
					}}
					class="flex gap-3"
				>
					<input
						type="text"
						name="code"
						value={data.inviteCode ?? ''}
						placeholder="Enter your code..."
						required
						class="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
					/>
					<Button type="submit" disabled={isSubmitting}>Apply</Button>
				</form>
			</div>

			<!-- Profile chooser -->
			{#if data.profiles && data.profiles.length > 0}
				<div class="space-y-4">
					<div class="flex items-center gap-2 px-1">
						<UserCircle class="h-5 w-5 text-slate-400" />
						<h2 class="text-base font-semibold text-slate-900">Or choose a profile</h2>
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each data.profiles as profile (profile.id)}
							<form method="POST" action="?/chooseProfile" use:enhance>
								<input type="hidden" name="profileId" value={profile.id} />
								<button
									type="submit"
									class="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-violet-200 hover:shadow-md hover:shadow-violet-100/50"
								>
									<h3 class="font-semibold text-slate-900">{profile.name}</h3>
									{#if profile.description}
										<p class="mt-1 text-xs text-slate-500">{profile.description}</p>
									{/if}
								</button>
							</form>
						{/each}
					</div>
				</div>
			{:else}
				<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 shadow-sm">
					<div class="flex items-start gap-3">
						<UserCircle class="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
						<div>
							<h2 class="text-base font-semibold text-slate-900">No active profiles available</h2>
							<p class="mt-1 text-sm text-slate-500">
								If you expected profile options here, an admin still needs to activate at least one
								onboarding profile. You can continue with an invite code, or contact your admin.
							</p>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</OnboardingShell>
