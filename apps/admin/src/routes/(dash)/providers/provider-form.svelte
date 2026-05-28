<script lang="ts">
	import { Input } from '$lib/components/shadcn/input';
	import { Button } from '$lib/components/shadcn/button';
	import { Label } from '$lib/components/shadcn/label';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import { Switch } from '$lib/components/shadcn/switch';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { saveProvider } from './provider.remote';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { AiProviderRow } from '@repo/db/types';

	let { parameter, onsuccess } = $props<{
		parameter: AiProviderRow | null;
		onsuccess?: () => void;
	}>();

	$effect(() => {
		if (parameter) {
			saveProvider.fields.set({
				id: parameter.id,
				provider_key: parameter.providerKey,
				display_name: parameter.displayName,
				env_key_name: parameter.envKeyName,
				base_url: parameter.baseUrl ?? '',
				docs_url: parameter.docsUrl ?? '',
				website_url: parameter.websiteUrl ?? '',
				default_headers: parameter.defaultHeaders
					? JSON.stringify(parameter.defaultHeaders, null, 2)
					: '',
				is_active: parameter.isActive ?? true
			});
		} else {
			saveProvider.fields.set({
				id: '',
				provider_key: '',
				display_name: '',
				env_key_name: '',
				base_url: '',
				docs_url: '',
				website_url: '',
				default_headers: '',
				is_active: true
			});
		}
	});
</script>

<form
	{...saveProvider.enhance(async ({ submit }) => {
		try {
			await submit();
			await invalidateAll();

			if (saveProvider.result?.success) {
				toast.success('Provider saved successfully');
				onsuccess?.();
			} else if (saveProvider.result?.error) {
				toast.error(saveProvider.result.error);
			}
		} catch (e) {
			toast.error((e as Error).message || 'Failed to save provider');
		}
	})}
	class="space-y-4"
>
	{#if saveProvider.result?.error}
		<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
			{saveProvider.result.error}
		</div>
	{/if}
	<input type="text" class="hidden" {...saveProvider.fields.id.as('text')} />

	<div class="grid grid-cols-2 gap-4">
		<div class="grid gap-2">
			<Label for="display_name">Display Name</Label>
			<Input
				{...saveProvider.fields.display_name.as('text')}
				id="display_name"
				placeholder="e.g. OpenAI"
			/>
			{#each saveProvider.fields.display_name.issues() as issue}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}
		</div>

		<div class="grid gap-2">
			<Label for="provider_key">Provider Key</Label>
			<Input
				{...saveProvider.fields.provider_key.as('text')}
				id="provider_key"
				placeholder="e.g. openai"
			/>
			{#each saveProvider.fields.provider_key.issues() as issue}
				<p class="text-sm text-destructive">{issue.message}</p>
			{/each}
		</div>
	</div>

	<div class="grid gap-2">
		<Label for="env_key_name">Env Key Name</Label>
		<Input
			{...saveProvider.fields.env_key_name.as('text')}
			id="env_key_name"
			placeholder="e.g. OPENAI_API_KEY"
		/>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="grid gap-2">
			<Label for="base_url">Base URL</Label>
			<Input {...saveProvider.fields.base_url.as('text')} id="base_url" placeholder="https://..." />
		</div>

		<div class="grid gap-2">
			<Label for="docs_url">Docs URL</Label>
			<Input {...saveProvider.fields.docs_url.as('text')} id="docs_url" placeholder="https://..." />
		</div>
	</div>

	<div class="grid gap-2">
		<Label for="website_url">Website URL</Label>
		<Input
			{...saveProvider.fields.website_url.as('text')}
			id="website_url"
			placeholder="https://..."
		/>
	</div>

	<div class="grid gap-2">
		<Label for="default_headers">Default Headers (JSON)</Label>
		<Textarea
			{...saveProvider.fields.default_headers.as('text')}
			id="default_headers"
			placeholder={JSON.stringify({ Authorization: 'Bearer ...' }, null, 2)}
			class="font-mono text-xs"
			rows={4}
		/>
	</div>

	<div class="flex items-center space-x-2">
		<Switch
			id="is_active"
			checked={saveProvider.fields.is_active.value()}
			onCheckedChange={(v) => saveProvider.fields.is_active.set(v)}
		/>
		<Label for="is_active">Active</Label>
		<input class="hidden" {...saveProvider.fields.is_active.as('checkbox')} />
	</div>

	<div class="flex justify-end gap-2">
		<Button type="submit" disabled={!!saveProvider.pending} aria-busy={!!saveProvider.pending}>
			{#if saveProvider.pending}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				{parameter ? 'Update' : 'Create'} Provider
			{/if}
		</Button>
	</div>
</form>
