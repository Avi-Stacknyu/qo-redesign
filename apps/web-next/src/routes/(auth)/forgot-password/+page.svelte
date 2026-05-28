<script lang="ts">
	import { RemoteSnapInputField } from '$lib/components/formComp/index.js';
	import { requestPasswordReset } from '$lib/remote/auth.remote';
	import { ArrowLeft, CircleAlert, Loader, Lock, Send } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Reset Password — Quant Orion</title>
</svelte:head>

<div class="space-y-8">
	<div class="text-center">
		<div class="mb-6 flex justify-center">
			<div
				class="flex size-14 items-center justify-center rounded-full border border-green-100 bg-green-50"
			>
				{#if requestPasswordReset?.result?.success}
					<Send class="size-6 text-[#7c3aed]" />
				{:else}
					<Lock class="size-6 text-[#7c3aed]" />
				{/if}
			</div>
		</div>
		<h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
			{requestPasswordReset?.result?.success ? 'Check Your Inbox' : 'Forgot Password?'}
		</h1>
		<p class="mt-2 text-sm text-slate-500">
			{requestPasswordReset?.result?.success
				? "If an account with that email exists, we've sent instructions to reset your password."
				: "Enter your email address and we'll send you a recovery link."}
		</p>
	</div>

	{#if requestPasswordReset?.result && !requestPasswordReset?.result?.success}
		<div
			class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
		>
			<CircleAlert class="mt-0.5 size-5 shrink-0" />
			<span>{requestPasswordReset?.result?.message}</span>
		</div>
	{/if}

	{#if !requestPasswordReset?.result?.success}
		<form {...requestPasswordReset} class="space-y-5">
			<RemoteSnapInputField
				formAttributes={requestPasswordReset}
				name="email"
				placeholder="you@example.com"
				label="Email address"
				type="email"
			/>
			<button
				type="submit"
				class="mt-2 flex h-11 w-full items-center justify-center gap-x-2 rounded-full bg-[#7c3aed] px-6 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-[#6d28d9] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 active:scale-[0.98] disabled:opacity-70"
				disabled={!!requestPasswordReset.pending}
			>
				{#if !!requestPasswordReset.pending}
					<Loader class="size-4 animate-spin text-white/90" />
					Sending Instructions...
				{:else}
					<Send class="size-4" />
					Send Reset Link
				{/if}
			</button>
		</form>

		<div class="mt-6 text-center">
			<p class="text-sm text-slate-600">
				Remember your password?
				<a href="/login" class="font-bold text-[#7c3aed] hover:text-[#6d28d9] hover:underline">
					Back to Login
				</a>
			</p>
		</div>
	{/if}

	<div class="text-center">
		<a
			href="/login"
			class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-[#7c3aed]"
		>
			<ArrowLeft class="size-4" />
			Back to Login
		</a>
	</div>
</div>
