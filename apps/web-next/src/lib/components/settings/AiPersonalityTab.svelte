<script lang="ts">
	import { Brain, Sparkles, Loader2, MessageSquare, BookOpen, Smile } from '@lucide/svelte';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { Switch } from '$lib/components/shadcn/switch/index.js';
	import { Textarea } from '$lib/components/shadcn/textarea/index.js';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import { Separator } from '$lib/components/shadcn/separator/index.js';
	import { cn } from '$lib/utils';
	import { toast } from 'svelte-sonner';
	import { saveAiPersonality } from '$lib/remote/settings.remote';
	import type { AiPersonality } from '$lib/types/ai';

	let { initialSettings }: { initialSettings: AiPersonality } = $props();

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
	let isSaving = $state(false);

	$effect(() => {
		settings = { ...initialSettings };
	});

	async function persist(updates: Partial<AiPersonality>) {
		const previous = { ...settings };
		settings = { ...settings, ...updates };
		isSaving = true;
		try {
			await saveAiPersonality(settings);
		} catch {
			settings = previous;
			toast.error('Failed to save AI settings');
		} finally {
			isSaving = false;
		}
	}

	function handleToggle(key: keyof AiPersonality, checked: boolean) {
		persist({ [key]: checked });
	}

	function handleSelect(key: keyof AiPersonality, value: string) {
		persist({ [key]: value });
	}

	let debounceTimer: ReturnType<typeof setTimeout>;
	function handlePromptInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		settings.custom_prompt = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => persist({ custom_prompt: value }), 1000);
	}

	const toggleFields: Array<{
		key: keyof AiPersonality;
		label: string;
		description: string;
		icon: typeof Brain;
	}> = [
		{
			key: 'proactive',
			label: 'Proactive Suggestions',
			description: 'AI will offer insights and tips without being asked',
			icon: Sparkles
		},
		{
			key: 'use_emojis',
			label: 'Use Emojis',
			description: 'Include emojis in responses for a friendlier tone',
			icon: Smile
		},
		{
			key: 'ask_clarifications',
			label: 'Ask Clarifications',
			description: 'AI will ask follow-up questions when context is unclear',
			icon: MessageSquare
		}
	];

	const selectFields: Array<{
		key: keyof AiPersonality;
		label: string;
		options: Array<{ value: string; label: string }>;
	}> = [
		{
			key: 'tone',
			label: 'Tone',
			options: [
				{ value: 'professional', label: 'Professional' },
				{ value: 'balanced', label: 'Balanced' },
				{ value: 'friendly', label: 'Friendly' }
			]
		},
		{
			key: 'response_length',
			label: 'Response Length',
			options: [
				{ value: 'concise', label: 'Concise' },
				{ value: 'balanced', label: 'Balanced' },
				{ value: 'detailed', label: 'Detailed' }
			]
		},
		{
			key: 'formality',
			label: 'Formality',
			options: [
				{ value: 'casual', label: 'Casual' },
				{ value: 'standard', label: 'Standard' },
				{ value: 'formal', label: 'Formal' }
			]
		},
		{
			key: 'explanation_style',
			label: 'Explanation Style',
			options: [
				{ value: 'technical', label: 'Technical' },
				{ value: 'mixed', label: 'Mixed' },
				{ value: 'simple', label: 'Simple' },
				{ value: 'eli5', label: 'ELI5' }
			]
		}
	];

	function getDisplayLabel(key: keyof AiPersonality): string {
		const field = selectFields.find((f) => f.key === key);
		const current = settings[key] as string;
		return field?.options.find((o) => o.value === current)?.label ?? current;
	}
</script>

<section class="space-y-6" aria-label="AI Personality settings">
	<div class="flex items-start justify-between">
		<div class="space-y-1">
			<h2 class="text-xl font-semibold tracking-tight text-foreground">AI Personality</h2>
			<p class="text-sm text-muted-foreground">
				Customize how your AI assistant communicates and behaves.
			</p>
		</div>
		{#if isSaving}
			<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Loader2 class="size-3 animate-spin" />
				<span>Saving…</span>
			</div>
		{/if}
	</div>

	<!-- Response Style Selectors -->
	<Card.Root class="overflow-hidden rounded-xl border-border/40 bg-card/90 shadow-lg backdrop-blur">
		<Card.Content class="p-6">
			<div class="mb-5 flex items-center gap-2.5">
				<div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<BookOpen class="size-4" />
				</div>
				<div>
					<h3 class="text-sm font-semibold text-foreground">Response Style</h3>
					<p class="text-xs text-muted-foreground">How the AI structures its output</p>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each selectFields as field (field.key)}
					<div class="space-y-2">
						<Label class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
							{field.label}
						</Label>
						<Select.Root
							type="single"
							value={settings[field.key] as string}
							onValueChange={(v) => handleSelect(field.key, v)}
						>
							<Select.Trigger
								class="h-10 w-full rounded-lg border-border/40 bg-muted/30 text-sm transition-colors hover:bg-muted/50"
							>
								{getDisplayLabel(field.key)}
							</Select.Trigger>
							<Select.Content class="rounded-lg">
								{#each field.options as option (option.value)}
									<Select.Item value={option.value} class="text-sm">
										{option.label}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>

	<Separator class="bg-border/30" />

	<!-- Behavior Toggles -->
	<Card.Root class="overflow-hidden rounded-xl border-border/40 bg-card/90 shadow-lg backdrop-blur">
		<Card.Content class="p-6">
			<div class="mb-5 flex items-center gap-2.5">
				<div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Brain class="size-4" />
				</div>
				<div>
					<h3 class="text-sm font-semibold text-foreground">Behavior</h3>
					<p class="text-xs text-muted-foreground">Toggle AI features on or off</p>
				</div>
			</div>

			<div class="space-y-1">
				{#each toggleFields as field, i (field.key)}
					<div
						class={cn(
							'flex items-center justify-between gap-4 rounded-lg p-3 transition-colors hover:bg-muted/30',
							i < toggleFields.length - 1 && 'border-b border-border/20'
						)}
					>
						<div class="flex items-center gap-3">
							<div
								class="flex size-8 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"
							>
								<field.icon class="size-4" />
							</div>
							<div>
								<Label
									for="toggle-{field.key}"
									class="cursor-pointer text-sm font-medium text-foreground"
								>
									{field.label}
								</Label>
								<p class="text-xs text-muted-foreground">{field.description}</p>
							</div>
						</div>
						<Switch
							id="toggle-{field.key}"
							checked={settings[field.key] as boolean}
							onCheckedChange={(c) => handleToggle(field.key, c)}
						/>
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>

	<Separator class="bg-border/30" />

	<!-- Custom System Instructions -->
	<Card.Root class="overflow-hidden rounded-xl border-border/40 bg-card/90 shadow-lg backdrop-blur">
		<Card.Content class="p-6">
			<div class="mb-5 flex items-center gap-2.5">
				<div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<MessageSquare class="size-4" />
				</div>
				<div>
					<h3 class="text-sm font-semibold text-foreground">Custom Instructions</h3>
					<p class="text-xs text-muted-foreground">
						Persistent instructions prepended to every conversation
					</p>
				</div>
			</div>

			<Textarea
				value={settings.custom_prompt}
				oninput={handlePromptInput}
				placeholder="E.g., Act like a senior financial advisor specializing in portfolio risk management..."
				rows={4}
				class="min-h-24 resize-none rounded-lg border-border/40 bg-muted/30 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-background"
			/>
			<p class="mt-2 text-[11px] leading-relaxed text-muted-foreground/60">
				These instructions will be appended to the system prompt for all new conversations.
			</p>
		</Card.Content>
	</Card.Root>

	<!-- Auto-save message -->
	<div class="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
		<Sparkles class="mt-0.5 size-4 shrink-0 text-primary/70" />
		<p class="text-xs leading-relaxed text-muted-foreground">
			All AI personality settings save automatically and apply to new messages immediately.
		</p>
	</div>
</section>
