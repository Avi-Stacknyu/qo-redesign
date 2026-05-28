<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { RemoteSnapInputField } from '$lib/components/formComp/index.js';
	import { Spinner } from '$lib/components/shadcn/spinner';
	import { loadAuthMethods, signIn } from '$lib/remote/auth.remote.js';
	import Icon from '@iconify/svelte';

	const authMethods = await loadAuthMethods();
	let socialLoadingProvider = $state<string | null>(null);

	$effect(() => {
		if (signIn?.result?.success) {
			setTimeout(() => {
				window.location.href = '/';
			}, 200);
		}
	});

	const loginContent = {
		title: 'Sign in to Quant xAI Admin',
		subtitle: 'Only authorized personnel allowed - IPs are monitored.',
		emailLabel: 'Email address',
		passwordLabel: 'Password',
		signInButton: 'Sign In',
		signingInButton: 'Signing In...',
		orContinueWith: 'Or continue with'
	};

	async function handleSocialSignIn(provider: string) {
		socialLoadingProvider = provider;
		try {
			await authClient.signIn.social({
				provider,
				callbackURL: `${window.location.origin}/`
			});
		} finally {
			socialLoadingProvider = null;
		}
	}
</script>

<div class=" relative flex flex-1 items-center justify-center p-6">
	<div
		aria-hidden="true"
		class="absolute inset-0 h-full w-full scale-[0.8] bg-[radial-gradient(var(--color-slate-200)_1px,transparent_1px)] mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,white_70%,transparent_100%)] bg-size-[16px_16px]"
	></div>

	<div class=" z-10 w-full max-w-sm space-y-8">
		<div class="text-center">
			<h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
				{loginContent?.title || 'Sign in to Quant xAI'}
			</h1>
			<p class="mt-2 text-sm text-slate-600">
				{loginContent?.subtitle || 'Get your AI-powered financial insights and strategies now!'}
			</p>
		</div>

		{#if signIn.result}
			<div
				class="flex items-start gap-3 rounded-lg border p-3.5
                    {signIn.result?.success
					? 'bg-black-50 border-green-200 text-green-700  '
					: 'border-red-200 bg-red-50 text-red-700'}"
			>
				<Icon
					icon={signIn.result?.success ? 'ph:check-circle-duotone' : 'ph:warning-octagon-duotone'}
					class="mt-0.5 size-5 shrink-0"
				/>
				<p class="text-sm font-medium">{signIn.result?.message}</p>
			</div>
		{/if}

		{#if !authMethods?.email && (!authMethods?.oauth2 || authMethods?.oauth2?.length === 0)}
			<div
				class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-sm text-yellow-700"
			>
				<Icon icon="ph:lock-key-duotone" class="mx-auto mb-2 size-8 text-yellow-500 " />
				Login methods are currently unavailable. Please try again later or contact support.
			</div>
		{/if}

		{#if authMethods?.email}
			<form {...signIn} class="admin-form-stack">
				<RemoteSnapInputField
					formAttributes={signIn}
					name="email"
					placeholder="you@example.com"
					label={loginContent?.emailLabel || 'Email address'}
					type="email"
				/>

				<RemoteSnapInputField
					formAttributes={signIn}
					name="password"
					placeholder="••••••••"
					label={loginContent?.passwordLabel || 'Password'}
					type="password"
				/>

				<button
					type="submit"
					class="flex h-11 w-full items-center justify-center gap-x-2 rounded-full bg-black/90 px-6 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(30,41,59,0.15)] transition-all duration-150 hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700 active:scale-[0.98] disabled:opacity-60"
					disabled={!!signIn.pending}
				>
					{#if !!signIn.pending}
						<Spinner className="size-4 text-white/80" />
						{loginContent?.signingInButton || 'Signing In...'}
					{:else}
						<Icon icon="ph:sign-in-bold" class="mr-1 size-5" />
						{loginContent?.signInButton || 'Sign In'}
					{/if}
				</button>
			</form>
		{/if}

		{#if authMethods?.email && authMethods?.oauth2 && authMethods?.oauth2.length > 0}
			<div class="my-6 flex items-center justify-center gap-2">
				<div class="w-[20%] border-t border-slate-300"></div>
				<span class="bg-transparent px-2 text-slate-500"
					>{loginContent?.orContinueWith || 'Or continue with'}</span
				>
				<div class="w-[20%] border-t border-slate-300"></div>
			</div>
		{/if}

		{#if authMethods?.oauth2 && authMethods?.oauth2.length > 0}
			<div class="space-y-3">
				{#each authMethods?.oauth2 as provider}
					<button
						type="button"
						onclick={() => handleSocialSignIn(provider)}
						disabled={socialLoadingProvider !== null}
						class=" inline-flex h-11 w-full items-center justify-center gap-x-3 rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition-colors duration-150 disabled:opacity-70"
					>
						{#if provider === 'google'}
							<Icon icon="logos:google-icon" class="size-5" />
						{:else if provider === 'apple'}
							<Icon icon="logos:apple" class="size-5" />
						{:else if provider === 'microsoft'}
							<Icon icon="logos:microsoft-icon" class="size-5" />
						{:else}
							<Icon icon="ph:identification-badge-duotone" class="size-5 text-slate-500 " />
						{/if}
						Continue with {provider}
						{#if socialLoadingProvider === provider}
							<Spinner className="size-4 text-slate-600/80" />
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
