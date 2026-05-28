<script lang="ts">
	import * as InputOTP from '$lib/components/shadcn/input-otp/index.js';
	import { Loader2, LogIn, RotateCw, ArrowLeft, AlertCircle, CheckCircle2 } from '@lucide/svelte';

	interface Props {
		verifyOTP: any;
		email: string;
		onResend: () => void;
		onBack: () => void;
		submitLabel?: string;
		backLabel?: string;
	}

	let {
		verifyOTP,
		email,
		onResend,
		onBack,
		submitLabel = 'Verify & Sign In',
		backLabel = 'Back to login'
	}: Props = $props();

	let otpValue = $state('');

	let errorEmail = $state<string | null>(null);

	$effect(() => {
		if (verifyOTP?.result && !verifyOTP?.result?.success) {
			errorEmail = email;
		}
	});

	const showError = $derived(
		verifyOTP?.result && !verifyOTP?.result?.success && errorEmail === email
	);
</script>

{#if verifyOTP?.result?.success}
	<div
		class="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3.5 text-sm font-medium text-green-700"
	>
		<CheckCircle2 class="mt-0.5 size-5 shrink-0" />
		<span>{verifyOTP?.result?.message}</span>
	</div>
{:else if showError}
	<div
		class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
	>
		<AlertCircle class="mt-0.5 size-5 shrink-0" />
		<span>{verifyOTP?.result?.message}</span>
	</div>
{/if}

<form class="space-y-5" {...verifyOTP}>
	<input {...verifyOTP.fields.email.as('hidden', email)} />
	<input type="hidden" name="otp" value={otpValue} />

	<div class="space-y-2">
		<span class="block text-sm font-medium text-slate-700">Verification Code</span>
		<InputOTP.Root maxlength={6} bind:value={otpValue} class="w-full gap-2">
			{#snippet children({ cells })}
				<InputOTP.Group class="flex w-full">
					{#each cells.slice(0, 6) as cell (cell)}
						<InputOTP.Slot {cell} class="h-12 flex-1 bg-white text-lg shadow-sm" />
					{/each}
				</InputOTP.Group>
			{/snippet}
		</InputOTP.Root>
	</div>

	<button
		type="submit"
		class="mt-2 flex h-12 w-full items-center justify-center gap-x-2 rounded-full bg-[#1e8558] px-6 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-[#186e48] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
		disabled={!!verifyOTP.pending || otpValue.length < 6}
	>
		{#if !!verifyOTP.pending}
			<Loader2 class="size-4 animate-spin text-white/90" />
			Verifying...
		{:else}
			{submitLabel}
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

<p class="text-center text-sm text-slate-500">Check your email for the verification code.</p>

<div class="flex w-full items-center justify-center gap-3">
	<div class="h-px flex-1 bg-slate-200"></div>
	<span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">or</span>
	<div class="h-px flex-1 bg-slate-200"></div>
</div>

<div class="space-y-3">
	<button
		type="button"
		onclick={onResend}
		class="inline-flex h-12 w-full items-center justify-center gap-x-3 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
	>
		<RotateCw class="size-4 text-slate-500" />
		Resend code
	</button>
	<button
		type="button"
		onclick={onBack}
		class="inline-flex h-12 w-full items-center justify-center gap-x-3 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
	>
		<ArrowLeft class="size-4 text-slate-500" />
		{backLabel}
	</button>
</div>
