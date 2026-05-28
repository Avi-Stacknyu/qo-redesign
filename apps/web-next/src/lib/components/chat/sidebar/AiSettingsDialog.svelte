<script lang="ts">
	import * as Dialog from '$lib/components/shadcn/dialog/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { Switch } from '$lib/components/shadcn/switch/index.js';
	import { Textarea } from '$lib/components/shadcn/textarea/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import { Brain, Sparkles, Settings2, Loader2 } from '@lucide/svelte';
	import { loadAiPersonality, saveAiPersonality } from '$lib/remote/settings.remote';
	import type { AiPersonality } from '$lib/types/ai';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let settings = $state<AiPersonality>({
		proactive: false,
		use_emojis: false,
		ask_clarifications: true,
		tone: 'balanced',
		response_length: 'balanced',
		formality: 'standard',
		explanation_style: 'mixed',
		custom_prompt: ''
	});

	let isLoading = $state(true);
	let isSaving = $state(false);

	// Load settings when dialog opens
	$effect(() => {
		if (open) {
			loadSettings();
		}
	});

	async function loadSettings() {
		isLoading = true;
		try {
			const data = await loadAiPersonality();
			if (data) {
				settings = data;
			}
		} catch (error) {
			console.error('Failed to load settings:', error);
			toast.error('Failed to load AI settings');
		} finally {
			isLoading = false;
		}
	}

	async function saveSettings(newSettings: Partial<AiPersonality>) {
		// Optimistic update
		const oldSettings = { ...settings };
		settings = { ...settings, ...newSettings };

		isSaving = true;
		try {
			await saveAiPersonality(settings);
		} catch (error) {
			console.error('Failed to save settings:', error);
			toast.error('Failed to save changes');
			// Revert
			settings = oldSettings;
		} finally {
			isSaving = false;
		}
	}

	function handleSwitchChange(key: keyof AiPersonality, checked: boolean) {
		saveSettings({ [key]: checked });
	}

	function handleSelectChange(key: keyof AiPersonality, value: string) {
		saveSettings({ [key]: value });
	}

	let debounceTimer: ReturnType<typeof setTimeout>;
	function handlePromptChange(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		settings.custom_prompt = value;

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			saveSettings({ custom_prompt: value });
		}, 1000);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[85vh] overflow-y-auto rounded-xl sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Brain class="size-4" />
				</div>
				AI Customization
			</Dialog.Title>
			<Dialog.Description>
				Personalize how your AI assistant responds and behaves.
			</Dialog.Description>
		</Dialog.Header>

		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="size-6 animate-spin text-primary" />
			</div>
		{:else}
			<div class="space-y-6 py-2">
				<!-- Dropdown Settings Grid -->
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label class="text-xs text-muted-foreground">Tone</Label>
						<Select.Root
							type="single"
							value={settings.tone}
							onValueChange={(v) => handleSelectChange('tone', v)}
						>
							<Select.Trigger class="h-9 w-full text-xs">
								{settings.tone === 'professional'
									? 'Professional'
									: settings.tone === 'friendly'
										? 'Friendly'
										: 'Balanced'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="professional">Professional</Select.Item>
								<Select.Item value="balanced">Balanced</Select.Item>
								<Select.Item value="friendly">Friendly</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-2">
						<Label class="text-xs text-muted-foreground">Length</Label>
						<Select.Root
							type="single"
							value={settings.response_length}
							onValueChange={(v) => handleSelectChange('response_length', v)}
						>
							<Select.Trigger class="h-9 w-full text-xs">
								{settings.response_length === 'concise'
									? 'Concise'
									: settings.response_length === 'detailed'
										? 'Detailed'
										: 'Balanced'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="concise">Concise</Select.Item>
								<Select.Item value="balanced">Balanced</Select.Item>
								<Select.Item value="detailed">Detailed</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-2">
						<Label class="text-xs text-muted-foreground">Formality</Label>
						<Select.Root
							type="single"
							value={settings.formality}
							onValueChange={(v) => handleSelectChange('formality', v)}
						>
							<Select.Trigger class="h-9 w-full text-xs">
								{settings.formality === 'casual'
									? 'Casual'
									: settings.formality === 'formal'
										? 'Formal'
										: 'Standard'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="casual">Casual</Select.Item>
								<Select.Item value="standard">Standard</Select.Item>
								<Select.Item value="formal">Formal</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-2">
						<Label class="text-xs text-muted-foreground">Explanation</Label>
						<Select.Root
							type="single"
							value={settings.explanation_style}
							onValueChange={(v) => handleSelectChange('explanation_style', v)}
						>
							<Select.Trigger class="h-9 w-full text-xs">
								{settings.explanation_style === 'technical'
									? 'Technical'
									: settings.explanation_style === 'simple'
										? 'Simple'
										: settings.explanation_style === 'eli5'
											? 'ELI5'
											: 'Mixed'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="technical">Technical</Select.Item>
								<Select.Item value="simple">Simple</Select.Item>
								<Select.Item value="mixed">Mixed</Select.Item>
								<Select.Item value="eli5">ELI5</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<!-- Toggles -->
				<div class="space-y-3 rounded-lg border border-border/40 bg-muted/30 p-3">
					<div class="flex items-center justify-between">
						<Label class="cursor-pointer text-xs" for="proactive">Proactive Suggestions</Label>
						<Switch
							id="proactive"
							checked={settings.proactive}
							onCheckedChange={(c) => handleSwitchChange('proactive', c)}
						/>
					</div>
					<div class="flex items-center justify-between">
						<Label class="cursor-pointer text-xs" for="emojis">Use Emojis</Label>
						<Switch
							id="emojis"
							checked={settings.use_emojis}
							onCheckedChange={(c) => handleSwitchChange('use_emojis', c)}
						/>
					</div>
					<div class="flex items-center justify-between">
						<Label class="cursor-pointer text-xs" for="clarify">Ask Clarifications</Label>
						<Switch
							id="clarify"
							checked={settings.ask_clarifications}
							onCheckedChange={(c) => handleSwitchChange('ask_clarifications', c)}
						/>
					</div>
				</div>

				<!-- Custom Prompt -->
				<div class="space-y-2">
					<Label class="text-xs text-muted-foreground">Custom System Instructions</Label>
					<Textarea
						value={settings.custom_prompt}
						oninput={handlePromptChange}
						placeholder="E.g., Act like a financial advisor who specializes in..."
						rows={3}
						class="min-h-20 resize-none text-xs"
					/>
					<p class="text-[10px] leading-relaxed text-muted-foreground">
						These instructions will be appended to the system prompt for all new chats.
					</p>
				</div>

				<!-- Footer Info -->
				<div class="rounded-lg border border-primary/20 bg-primary/5 p-3">
					<p class="flex items-start gap-2 text-[11px] text-muted-foreground">
						<Sparkles class="mt-0.5 size-3 shrink-0 text-primary/70" />
						<span>Settings save automatically and apply to new messages.</span>
					</p>
				</div>
			</div>
		{/if}

		<Dialog.Footer class="gap-2 sm:gap-0">
			<Button variant="outline" onclick={() => (open = false)} class="text-xs">Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
