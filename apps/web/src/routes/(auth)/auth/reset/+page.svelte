<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleCheck, CircleAlert, ArrowLeft, KeyRound, Loader } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form: formResult }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Reset Password — Quant Orion</title>
</svelte:head>

<div class="space-y-8">
	<div class="text-center">
		<div class="mb-6 flex justify-center">
			<div
				class="flex size-14 items-center justify-center rounded-full border {formResult?.success
					? 'border-green-100 bg-green-50'
					: 'border-slate-100 bg-slate-50'}"
			>
				{#if formResult?.success}
					<CircleCheck class="size-6 text-[#1e8558]" />
				{:else}
					<KeyRound class="size-6 text-slate-600" />
				{/if}
			</div>
		</div>
		<h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
			{formResult?.success ? 'Password Reset' : 'Set New Password'}
		</h1>
		<p class="mt-2 text-sm text-slate-500">
			{formResult?.success
				? 'Your password has been updated. You can now sign in.'
				: 'Enter your new password below.'}
		</p>
	</div>

	{#if data.error}
		<div
			class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
		>
			<CircleAlert class="mt-0.5 size-5 shrink-0" />
			<span>{data.error}</span>
		</div>
	{/if}

	{#if formResult && !formResult.success}
		<div
			class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
		>
			<CircleAlert class="mt-0.5 size-5 shrink-0" />
			<span>{formResult.message}</span>
		</div>
	{/if}

	{#if !formResult?.success && data.token}
		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update();
				};
			}}
			class="space-y-5"
		>
			<input type="hidden" name="token" value={data.token} />

			<div>
				<label for="password" class="mb-1.5 block text-sm font-medium text-slate-700">
					New Password
				</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					minlength={8}
					placeholder="••••••••"
					class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-[#1e8558] focus:ring-1 focus:ring-[#1e8558] focus:outline-none"
				/>
			</div>

			<div>
				<label for="passwordConfirm" class="mb-1.5 block text-sm font-medium text-slate-700">
					Confirm Password
				</label>
				<input
					id="passwordConfirm"
					name="passwordConfirm"
					type="password"
					required
					minlength={8}
					placeholder="••••••••"
					class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-[#1e8558] focus:ring-1 focus:ring-[#1e8558] focus:outline-none"
				/>
			</div>

			<button
				type="submit"
				disabled={submitting}
				class="mt-2 flex h-11 w-full items-center justify-center gap-x-2 rounded-full bg-[#1e8558] px-6 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-[#186e48] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:scale-[0.98] disabled:opacity-70"
			>
				{#if submitting}
					<Loader class="size-4 animate-spin text-white/90" />
					Resetting...
				{:else}
					<KeyRound class="size-4" />
					Reset Password
				{/if}
			</button>
		</form>
	{/if}

	<div class="text-center">
		<a
			href="/login"
			class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-[#1e8558]"
		>
			<ArrowLeft class="size-4" />
			Back to Login
		</a>
	</div>
</div>
