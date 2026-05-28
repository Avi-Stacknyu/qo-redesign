<script lang="ts">
	import CustomSelect from '$lib/components/account/CustomSelect.svelte';
	import PreferenceSelectRow from '$lib/components/account/PreferenceSelectRow.svelte';
	import type { PersonalitySelectField } from '$lib/components/account/types';
	import { Brain, Loader2, MessageSquare, Smile, Sparkles } from '@lucide/svelte';
	import { Switch } from '$lib/components/shadcn/switch/index.js';
	import { Textarea } from '$lib/components/shadcn/textarea/index.js';
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

	const selectFields: PersonalitySelectField[] = [
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
</script>

<section class="flex flex-col gap-10" aria-label="AI Personality settings">
	<div class="flex items-center justify-between gap-3">
		<div class="flex flex-col gap-1.5">
			<h2 class="font-Inter text-3xl font-medium text-foreground">Custom Instructions</h2>
			<p class="text-lg font-light text-muted-foreground">
				Persistent instructions prepended to every conversation.
			</p>
		</div>
		{#if isSaving}
			<div class="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
				<Loader2 class="size-4 animate-spin" />
				Saving...
			</div>
		{/if}
	</div>

	<div class="flex flex-col gap-3">
		<h3 class="font-Inter text-xl font-medium text-muted-foreground">Response Style</h3>
		<Textarea
			value={settings.custom_prompt}
			oninput={handlePromptInput}
			class="min-h-35 resize-none rounded-3xl border border-[#E4E9EF] bg-white px-5 py-4 text-lg! leading-relaxed text-foreground shadow-none placeholder:text-lg placeholder:font-light placeholder:text-[#8A94A6] placeholder:opacity-70 focus-visible:border-[#904EFF] focus-visible:ring-2 focus-visible:ring-[#904EFF]/20"
			placeholder="eg . add your instruction here"
		/>
	</div>

	<div class="flex flex-col gap-6">
		<div class="flex flex-col gap-1.5">
			<h2 class="font-Inter text-3xl font-medium text-foreground">AI Personality</h2>
			<p class="text-lg font-light text-muted-foreground">
				Customize how your AI assistant communicates and behaves.
			</p>
		</div>

		<h3 class="font-Inter text-xl font-medium text-muted-foreground">Response Style</h3>

		<div class="flex flex-col gap-0 rounded-[2rem] bg-white/75 px-6 shadow-sm ring-1 ring-border/40 backdrop-blur-sm">
			{#each selectFields as field (field.key)}
				<PreferenceSelectRow
					label={field.label}
					value={settings[field.key] as string}
					options={field.options}
					onValueChange={(value) => handleSelect(field.key, value)}
				/>
			{/each}
		</div>
	</div>

	<div class="flex flex-col gap-6">
		<div class="flex items-center gap-3">
			<div class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				<Brain class="size-5" />
			</div>
			<div>
				<h3 class="font-Inter text-2xl font-medium text-foreground">Behavior</h3>
				<p class="text-sm text-muted-foreground">Toggle how proactive and expressive the assistant should be.</p>
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-3">
			{#each toggleFields as field (field.key)}
				<div class="rounded-[1.75rem] border border-border/40 bg-card/80 p-5 shadow-sm backdrop-blur-sm">
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-start gap-3">
							<div class="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
								<field.icon class="size-4" />
							</div>
							<div>
								<p class="text-base font-medium text-foreground">{field.label}</p>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">{field.description}</p>
							</div>
						</div>
						<Switch checked={settings[field.key] as boolean} onCheckedChange={(value) => handleToggle(field.key, value)} />
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="flex items-start gap-2 rounded-[1.75rem] border border-primary/20 bg-primary/5 p-4">
		<Sparkles class="mt-0.5 size-4 shrink-0 text-primary/70" />
		<p class="text-sm leading-relaxed text-muted-foreground">
			All AI personality settings save automatically and apply to new messages immediately.
		</p>
	</div>
</section>
