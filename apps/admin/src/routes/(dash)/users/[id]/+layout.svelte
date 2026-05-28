<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Avatar from '$lib/components/shadcn/avatar';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import * as Dialog from '$lib/components/shadcn/dialog';
	import { Input } from '$lib/components/shadcn/input';
	import { Separator } from '$lib/components/shadcn/separator';
	import { Skeleton } from '$lib/components/shadcn/skeleton';
	import {
		ArrowLeft,
		Ban,
		BarChart3,
		Brain,
		ClipboardList,
		Cpu,
		FileText,
		History,
		KeyRound,
		LayoutDashboard,
		MessageSquare,
		Settings,
		Shield,
		Upload,
		Wallet
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import CreditManagementDialog from './credit-management-dialog.svelte';
	import { banUser, adminSetPassword, getUserDetails } from './user-details.remote';

	let { children } = $props();

	const userId = $derived(page.params.id ?? '');
	const userDetailsQuery = getUserDetails();
	const user = $derived(userDetailsQuery.current);

	let isCreditDialogOpen = $state(false);
	let isPasswordDialogOpen = $state(false);
	let newPassword = $state('');
	let settingPassword = $state(false);

	async function handleSetPassword() {
		if (!newPassword || newPassword.length < 8) {
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
				toast.error('Failed to set password');
			}
		} catch {
			toast.error('Failed to set password');
		} finally {
			settingPassword = false;
		}
	}

	const navItems = $derived([
		{ key: 'overview', label: 'Overview', route: '/(dash)/users/[id]' as const, icon: LayoutDashboard },
		{ key: 'profile', label: 'Profile', route: '/(dash)/users/[id]/profile' as const, icon: FileText },
		{ key: 'analytics', label: 'Analytics', route: '/(dash)/users/[id]/analytics' as const, icon: BarChart3 },
		{ key: 'chats', label: 'Chats', route: '/(dash)/users/[id]/chats' as const, icon: MessageSquare },
		{ key: 'memory', label: 'Memory', route: '/(dash)/users/[id]/memory' as const, icon: Brain },
		{
			key: 'onboarding',
			label: 'Onboarding',
			route: '/(dash)/users/[id]/onboarding' as const,
			icon: ClipboardList
		},
		{ key: 'usage', label: 'Usage', route: '/(dash)/users/[id]/usage' as const, icon: Cpu },
		{
			key: 'transactions',
			label: 'Transactions',
			route: '/(dash)/users/[id]/transactions' as const,
			icon: History
		},
		{
			key: 'tier-overrides',
			label: 'Tier Overrides',
			route: '/(dash)/users/[id]/tier-overrides' as const,
			icon: Shield
		},
		{ key: 'uploads', label: 'Uploads', route: '/(dash)/users/[id]/uploads' as const, icon: Upload },
		{ key: 'settings', label: 'Settings', route: '/(dash)/users/[id]/settings' as const, icon: Settings }
	]);

	const activeNav = $derived.by(() => {
		const pathname = page.url.pathname;
		const base = `/users/${userId}`;
		if (pathname === base || pathname === `${base}/`) return 'overview';
		const rest = pathname.slice(base.length + 1);
		return rest.split('/')[0] || 'overview';
	});

	const isDeepPage = $derived.by(() => {
		const pathname = page.url.pathname;
		const base = `/users/${userId}`;
		if (pathname === base || pathname === `${base}/`) return false;
		const rest = pathname.slice(base.length + 1);
		return rest.split('/').filter(Boolean).length > 1;
	});
</script>

{#if isDeepPage}
	{@render children()}
{:else}
	<div class="flex flex-col">
		{#if userDetailsQuery.loading}
			<div class="flex items-center gap-3 px-6 py-3">
				<Skeleton class="h-9 w-9 rounded-full" />
				<div class="space-y-1.5">
					<Skeleton class="h-4 w-36" />
					<Skeleton class="h-3 w-24" />
				</div>
			</div>
		{:else if userDetailsQuery.error}
			<div class="px-6 py-3">
				<p class="text-sm text-destructive">Error: {userDetailsQuery.error.message}</p>
			</div>
		{:else if user}
			<!-- Compact header: back + identity + actions all in one row -->
			<div class="flex items-center gap-3 px-6 py-3">
				<a
					href={resolve('/users')}
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
				>
					<ArrowLeft class="h-4 w-4" />
				</a>
				<Avatar.Root class="h-8 w-8">
					<Avatar.Image src={user.avatarUrl ?? ''} alt={user.name} />
					<Avatar.Fallback class="text-xs font-medium">
						{user.name?.slice(0, 2).toUpperCase() || 'U'}
					</Avatar.Fallback>
				</Avatar.Root>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-1.5">
						<span class="truncate text-sm font-semibold">{user.name || 'Unnamed'}</span>
						<Badge
							variant={user.accountStatus === 'active' ? 'default' : 'destructive'}
							class="text-[10px] leading-none"
						>
							{user.accountStatus}
						</Badge>
						{#if user.plan}
							<Badge variant="secondary" class="text-[10px] leading-none">
								{user.plan.title}
							</Badge>
						{/if}
					</div>
					<p class="truncate text-xs text-muted-foreground">
						{user.email}
						<span class="mx-1 opacity-30">·</span>
						<span class="font-mono text-[10px]">{user.id}</span>
					</p>
				</div>

				<!-- Inline actions -->
				<div class="flex shrink-0 items-center gap-1.5">
					<Button
						variant="outline"
						size="sm"
						class="h-7 gap-1.5 text-xs"
						onclick={() => (isCreditDialogOpen = true)}
					>
						<Wallet class="h-3 w-3" />
						Credits
					</Button>
					<Button
						variant="outline"
						size="sm"
						class="h-7 gap-1.5 text-xs"
						onclick={() => (isPasswordDialogOpen = true)}
					>
						<KeyRound class="h-3 w-3" />
						Set / Reset Password
					</Button>
					<form
						{...banUser.enhance(async ({ submit }) => {
							if (!confirm(`${user.accountStatus === 'active' ? 'Ban' : 'Unban'} this user?`))
								return;
							try {
								await submit().updates(userDetailsQuery);
								toast.success(`User ${user.accountStatus === 'active' ? 'banned' : 'unbanned'}`);
							} catch {
								toast.error('Failed to update status');
							}
						})}
						class="inline-flex"
					>
						<input type="hidden" name="userId" value={userId} />
						<input
							type="hidden"
							name="banned"
							value={user.accountStatus === 'active' ? 'true' : 'false'}
						/>
						<Button
							type="submit"
							size="sm"
							variant={user.accountStatus === 'active' ? 'destructive' : 'default'}
							disabled={!!banUser.pending}
							class="h-7 gap-1.5 text-xs"
						>
							<Ban class="h-3 w-3" />
							{user.accountStatus === 'active' ? 'Ban' : 'Unban'}
						</Button>
					</form>
				</div>
			</div>

			<!-- Tab navigation -->
			<nav class="flex gap-0.5 overflow-x-auto px-6" aria-label="User sections">
				{#each navItems as item (item.key)}
					{@const active = item.key === activeNav}
					<a
						href={resolve(item.route, { id: userId })}
						data-sveltekit-noscroll
						class="relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors
							{active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
					>
						<item.icon class="h-3.5 w-3.5" />
						{item.label}
						{#if active}
							<span class="absolute right-3 bottom-0 left-3 h-0.5 rounded-full bg-primary"></span>
						{/if}
					</a>
				{/each}
			</nav>
			<Separator />
		{/if}

		<!-- Uniform content wrapper for all sub-routes -->
		<div class="flex-1 py-4">
			{@render children()}
		</div>
	</div>

	{#if user}
		<CreditManagementDialog
			bind:open={isCreditDialogOpen}
			{userId}
			onsuccess={() => userDetailsQuery.refresh()}
		/>

		<Dialog.Root bind:open={isPasswordDialogOpen}>
			<Dialog.Content class="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>Set or Reset Password</Dialog.Title>
					<Dialog.Description>
						Create or replace the email/password login for {user.name || user.email}.
					</Dialog.Description>
				</Dialog.Header>
				<div class="space-y-4 py-4">
					<Input
						type="password"
						placeholder="New password (min 8 characters)"
						bind:value={newPassword}
						onkeydown={(e) => { if (e.key === 'Enter') handleSetPassword(); }}
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
	{/if}
{/if}
