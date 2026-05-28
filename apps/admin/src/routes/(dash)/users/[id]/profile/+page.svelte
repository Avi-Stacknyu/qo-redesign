<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/shadcn/button';
	import * as Card from '$lib/components/shadcn/card';
	import * as Dialog from '$lib/components/shadcn/dialog';
	import { Input } from '$lib/components/shadcn/input';
	import { Skeleton } from '$lib/components/shadcn/skeleton';
	import { Download, FileText, AlertCircle, KeyRound } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { marked } from 'marked';
	import { adminSetPassword, getUserProfileMarkdown } from '../user-details.remote';

	const userId = $derived(page.params.id ?? '');
	const profileQuery = getUserProfileMarkdown();
	const markdown = $derived(profileQuery.current?.markdown ?? '');
	let isPasswordDialogOpen = $state(false);
	let newPassword = $state('');
	let settingPassword = $state(false);

	marked.setOptions({ breaks: true, gfm: true });
	const renderedContent = $derived(markdown ? marked.parse(markdown) : '');

	function downloadMarkdown() {
		if (!markdown) return;
		const blob = new Blob([markdown], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${userId}_profile.md`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success('Downloaded Profile.md');
	}

	async function handleSetPassword() {
		if (newPassword.length < 8) {
			toast.error('Password must be at least 8 characters');
			return;
		}
		settingPassword = true;
		try {
			const result = await adminSetPassword({ userId, password: newPassword });
			if (result?.success) {
				toast.success('Password updated');
				newPassword = '';
				isPasswordDialogOpen = false;
			} else {
				toast.error('Failed to update password');
			}
		} catch {
			toast.error('Failed to update password');
		} finally {
			settingPassword = false;
		}
	}
</script>

<div class="space-y-4 px-6">
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<div>
					<Card.Title class="flex items-center gap-2">
						<FileText class="h-5 w-5" />
						Profile Data
					</Card.Title>
					<Card.Description>Structured profile compiled from profiler data</Card.Description>
				</div>
				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" onclick={() => (isPasswordDialogOpen = true)}>
						<KeyRound class="mr-2 h-4 w-4" />
						Set / Reset Password
					</Button>
					<Button
						variant="default"
						size="sm"
						disabled={!markdown || profileQuery.loading}
						onclick={downloadMarkdown}
					>
						<Download class="mr-2 h-4 w-4" />
						Download .md
					</Button>
				</div>
			</div>
		</Card.Header>
		<Card.Content>
			{#if profileQuery.loading}
				<div class="space-y-4">
					<Skeleton class="h-8 w-3/4" />
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-2/3" />
					<div class="pt-4">
						<Skeleton class="h-6 w-1/2" />
						<Skeleton class="mt-2 h-4 w-full" />
						<Skeleton class="mt-1 h-4 w-full" />
					</div>
				</div>
			{:else if profileQuery.error}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<AlertCircle class="mb-3 h-10 w-10 text-destructive/50" />
					<p class="text-sm font-medium text-destructive">Failed to load profile data</p>
					<p class="mt-1 text-xs text-muted-foreground">{profileQuery.error.message}</p>
				</div>
			{:else if markdown}
				<article class="prose prose-sm max-w-none dark:prose-invert">
					{@html renderedContent}
				</article>
			{:else}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<FileText class="mb-3 h-10 w-10 text-muted-foreground/30" />
					<p class="text-sm text-muted-foreground">No profile data collected yet</p>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Dialog.Root bind:open={isPasswordDialogOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>Set or Reset Password</Dialog.Title>
				<Dialog.Description>
					Create or replace the email/password login for this user.
				</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4 py-4">
				<Input
					type="password"
					placeholder="New password (min 8 characters)"
					bind:value={newPassword}
					onkeydown={(event) => {
						if (event.key === 'Enter') handleSetPassword();
					}}
				/>
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (isPasswordDialogOpen = false)}>Cancel</Button>
				<Button onclick={handleSetPassword} disabled={settingPassword || newPassword.length < 8}>
					{settingPassword ? 'Saving...' : 'Save Password'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
