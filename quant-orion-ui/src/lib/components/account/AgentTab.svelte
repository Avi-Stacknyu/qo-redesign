<script lang="ts">
	import CustomSelect from '$lib/components/account/CustomSelect.svelte';
	import PreferenceSelectRow from '$lib/components/account/PreferenceSelectRow.svelte';
	import type {
		PersonalitySelectField,
		PersonalitySettingKey,
		SelectOption
	} from '$lib/components/account/types';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	const aiOptions: SelectOption[] = [
		{ value: 'openai', label: 'OpenAI' },
		{ value: 'claude', label: 'Claude' },
		{ value: 'gemini', label: 'Gemini' },
		{ value: 'grok', label: 'Grok' },
		{ value: 'mistral', label: 'Mistral AI' },
		{ value: 'deepseek', label: 'DeepSeek' },
		{ value: 'llama', label: 'Llama' },
		{ value: 'perplexity', label: 'Perplexity' }
	];

	const toneOptions: SelectOption[] = [
		{ value: 'professional', label: 'Professional' },
		{ value: 'friendly', label: 'Friendly' },
		{ value: 'concise', label: 'Concise' },
		{ value: 'analytical', label: 'Analytical' }
	];

	const responseLengthOptions: SelectOption[] = [
		{ value: 'short', label: 'Short' },
		{ value: 'balanced', label: 'Balanced' },
		{ value: 'detailed', label: 'Detailed' }
	];

	const formalityOptions: SelectOption[] = [
		{ value: 'formal', label: 'Formal' },
		{ value: 'neutral', label: 'Neutral' },
		{ value: 'casual', label: 'Casual' }
	];

	const explanationTypeOptions: SelectOption[] = [
		{ value: 'step-by-step', label: 'Step by Step' },
		{ value: 'summary-first', label: 'Summary First' },
		{ value: 'example-driven', label: 'Example Driven' }
	];

	const personalityFields: PersonalitySelectField[] = [
		{ key: 'tone', label: 'Tone', options: toneOptions },
		{ key: 'responseLength', label: 'Response Length', options: responseLengthOptions },
		{ key: 'formality', label: 'Formality', options: formalityOptions },
		{ key: 'explanationType', label: 'Explanation type', options: explanationTypeOptions }
	];

	let personalitySettings = $state<Record<PersonalitySettingKey, string>>({
		tone: 'professional',
		responseLength: 'balanced',
		formality: 'formal',
		explanationType: 'step-by-step'
	});

	let selectedAiProvider = $state('openai');
</script>

<div class="flex w-full flex-col gap-10 p-4">
	<div class="flex flex-col gap-15">
		<div class="flex flex-col gap-6">
			<div class="flex flex-col gap-1.5">
				<h2 class="font-Inter text-3xl font-medium">AI Model</h2>
				<p class="text-lg font-light text-muted-foreground">
					Choose your default model. Per-chat overrides are available in the chat input.
				</p>
			</div>

			<div class="flex items-center justify-between">
				<div class="flex flex-col gap-1.5">
					<h2 class="font-Inter text-2xl font-medium text-primary">Default System</h2>
					<p class="font-light text-muted-foreground">Change the appearance of your interface</p>
				</div>

				<CustomSelect bind:value={selectedAiProvider} options={aiOptions} />
			</div>
		</div>

		<div class="flex flex-col gap-6">
			<div class="flex flex-col gap-1.5">
				<h2 class="font-Inter text-3xl font-medium">Custom Instructions</h2>
				<p class="text-lg font-light text-muted-foreground">
					Persistent instructions prepended to every conversation
				</p>
			</div>

			<h3 class="font-Inter text-xl font-medium text-muted-foreground">Response Style</h3>

			<Textarea
				class="min-h-35 resize-none rounded-3xl  border border-[#E4E9EF] bg-white px-5 py-4 text-lg! leading-relaxed text-foreground shadow-none placeholder:text-lg placeholder:font-light placeholder:text-[#8A94A6] placeholder:opacity-70 focus-visible:border-[#904EFF] focus-visible:ring-2 focus-visible:ring-[#904EFF]/20"
				placeholder="eg . add your instruction here"
			/>
		</div>

		<div class="flex flex-col gap-6">
			<div class="flex flex-col gap-1.5">
				<h2 class="font-Inter text-3xl font-medium">AI Personality</h2>
				<p class="text-lg font-light text-muted-foreground">
					Customize how your AI assistant communicates and behaves.
				</p>
			</div>

			<h3 class="font-Inter text-xl font-medium text-muted-foreground">Response Style</h3>

			<div class="flex flex-col gap-8">
				{#each personalityFields as field (field.key)}
					<PreferenceSelectRow
						label={field.label}
						options={field.options}
						bind:value={personalitySettings[field.key]}
					/>
				{/each}
			</div>
		</div>
	</div>
</div>
