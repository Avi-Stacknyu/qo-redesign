<script lang="ts">
	import { Button } from '$lib/components/shadcn/button/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { ImageIcon, Trash2, Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';

	import {
		getAgentSettings,
		uploadAvatarAction,
		deleteAvatarAction
	} from './agent-settings.remote';

	let { agentId } = $props<{ agentId: string }>();

	const settingsQuery = $derived(getAgentSettings(agentId));
	const settingsData = $derived(settingsQuery.current);
	let avatarUrl = $derived(settingsData?.avatar_url);

	let previewUrl = $state<string | null>(null);
	let isUploading = $state(false);
	let isDeleting = $state(false);

	let displayUrl = $derived(previewUrl ?? avatarUrl);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<ImageIcon class="h-5 w-5" />
			Agent Avatar
		</Card.Title>
		<Card.Description>Upload a circular avatar image (max 2MB, jpg/png/webp/svg)</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
		<!-- Preview -->
		<div class="flex items-center gap-6">
			{#if displayUrl}
				<img
					src={displayUrl}
					alt="Agent avatar"
					class="h-20 w-20 rounded-full border object-cover"
				/>
			{:else}
				<div
					class="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed bg-muted"
				>
					<ImageIcon class="h-8 w-8 text-muted-foreground" />
				</div>
			{/if}

			<div class="space-y-2">
				<!-- Upload form -->
				<form
					{...uploadAvatarAction.enhance(async ({ submit }) => {
						isUploading = true;
						await submit();
						if (uploadAvatarAction.result?.success) {
							toast.success('Avatar uploaded');
							previewUrl = null;
							await invalidateAll();
							settingsQuery.refresh();
						} else {
							toast.error(uploadAvatarAction.result?.error || 'Upload failed');
						}
						isUploading = false;
					})}
					enctype="multipart/form-data"
				>
					<input type="hidden" name="agentId" value={agentId} />
					<input
						name="avatar"
						type="file"
						accept="image/jpeg,image/png,image/webp,image/svg+xml"
						class="hidden"
						id="avatar-input"
						onchange={(e) => {
							const input = e.currentTarget as HTMLInputElement;
							const file = input.files?.[0];
							if (file) {
								previewUrl = URL.createObjectURL(file);
							}
						}}
					/>
					<div class="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => document.getElementById('avatar-input')?.click()}
							disabled={isUploading}
						>
							Choose File
						</Button>
						{#if previewUrl}
							<Button type="submit" size="sm" disabled={isUploading}>
								{#if isUploading}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{/if}
								Upload
							</Button>
						{/if}
					</div>
				</form>

				<!-- Delete button -->
				{#if avatarUrl && !previewUrl}
					<Button
						variant="ghost"
						size="sm"
						class="text-destructive hover:text-destructive"
						disabled={isDeleting}
						onclick={async () => {
							isDeleting = true;
							try {
								await deleteAvatarAction({ agentId });
								toast.success('Avatar removed');
								await invalidateAll();
								settingsQuery.refresh();
							} catch {
								toast.error('Failed to remove avatar');
							} finally {
								isDeleting = false;
							}
						}}
					>
						{#if isDeleting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{:else}
							<Trash2 class="mr-2 h-4 w-4" />
						{/if}
						Remove avatar
					</Button>
				{/if}
			</div>
		</div>
	</Card.Content>
</Card.Root>
