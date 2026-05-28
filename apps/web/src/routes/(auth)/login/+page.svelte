<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import OtpVerifyForm from '$lib/components/auth/OtpVerifyForm.svelte';
	import { RemoteSnapInputField } from '$lib/components/formComp/index.js';
	import { loadAuthMethods, requestOTP, signIn, verifyOTP } from '$lib/remote/auth.remote';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { CircleAlert, CircleCheck, Loader, Lock, Mail, Send } from '@lucide/svelte';

	const authMethods = await loadAuthMethods();

	let otpMode = $state<'idle' | 'request' | 'verify'>('idle');
	let otpEmail = $state<string | null>(null);
	let socialLoadingProvider = $state<string | null>(null);

	$effect(() => {
		if (signIn?.result?.success) {
			setTimeout(() => {
				goto('/');
			}, 200);
		}
	});

	$effect(() => {
		if (requestOTP?.result?.success && requestOTP?.result?.email) {
			otpEmail = requestOTP.result.email;
			otpMode = 'verify';
		}
	});

	$effect(() => {
		if (verifyOTP?.result?.success) {
			setTimeout(() => {
				goto('/');
			}, 200);
		}
	});

	function resetOtpFlow() {
		otpMode = 'idle';
		otpEmail = null;
	}

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

<svelte:head>
	<title>Sign In — Quant Orion</title>
</svelte:head>

<div class="space-y-5">
	<div class="text-center">
		<h1 class="text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
		<p class="mt-2 text-sm text-slate-500">Please enter your details to sign in</p>
	</div>

	{#if signIn.result && otpMode === 'idle'}
		<div
			class="flex items-start gap-3 rounded-lg border p-3.5 text-sm font-medium
				{signIn.result?.success
				? 'border-green-200 bg-green-50 text-green-700'
				: 'border-red-200 bg-red-50 text-red-700'}"
		>
			{#if signIn.result?.success}
				<CircleCheck class="mt-0.5 size-5 shrink-0" />
			{:else}
				<CircleAlert class="mt-0.5 size-5 shrink-0" />
			{/if}
			<p>{signIn.result?.message}</p>
		</div>
	{/if}

	{#if !authMethods?.email && !authMethods?.otp && (!authMethods?.oauth2 || authMethods?.oauth2?.length === 0)}
		<div
			class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-sm text-yellow-700"
		>
			<Lock class="mx-auto mb-2 size-8 text-yellow-500" />
			Login methods are currently unavailable. Please try again later or contact support.
		</div>
	{/if}

	{#if authMethods?.email && otpMode === 'idle'}
		<form {...signIn} class="space-y-5">
			<RemoteSnapInputField
				formAttributes={signIn}
				name="email"
				placeholder="you@example.com"
				label="Email address"
				type="email"
			/>

			<div>
				<div class="mb-1 flex items-center justify-between">
					<Label for="_password">Password</Label>
					<a
						href="/forgot-password"
						class="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
					>
						Forgot password?
					</a>
				</div>
				<RemoteSnapInputField
					formAttributes={signIn}
					name="_password"
					placeholder="••••••••"
					type="password"
				/>
			</div>

			<button
				type="submit"
				class="flex h-11 w-full items-center justify-center gap-x-2 rounded-full bg-[#1e8558] px-6 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-[#186e48] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
				disabled={!!signIn.pending}
			>
				{#if !!signIn.pending}
					<Loader class="size-4 animate-spin text-white/90" />
					Signing In...
				{:else}
					Sign In
					<svg viewBox="0 0 20 20" fill="currentColor" class="ml-1 h-5 w-5"
						><path
							fill-rule="evenodd"
							d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
							clip-rule="evenodd"
						/></svg
					>
				{/if}
			</button>
		</form>
	{/if}

	<!-- OTP Request Form -->
	{#if otpMode === 'request' && authMethods?.otp}
		{#if requestOTP?.result && !requestOTP?.result?.success}
			<div
				class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
			>
				<CircleAlert class="mt-0.5 size-5 shrink-0" />
				<span>{requestOTP?.result?.message}</span>
			</div>
		{/if}

		<form class="space-y-5" {...requestOTP}>
			<RemoteSnapInputField
				formAttributes={requestOTP}
				name="email"
				placeholder="you@example.com"
				label="Email address"
				type="email"
			/>
			<button
				type="submit"
				class="flex h-12 w-full items-center justify-center gap-x-2 rounded-full bg-[#1e8558] px-6 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-[#186e48] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:scale-[0.98] disabled:opacity-70"
				disabled={!!requestOTP.pending}
			>
				{#if !!requestOTP.pending}
					<Loader class="size-4 animate-spin text-white/90" />
					Sending Code...
				{:else}
					Send Code
					<Send class="ml-1 size-4" />
				{/if}
			</button>
		</form>

		<p class="text-center text-sm text-slate-500">
			We'll send a one-time verification code to your email.
		</p>

		<div class="flex w-full items-center justify-center gap-3">
			<div class="h-px flex-1 bg-slate-200"></div>
			<span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">or</span>
			<div class="h-px flex-1 bg-slate-200"></div>
		</div>

		<button
			type="button"
			onclick={resetOtpFlow}
			class="inline-flex h-12 w-full items-center justify-center gap-x-3 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
		>
			<Lock class="size-4 text-slate-500" />
			Sign in with password
		</button>
	{/if}

	<!-- OTP Verify Form -->
	{#if otpMode === 'verify' && authMethods?.otp && otpEmail}
		<OtpVerifyForm
			{verifyOTP}
			email={otpEmail}
			onResend={() => (otpMode = 'request')}
			onBack={resetOtpFlow}
			submitLabel="Verify & Sign In"
			backLabel="Back to login"
		/>
	{/if}

	{#if authMethods?.email && ((authMethods?.oauth2?.length ?? 0) > 0 || authMethods?.otp) && otpMode === 'idle'}
		<div class="relative py-2">
			<div class="absolute inset-0 flex items-center" aria-hidden="true">
				<div class="w-full border-t border-slate-200"></div>
			</div>
			<div class="relative flex justify-center">
				<span class="bg-gray-50 px-4 text-sm text-slate-500">Or continue with</span>
			</div>
		</div>
	{/if}

	{#if otpMode === 'idle'}
		<div class="space-y-3">
			{#if authMethods?.oauth2 && authMethods?.oauth2.length > 0}
				{#each authMethods?.oauth2 as provider (provider)}
					<button
						type="button"
						onclick={() => handleSocialSignIn(provider)}
						disabled={socialLoadingProvider !== null}
						class="inline-flex h-12 w-full items-center justify-center gap-x-3 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-70"
					>
						{#if provider === 'google'}
							<svg class="size-5" viewBox="0 0 24 24">
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</svg>
						{:else if provider === 'apple'}
							<svg class="size-5" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
								/>
							</svg>
						{:else if provider === 'microsoft'}
							<svg class="size-5" viewBox="0 0 24 24">
								<path d="M3 3h8.5v8.5H3z" fill="#F25022" />
								<path d="M12.5 3H21v8.5h-8.5z" fill="#7FBA00" />
								<path d="M3 12.5h8.5V21H3z" fill="#00A4EF" />
								<path d="M12.5 12.5H21V21h-8.5z" fill="#FFB900" />
							</svg>
						{:else}
							<svg
								class="size-5 text-slate-500"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="3" y="3" width="7" height="7" />
								<rect x="14" y="3" width="7" height="7" />
								<rect x="14" y="14" width="7" height="7" />
								<rect x="3" y="14" width="7" height="7" />
							</svg>
						{/if}
						Continue with {provider.charAt(0).toUpperCase() + provider.slice(1)}
						{#if socialLoadingProvider === provider}
							<Loader class="size-4 animate-spin text-slate-600/80" />
						{/if}
					</button>
				{/each}
			{/if}

			{#if authMethods?.otp}
				<button
					type="button"
					onclick={() => (otpMode = 'request')}
					class="inline-flex h-12 w-full items-center justify-center gap-x-3 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
				>
					<Mail class="size-5 text-slate-500" />
					Continue with email code
				</button>
			{/if}
		</div>

		<p class="mt-8 text-center text-sm text-slate-600">
			Don't have an account?
			<a href="/register" class="font-bold text-[#1e8558] hover:text-[#186e48] hover:underline">
				Register here!
			</a>
		</p>
	{/if}
</div>
