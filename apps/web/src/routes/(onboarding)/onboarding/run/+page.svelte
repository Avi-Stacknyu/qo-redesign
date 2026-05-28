<script lang="ts">
	import OnboardingShell from '$lib/components/onboarding/OnboardingShell.svelte';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import {
		LoaderCircle,
		ArrowRight,
		Check,
		CircleAlert,
		CornerDownLeft,
		ScrollText,
		ShieldCheck
	} from '@lucide/svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData, ActionData } from './$types';
	import SafeIcon from '$lib/components/onboarding/SafeIcon.svelte';
	import type { DisclosureConfig, QuestionData } from '$lib/types/onboarding';

	let { data, form: actionResult }: { data: PageData; form: ActionData } = $props();

	let isSubmitting = $state(false);
	let localQuestionData = $state<QuestionData | null>(null);
	let localDisclosureConfig = $state<DisclosureConfig | undefined>();
	let localDisclosureState = $state<'pending' | 'rejected' | 'accepted' | null>(null);
	let localDisclosureResponses = $state<Record<string, boolean | null>>({});
	let localRejectMessage = $state<string | undefined>();
	let pendingDisclosureSubmit = $state(false);
	let submitErrorOverride = $state<string | undefined>();
	let dismissedActionError = $state(false);

	const actionQuestionData = $derived(getActionQuestionData(actionResult));
	const actionError = $derived(getActionError(actionResult));
	const currentQuestionData = $derived(
		localQuestionData ?? actionQuestionData ?? data.questionData
	);
	const submitError = $derived(
		submitErrorOverride ?? (dismissedActionError ? undefined : actionError)
	);

	const activeDisclosures = $derived(localDisclosureConfig ?? data.disclosures);
	const disclosureState = $derived(
		localDisclosureState ??
			(data.disclosuresPending
				? data.rejectMessage
					? 'rejected'
					: 'pending'
				: activeDisclosures?.enabled === true
					? 'accepted'
					: null)
	);
	const rejectMessage = $derived(localRejectMessage ?? data.rejectMessage);
	const showDisclosures = $derived(
		activeDisclosures?.enabled === true &&
			disclosureState !== 'accepted' &&
			!currentQuestionData?.question
	);
	const disclosureSubmitError = $derived(
		showDisclosures && rejectMessage ? undefined : submitError
	);
	const hasDecisionDisclosures = $derived(
		activeDisclosures?.items.some((item) => item.type === 'accept_deny') ?? false
	);
	const disclosureInstructions = $derived(
		hasDecisionDisclosures
			? 'Review each disclosure, choose one response where needed, then submit once to continue.'
			: 'Review each disclosure, acknowledge the required items, then continue.'
	);
	const disclosureSubmitLabel = $derived(
		hasDecisionDisclosures ? 'Submit responses' : 'Continue to questions'
	);

	const question = $derived(currentQuestionData?.question ?? null);
	const questionNumber = $derived(currentQuestionData?.questionNumber ?? 1);
	const phase = $derived(currentQuestionData?.phase ?? 'preset');
	const presetCount = $derived(currentQuestionData?.presetCount ?? 5);
	const maxAiQuestions = $derived(currentQuestionData?.maxAiQuestions ?? 3);

	// Answered facts from DO state (persists across page reloads)
	const answeredFacts = $derived(currentQuestionData?.answeredFacts ?? []);

	const AI_PROMPT_COUNT = 1;

	const totalSteps = $derived(
		phase === 'ai-personalized'
			? presetCount + AI_PROMPT_COUNT + maxAiQuestions
			: presetCount + AI_PROMPT_COUNT
	);

	let answerValue = $state('');
	let selectedOptions = $state<string[]>([]);
	let formElement = $state<HTMLFormElement>();
	let pendingOptionValue = $state<string | null>(null);
	let autoSubmitTimer: ReturnType<typeof setTimeout> | null = null;

	type NormalizedQuestionType = 'single_select' | 'multi_select' | 'text' | 'number' | 'boolean';

	function normalizeQuestionType(type: string | undefined): NormalizedQuestionType {
		if (type === 'checkbox') return 'single_select';
		if (type === 'multiselect') return 'multi_select';
		if (
			type === 'single_select' ||
			type === 'multi_select' ||
			type === 'number' ||
			type === 'boolean'
		) {
			return type;
		}
		return 'text';
	}

	function getActionError(result: ActionData | undefined): string | undefined {
		return result && 'error' in result && typeof result.error === 'string'
			? result.error
			: undefined;
	}

	function getActionQuestionData(result: ActionData | undefined): QuestionData | null {
		return result && 'questionData' in result && result.questionData
			? (result.questionData as QuestionData)
			: null;
	}

	function clearSubmitError() {
		submitErrorOverride = undefined;
		dismissedActionError = true;
	}

	function getDisclosureResponse(item: DisclosureConfig['items'][number]): boolean | null {
		return localDisclosureResponses[item.id] ?? (item.type === 'acknowledgement' ? false : null);
	}

	function clearAutoSubmitTimer() {
		if (!autoSubmitTimer) return;
		clearTimeout(autoSubmitTimer);
		autoSubmitTimer = null;
	}

	const questionType = $derived(normalizeQuestionType(question?.type));

	$effect(() => {
		if (question?.id) {
			clearAutoSubmitTimer();
			answerValue = '';
			selectedOptions = [];
			pendingOptionValue = null;
		}
	});

	function setDisclosureResponse(id: string, value: boolean) {
		clearSubmitError();
		localDisclosureResponses = {
			...localDisclosureResponses,
			[id]: value
		};
		if (localDisclosureState === 'rejected') {
			localDisclosureState = 'pending';
		}
		localRejectMessage = undefined;
	}

	function toggleOption(value: string) {
		clearSubmitError();
		if (questionType === 'single_select') {
			answerValue = value;
			pendingOptionValue = value;
			clearAutoSubmitTimer();
			autoSubmitTimer = setTimeout(() => {
				if (!isSubmitting && answerValue === value) {
					formElement?.requestSubmit();
				}
			}, 180);
		} else {
			if (selectedOptions.includes(value)) {
				selectedOptions = selectedOptions.filter((v) => v !== value);
			} else {
				selectedOptions = [...selectedOptions, value];
			}
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && canSubmit && !isSubmitting) {
			event.preventDefault();
			formElement?.requestSubmit();
		}
	}

	const handleSubmitEnhance: SubmitFunction = async () => {
		clearAutoSubmitTimer();
		isSubmitting = true;
		submitErrorOverride = undefined;
		dismissedActionError = true;
		await tick();

		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					const nextQuestionData = (result.data as { questionData?: QuestionData } | undefined)
						?.questionData;
					if (nextQuestionData) localQuestionData = nextQuestionData;
				} else if (result.type === 'failure') {
					submitErrorOverride =
						(result.data as { error?: string } | undefined)?.error ?? 'Failed to submit answer';
					dismissedActionError = false;
				} else if (result.type === 'error') {
					submitErrorOverride = result.error.message;
					dismissedActionError = false;
				}

				await update({ invalidateAll: false, reset: false });
			} finally {
				isSubmitting = false;
				pendingOptionValue = null;
			}
		};
	};

	type DisclosureActionPayload = {
		questionData?: QuestionData;
		disclosures?: DisclosureConfig;
		disclosuresAccepted?: boolean;
		disclosuresPending?: boolean;
		rejectMessage?: string;
		error?: string;
	};

	const handleDisclosureEnhance: SubmitFunction = async () => {
		clearAutoSubmitTimer();
		isSubmitting = true;
		pendingDisclosureSubmit = true;
		submitErrorOverride = undefined;
		dismissedActionError = true;
		await tick();

		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					const payload = result.data as DisclosureActionPayload | undefined;
					if (payload?.disclosures) localDisclosureConfig = payload.disclosures;
					if (payload?.disclosuresAccepted) {
						localDisclosureState = 'accepted';
						localRejectMessage = undefined;
						if (payload.questionData) localQuestionData = payload.questionData;
					}
				} else if (result.type === 'failure') {
					const payload = result.data as DisclosureActionPayload | undefined;
					if (payload?.disclosures) localDisclosureConfig = payload.disclosures;
					localQuestionData = null;
					localDisclosureState = payload?.rejectMessage ? 'rejected' : 'pending';
					localRejectMessage = payload?.rejectMessage;
					if (payload?.rejectMessage) {
						submitErrorOverride = undefined;
						dismissedActionError = true;
					} else {
						submitErrorOverride = payload?.error ?? 'Failed to submit disclosures';
						dismissedActionError = false;
					}
				} else if (result.type === 'error') {
					submitErrorOverride = result.error.message;
					dismissedActionError = false;
				}

				await update({ invalidateAll: false, reset: false });
			} finally {
				isSubmitting = false;
				pendingDisclosureSubmit = false;
			}
		};
	};

	const canSubmit = $derived.by(() => {
		if (!question?.required) return true;
		if (questionType === 'multi_select') return selectedOptions.length > 0;
		if (questionType === 'single_select') return !!answerValue;
		return !!answerValue;
	});

	const canSubmitDisclosures = $derived.by(() => {
		if (!activeDisclosures?.enabled) return true;
		return activeDisclosures.items.every((item) => {
			if (!item.required) return true;
			const response = getDisclosureResponse(item);
			return item.type === 'acknowledgement' ? response === true : response !== null;
		});
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Onboarding | Quant Orion</title>
</svelte:head>

{#if data.initError}
	<div class="flex min-h-svh items-center justify-center bg-slate-50 p-6">
		<div
			class="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50"
		>
			<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
				<CircleAlert class="h-6 w-6 text-red-500" />
			</div>
			<h2 class="text-lg font-semibold text-slate-900">Something went wrong</h2>
			<p class="mt-2 text-sm text-slate-500">{data.initError}</p>
			<Button onclick={() => window.location.reload()} class="mt-6 w-full">Try again</Button>
		</div>
	</div>
{:else if showDisclosures && activeDisclosures}
	<OnboardingShell currentStep={0} {totalSteps} {answeredFacts}>
		<form
			method="POST"
			action="?/submitDisclosures"
			use:enhance={handleDisclosureEnhance}
			class="mx-auto w-full max-w-2xl space-y-5"
		>
			<div class="text-center lg:text-left">
				<div class="mb-4 flex items-center justify-center gap-2 lg:justify-start">
					<div
						class="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-700 uppercase"
					>
						<ShieldCheck class="h-3.5 w-3.5" />
						Required disclosures
					</div>
				</div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
					Review required disclosures
				</h1>
				<p class="mt-2 text-sm leading-relaxed text-slate-500">
					{disclosureInstructions}
				</p>
			</div>

			{#if disclosureState === 'rejected' && rejectMessage}
				<div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
					<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
					<p class="text-sm font-medium text-amber-800">{rejectMessage}</p>
				</div>
			{/if}

			{#each activeDisclosures.items as item (item.id)}
				{@const disclosureResponse = getDisclosureResponse(item)}
				<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<input type="hidden" name="disclosureId" value={item.id} />
					{#if item.type === 'accept_deny'}
						<input
							type="hidden"
							name={`disclosure:${item.id}`}
							value={disclosureResponse === true ? 'true' : 'false'}
						/>
					{/if}

					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"
						>
							<ScrollText class="h-5 w-5" />
						</div>
						<div class="min-w-0 flex-1 space-y-3">
							<div>
								{#if item.title}
									<h2 class="text-sm font-semibold text-slate-900">{item.title}</h2>
								{/if}
								{#if item.body}
									<div
										class="mt-3 max-h-56 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-600"
									>
										<p class="whitespace-pre-line">{item.body}</p>
									</div>
								{/if}
								<p class="mt-3 text-sm font-medium text-slate-900">{item.question}</p>
							</div>

							{#if item.type === 'acknowledgement'}
								<label
									class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-emerald-200"
								>
									<input
										type="checkbox"
										name={`disclosure:${item.id}`}
										value="true"
										checked={disclosureResponse === true}
										disabled={isSubmitting}
										onchange={(event) =>
											setDisclosureResponse(item.id, event.currentTarget.checked)}
										class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
									/>
									<span>{item.acceptLabel || 'I acknowledge'}</span>
								</label>
							{:else}
								<div class="space-y-2">
									<p class="text-xs font-medium tracking-wide text-slate-500 uppercase">
										Choose one response
									</p>
									<div
										class="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 sm:grid-cols-2"
									>
										<button
											type="button"
											disabled={isSubmitting}
											onclick={() => setDisclosureResponse(item.id, false)}
											aria-pressed={disclosureResponse === false}
											class="rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors {disclosureResponse ===
											false
												? 'border-amber-300 bg-amber-50 text-amber-800 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]'
												: 'border-transparent bg-white text-slate-700 hover:border-slate-300'}"
										>
											{item.rejectLabel || 'Decline'}
										</button>
										<button
											type="button"
											disabled={isSubmitting}
											onclick={() => setDisclosureResponse(item.id, true)}
											aria-pressed={disclosureResponse === true}
											class="rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors {disclosureResponse ===
											true
												? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]'
												: 'border-transparent bg-white text-slate-700 hover:border-emerald-200'}"
										>
											{item.acceptLabel || 'Accept'}
										</button>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}

			{#if disclosureSubmitError}
				<div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
					<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
					<p class="text-sm font-medium text-red-700">{disclosureSubmitError}</p>
				</div>
			{/if}

			<div class="flex justify-end">
				<Button type="submit" disabled={isSubmitting || !canSubmitDisclosures}>
					{#if pendingDisclosureSubmit}
						<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					{disclosureSubmitLabel}
					{#if !hasDecisionDisclosures}
						<ArrowRight class="ml-2 h-4 w-4" />
					{/if}
				</Button>
			</div>
		</form>
	</OnboardingShell>
{:else if question}
	<OnboardingShell currentStep={questionNumber - 1} {totalSteps} {answeredFacts}>
		{#if submitError}
			<div class="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
				<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
				<p class="text-sm font-medium text-red-700">{submitError}</p>
			</div>
		{/if}
		{#key question.id}
			<div class="animate-in duration-500 fill-mode-backwards fade-in slide-in-from-bottom-8">
				<form
					method="POST"
					action="?/answer"
					bind:this={formElement}
					use:enhance={handleSubmitEnhance}
					class="w-full"
					aria-busy={isSubmitting}
				>
					<!-- Always send question type so server knows how to parse the answer -->
					<input type="hidden" name="questionType" value={questionType} />

					<!-- Question Header -->
					<div class="mb-8 text-center lg:text-left">
						<div class="mb-4 flex items-center justify-center gap-2 lg:justify-start">
							<div
								class="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-700 uppercase"
							>
								<span class="relative flex h-1.5 w-1.5">
									<span
										class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
									></span>
									<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
								</span>
								{phase === 'ai-personalized' ? 'AI Analysis' : `Step ${questionNumber}`}
							</div>
						</div>

						<h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
							{question.question}
						</h1>

						{#if question.description}
							<p class="mt-2 text-sm leading-relaxed text-slate-500">
								{question.description}
							</p>
						{/if}
					</div>

					<!-- Question Inputs -->
					<div class="mx-auto max-w-md lg:mx-0">
						{#if questionType === 'text'}
							<div class="group relative">
								<input
									type="text"
									name="answer"
									bind:value={answerValue}
									oninput={clearSubmitError}
									placeholder={question.placeholder ?? 'Type your answer...'}
									class="w-full border-b border-slate-200 bg-transparent py-2 text-base font-medium text-slate-900 transition-colors placeholder:text-slate-300 focus:border-emerald-500 focus:outline-none"
								/>
								<div
									class="absolute top-1/2 right-0 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500"
								>
									<CornerDownLeft class="h-4 w-4" />
								</div>
							</div>
						{:else if questionType === 'number'}
							<div class="group relative">
								<input
									type="number"
									name="answer"
									bind:value={answerValue}
									oninput={clearSubmitError}
									min={question.min}
									max={question.max}
									placeholder={question.placeholder ?? '0'}
									class="w-full border-b border-slate-200 bg-transparent py-2 text-xl font-bold text-slate-900 transition-colors placeholder:text-slate-300 focus:border-emerald-500 focus:outline-none"
								/>
								<div
									class="absolute top-1/2 right-0 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500"
								>
									<CornerDownLeft class="h-4 w-4" />
								</div>
							</div>
						{:else if questionType === 'boolean'}
							<div class="flex flex-col gap-2">
								<input type="hidden" name="answer" value={answerValue} />
								{#each [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] as option (option.value)}
									{@const isSelected = answerValue === option.value}
									<button
										type="button"
										onclick={() => {
											clearSubmitError();
											answerValue = option.value;
										}}
										class="group relative flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200 {isSelected
											? 'border-emerald-500 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,1)] shadow-emerald-500/20'
											: 'border-slate-200 bg-white shadow-sm hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-100/50'}"
									>
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border {isSelected
												? 'border-emerald-200 bg-emerald-100 text-emerald-700'
												: 'border-slate-100 bg-slate-50 text-slate-500'}"
										>
											<Check class="h-4 w-4" />
										</div>
										<span class="text-sm font-semibold text-slate-900">{option.label}</span>
									</button>
								{/each}
							</div>
						{:else if (questionType === 'single_select' || questionType === 'multi_select') && question.options}
							<div class="flex flex-col gap-2">
								{#if questionType === 'single_select'}
									<input type="hidden" name="answer" value={answerValue} />
								{:else}
									{#each selectedOptions as optionValue (optionValue)}
										<input type="hidden" name="answer" value={optionValue} />
									{/each}
								{/if}
								{#each question.options as option, i (option.value)}
									{@const isSelected =
										questionType === 'single_select'
											? answerValue === option.value
											: selectedOptions.includes(option.value)}
									{@const isPending =
										pendingOptionValue === option.value &&
										(isSubmitting || questionType === 'single_select')}

									<button
										type="button"
										disabled={isSubmitting}
										onclick={() => toggleOption(option.value)}
										class="group relative flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200
										{isSelected
											? 'border-emerald-500 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,1)] shadow-emerald-500/20'
											: 'border-slate-200 bg-white shadow-sm hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-100/50'}
										{isSubmitting && !isSelected ? 'pointer-events-none opacity-50' : ''}"
										style="animation-delay: {i * 30}ms"
									>
										<!-- Icon Box -->
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-all duration-200
											{isSelected
												? 'border-emerald-200 bg-emerald-100 text-emerald-700'
												: 'border-slate-100 bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-emerald-600'}"
										>
											{#if option.icon}
												<SafeIcon icon={option.icon} class="h-4 w-4" />
											{:else}
												<span class="text-[10px] font-bold opacity-40"
													>{String.fromCharCode(65 + i)}</span
												>
											{/if}
										</div>

										<!-- Text -->
										<div class="min-w-0 flex-1">
											<span
												class="block truncate text-sm font-semibold text-slate-900 transition-colors {isSelected
													? 'text-emerald-900'
													: ''}"
											>
												{option.label}
											</span>
											{#if option.description}
												<span
													class="block truncate text-xs text-slate-500 transition-colors {isSelected
														? 'text-emerald-700/80'
														: ''}"
												>
													{option.description}
												</span>
											{/if}
										</div>

										<!-- Check / Loading Indicator -->
										<div
											class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200
											{isSelected
												? 'border-emerald-500 bg-emerald-500 opacity-100'
												: 'border-slate-200 opacity-0 group-hover:border-emerald-200 group-hover:opacity-50'}"
										>
											{#if isPending}
												<LoaderCircle class="h-3 w-3 animate-spin text-white" />
											{:else}
												<Check class="h-2.5 w-2.5 text-white" strokeWidth={3} />
											{/if}
										</div>
									</button>
								{/each}
							</div>
						{/if}

						<!-- Submit Button -->
						<div class="mt-8 flex items-center gap-4">
							{#if !question.required}
								<Button
									type="submit"
									variant="ghost"
									size="lg"
									disabled={isSubmitting}
									formaction="?/skip"
								>
									Skip
									<ArrowRight class="ml-1 h-4 w-4" />
								</Button>
							{/if}

							<Button
								type="submit"
								size="lg"
								class="min-w-32"
								disabled={!canSubmit || isSubmitting}
							>
								{#if isSubmitting}
									<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
									Processing
								{:else}
									Continue
									<ArrowRight class="ml-2 h-4 w-4" />
								{/if}
							</Button>

							<div class="text-xs font-medium text-slate-400">
								{#if questionType === 'multi_select'}
									<span class="hidden sm:inline">Select all that apply</span>
								{:else}
									<span class="hidden sm:inline"
										>Press <span class="font-bold underline decoration-slate-300 underline-offset-2"
											>Enter</span
										> to continue</span
									>
								{/if}
							</div>
						</div>
					</div>
				</form>
			</div>
		{/key}
	</OnboardingShell>
{/if}
