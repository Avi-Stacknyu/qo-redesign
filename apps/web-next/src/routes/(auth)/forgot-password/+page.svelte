<script lang="ts">
	import { RemoteSnapInputField } from '$lib/components/formComp/index.js';
	import { requestPasswordReset } from '$lib/remote/auth.remote';
	import { ArrowLeft, CircleAlert, Loader, Lock, Send } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Reset Password — Quant Orion</title>
</svelte:head>

<div class="w-full max-w-lg mx-auto">

  <!-- ICON + HEADING -->
  <div class="mb-8 text-center">
    <div class="mb-6 flex justify-center">
      <div class="flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
        {#if requestPasswordReset?.result?.success}
          <Send class="size-6 text-white" />
        {:else}
          <Lock class="size-6 text-white" />
        {/if}
      </div>
    </div>

    <h1 class="text-[40px] font-semibold tracking-[-0.03em] text-white">
      {requestPasswordReset?.result?.success ? 'Check your inbox' : 'Forgot password?'}
    </h1>
    <p class="mt-2 text-sm leading-relaxed text-slate-400">
      {requestPasswordReset?.result?.success
        ? "If an account with that email exists, we've sent instructions to reset your password."
        : "Enter your email address and we'll send you a recovery link."}
    </p>
  </div>

  <!-- ERROR BANNER -->
  {#if requestPasswordReset?.result && !requestPasswordReset?.result?.success}
    <div class="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
      <CircleAlert class="mt-0.5 size-5 shrink-0" />
      <span>{requestPasswordReset?.result?.message}</span>
    </div>
  {/if}

  <!-- FORM -->
  {#if !requestPasswordReset?.result?.success}
    <form {...requestPasswordReset} class="space-y-5">
      <div class="space-y-2">
        <label for="email" class="block text-[13px] font-medium text-slate-300">Email address</label>
        <RemoteSnapInputField
          formAttributes={requestPasswordReset}
          name="email"
          placeholder="you@example.com"
          type="email"
        
        />
      </div>

      <button
        type="submit"
        disabled={!!requestPasswordReset.pending}
        class="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-[#35bcbf] text-sm font-semibold text-slate-900 transition-all hover:bg-[#5fb9b0] disabled:opacity-70 cursor-pointer"
      >
        {#if !!requestPasswordReset.pending}
          <Loader class="size-4 animate-spin" />
          Sending Instructions...
        {:else}
          <Send class="size-4" />
          Send Reset Link
        {/if}
      </button>
    </form>
  {/if}

  <!-- FOOTER -->
  <p class="mt-10 text-center text-[13px] leading-relaxed text-slate-400">
    Remember your password?
    <a href="/login" class="font-semibold text-white underline underline-offset-2">
      Back to sign in
    </a>
  </p>
</div>
