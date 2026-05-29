<script lang="ts">
  import { goto } from '$app/navigation';
  import { authClient } from '$lib/auth-client';
  import OtpVerifyForm from '$lib/components/auth/OtpVerifyForm.svelte';
  import { RemoteSnapInputField } from '$lib/components/formComp/index.js';
  import { loadAuthMethods, requestOTP, signUp, verifyOTP } from '$lib/remote/auth.remote';
  import { CircleAlert, CircleCheck, Loader, Lock, Mail, Send } from '@lucide/svelte';

  const authMethods = await loadAuthMethods();

  let otpMode = $state<'idle' | 'request' | 'verify'>('idle');
  let otpEmail = $state<string | null>(null);
  let socialLoadingProvider = $state<string | null>(null);

  $effect(() => {
    if (signUp?.result?.success) {
      setTimeout(() => {
        goto('/login');
      }, 500);
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
  <title>Create Account — Quant Orion</title>
</svelte:head>

<div class="w-full max-w-lg mx-auto">
  <!-- HEADING -->
  <div class="mb-8 text-center">
    <h1 class="text-[40px] font-semibold tracking-[-0.03em] text-white">Create your account</h1>
    <p class="mt-2 text-sm leading-relaxed text-slate-400">
      Get your AI-powered financial insights and strategies now!
    </p>
  </div>

  <!-- SUCCESS / ERROR -->
  {#if signUp?.result && otpMode === 'idle'}
    <div
      class={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
        signUp.result.success
          ? 'border-green-500/30 bg-green-500/10 text-green-400'
          : 'border-red-500/30 bg-red-500/10 text-red-400'
      }`}
    >
      {#if signUp.result.success}
        <CircleCheck class="mt-0.5 size-5 shrink-0" />
      {:else}
        <CircleAlert class="mt-0.5 size-5 shrink-0" />
      {/if}
      <p>{signUp.result.message}</p>
    </div>
  {/if}

  {#if !authMethods?.email && !authMethods?.otp && (!authMethods?.oauth2 || authMethods?.oauth2?.length === 0)}
    <div
      class="mb-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center text-sm text-yellow-400"
    >
      <Lock class="mx-auto mb-2 size-8 text-yellow-500" />
      Registration methods are currently unavailable. Please try again later or contact support.
    </div>
  {/if}

  <!-- EMAIL SIGN UP FORM -->
  {#if authMethods?.email && otpMode === 'idle'}
    <form {...signUp} class="space-y-5">
      <div class="space-y-2">
        <label for="name" class="block text-[13px] font-medium text-slate-300">Full name</label>
        <RemoteSnapInputField
          formAttributes={signUp}
          name="name"
          placeholder="John Doe"
          type="text"
        />
      </div>

      <div class="space-y-2">
        <label for="email" class="block text-[13px] font-medium text-slate-300">Work email</label>
        <RemoteSnapInputField
          formAttributes={signUp}
          name="email"
          placeholder="you@example.com"
          type="email"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label for="_password" class="block text-[13px] font-medium text-slate-300"
            >Password</label
          >
          <RemoteSnapInputField
            formAttributes={signUp}
            name="_password"
            placeholder="••••••••"
            type="password"
          />
        </div>
        <div class="space-y-2">
          <label for="_passwordConfirm" class="block text-[13px] font-medium text-slate-300"
            >Confirm</label
          >
          <RemoteSnapInputField
            formAttributes={signUp}
            name="_passwordConfirm"
            placeholder="••••••••"
            type="password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!!signUp.pending}
        class="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-[#35bcbf] text-sm font-semibold text-slate-900 transition-all hover:bg-[#5fb9b0] disabled:opacity-70 cursor-pointer"
      >
        {#if !!signUp.pending}
          <Loader class="mr-2 size-4 animate-spin" />
          Registering...
        {:else}
          Create Account
        {/if}
      </button>
    </form>
  {/if}

  <!-- OTP REQUEST -->
  {#if otpMode === 'request' && authMethods?.otp}
    {#if requestOTP?.result && !requestOTP?.result?.success}
      <div
        class="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
      >
        <CircleAlert class="mt-0.5 size-5 shrink-0" />
        <span>{requestOTP?.result?.message}</span>
      </div>
    {/if}

    <form class="space-y-5" {...requestOTP}>
      <div class="space-y-2">
        <label class="block text-[13px] font-medium text-slate-300">Email address</label>
        <RemoteSnapInputField
          formAttributes={requestOTP}
          name="email"
          placeholder="you@example.com"
          type="email"
        />
      </div>
      <button
        type="submit"
        disabled={!!requestOTP.pending}
        class="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-900 transition-all hover:bg-slate-100 disabled:opacity-70"
      >
        {#if !!requestOTP.pending}
          <Loader class="mr-2 size-4 animate-spin" />
          Sending Code...
        {:else}
          Send Code
          <Send class="ml-2 size-4" />
        {/if}
      </button>
    </form>

    <p class="mt-4 text-center text-sm text-slate-400">
      We'll send a one-time verification code to your email.
    </p>

    <button
      type="button"
      onclick={resetOtpFlow}
      class="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-slate-200 transition-all hover:bg-white/10"
    >
      <Mail class="size-4" />
      Sign up with email &amp; password
    </button>
  {/if}

  <!-- OTP VERIFY -->
  {#if otpMode === 'verify' && authMethods?.otp && otpEmail}
    <div class="mt-4">
      <OtpVerifyForm
        {verifyOTP}
        email={otpEmail}
        onResend={() => (otpMode = 'request')}
        onBack={resetOtpFlow}
        submitLabel="Verify & Create Account"
        backLabel="Back to sign up"
      />
    </div>
  {/if}

  <!-- SOCIAL -->
  {#if otpMode === 'idle'}
    <div class="mt-10">
      {#if authMethods?.email && ((authMethods?.oauth2?.length ?? 0) > 0 || authMethods?.otp)}
        <div class="mb-6 flex items-center gap-4">
          <div class="flex-1 border-t border-white/10"></div>
          <span class="text-xs text-slate-500">Or continue with</span>
          <div class="flex-1 border-t border-white/10"></div>
        </div>
      {/if}

      <div class="space-y-3">
        {#if authMethods?.oauth2 && authMethods?.oauth2.length > 0}
          {#each authMethods?.oauth2 as provider (provider)}
            <button
              type="button"
              onclick={() => handleSocialSignIn(provider)}
              disabled={socialLoadingProvider !== null}
              class="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-all hover:bg-white/10 disabled:opacity-70"
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
                    d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09z"
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
                <Mail class="size-5 text-neutral-500" />
              {/if}
              Continue with {provider.charAt(0).toUpperCase() + provider.slice(1)}
              {#if socialLoadingProvider === provider}
                <Loader class="size-4 animate-spin" />
              {/if}
            </button>
          {/each}
        {/if}

        {#if authMethods?.otp}
          <button
            type="button"
            onclick={() => (otpMode = 'request')}
            class="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-all hover:bg-white/10"
          >
            <Mail class="size-5 text-slate-400" />
            Continue with email code
          </button>
        {/if}
      </div>
    </div>

    <!-- FOOTER -->
    <p class="mt-10 text-center text-[13px] leading-relaxed text-slate-400">
      Already have an account?
      <a href="/login" class="font-semibold text-white underline underline-offset-2"> Sign in </a>
    </p>
  {/if}
</div>
