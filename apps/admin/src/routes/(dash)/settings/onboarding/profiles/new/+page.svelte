<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/shadcn/button';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import * as Card from '$lib/components/shadcn/card';
	import { Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { generateProfileFromMarkdown, getProfileImportOptions } from '../profiles.remote';
	import {
		ONBOARDING_PROFILE_AGENT_INSTRUCTIONS,
		STRICT_ONBOARDING_TEMPLATE
	} from '../instruction-text';

	let markdown = $state('');
	let generationModelId = $state('');
	let runtimeModelId = $state('');
	let generating = $state(false);
	let error = $state('');

	async function handleGenerate() {
		if (!markdown.trim()) return;
		generating = true;
		error = '';
		try {
			const result = await generateProfileFromMarkdown({
				markdown,
				generationModelId: generationModelId || undefined,
				runtimeModelId: runtimeModelId || undefined
			});
			if (result && 'error' in result && result.error) {
				error = result.error as string;
			} else if (result && 'profileId' in result) {
				toast.success(
					result.action === 'updated' ? 'Profile updated from markdown' : 'Profile created from markdown'
				);
				goto(
					resolve(`/settings/onboarding/profiles/${(result as { profileId: string }).profileId}`)
				);
			}
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Generation failed';
		} finally {
			generating = false;
		}
	}

	function handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			markdown = reader.result as string;
		};
		reader.readAsText(file);
	}

	const template = STRICT_ONBOARDING_TEMPLATE;

	async function copyText(value: string, successMessage: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(successMessage);
		} catch {
			toast.error('Unable to copy');
		}
	}
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<div class="space-y-6 px-4 lg:px-6">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">New Onboarding Profile</h2>
			<p class="text-muted-foreground">
				Paste or upload a strict template for direct import, or choose a generation model for loose
				markdown. Re-importing strict markdown with the same profile key updates the existing profile.
			</p>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Agent Instructions</Card.Title>
				<Card.Description>
					Copy the full instruction set or the strict example directly into another agent so it
					understands all supported profile, option, and conditional-question fields.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex flex-wrap gap-2">
					<Button
						variant="outline"
						type="button"
						onclick={() =>
							copyText(ONBOARDING_PROFILE_AGENT_INSTRUCTIONS, 'Agent instructions copied')}
					>
						Copy Agent Instructions
					</Button>
					<Button
						variant="outline"
						type="button"
						onclick={() => copyText(template, 'Strict template copied')}
					>
						Copy Strict Example
					</Button>
				</div>

				<details class="rounded-md border p-3 text-sm">
					<summary class="cursor-pointer font-medium">Detailed agent instructions</summary>
					<pre class="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap"
						>{ONBOARDING_PROFILE_AGENT_INSTRUCTIONS}</pre
					>
				</details>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Markdown Input</Card.Title>
				<Card.Description>
					Provide a structured markdown spec. The strict importer supports profile metadata,
					disclosures, long-form disclaimer fields, question descriptions, sidebar titles, option tags, and
					conditional rules including show_when, show_when_all, and show_when_any.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#await getProfileImportOptions() then options}
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<label for="generation-model" class="text-sm font-medium">Generation model</label>
							<Select.Root type="single" bind:value={generationModelId}>
								<Select.Trigger id="generation-model" class="w-full">
									<span data-slot="select-value">
										{options.modelOptions.find((model) => model.id === generationModelId)
											?.displayName ?? 'Only needed for loose markdown'}
									</span>
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="">No generation model</Select.Item>
									{#each options.modelOptions as model (model.id)}
										<Select.Item value={model.id}>{model.displayName ?? model.modelId}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<div class="space-y-2">
							<label for="runtime-model" class="text-sm font-medium">Runtime AI model</label>
							<Select.Root type="single" bind:value={runtimeModelId}>
								<Select.Trigger id="runtime-model" class="w-full">
									<span data-slot="select-value">
										{options.modelOptions.find((model) => model.id === runtimeModelId)
											?.displayName ?? 'Use profile default'}
									</span>
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="">Use profile default</Select.Item>
									{#each options.modelOptions as model (model.id)}
										<Select.Item value={model.id}>{model.displayName ?? model.modelId}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>
				{/await}

				<div>
					<label for="md-file" class="text-sm font-medium"> Upload .md file </label>
					<input
						id="md-file"
						type="file"
						accept=".md,.txt,.markdown"
						onchange={handleFileUpload}
						class="mt-1 block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
					/>
				</div>

				<div>
					<label for="md-textarea" class="text-sm font-medium"> Or paste markdown directly </label>
					<Textarea
						id="md-textarea"
						bind:value={markdown}
						placeholder={template}
						rows={18}
						class="mt-1 font-mono text-sm"
					/>
				</div>

				<details class="rounded-md border p-3 text-sm">
					<summary class="cursor-pointer font-medium">Strict template</summary>
					<pre
						class="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap">{template}</pre>
				</details>

				{#if error}
					<div
						class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
					>
						{error}
					</div>
				{/if}
			</Card.Content>
			<Card.Footer class="flex items-center justify-between">
				<Button variant="outline" href="/settings/onboarding/profiles">Cancel</Button>
				<Button onclick={handleGenerate} disabled={generating || !markdown.trim()}>
					{#if generating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Generating…
					{:else}
						Generate Profile
					{/if}
				</Button>
			</Card.Footer>
		</Card.Root>
	</div>
</div>
