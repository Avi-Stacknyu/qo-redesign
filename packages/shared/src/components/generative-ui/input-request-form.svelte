<!--
  InputRequestForm - Renders input requests from AI (Human-in-the-Loop)

  AI SDK pattern: The request_input tool has NO execute function on the server.
  The tool call is forwarded to the client in 'input-available' state with
  part.input containing { prompt, input_type, options, placeholder, required }.
  When the user submits, addToolOutput() is called, which transitions the
  part to 'output-available' with part.output = { value }.
-->
<script lang="ts">
	import { marked } from 'marked';
	import * as Card from '$ui/card';
	import { Input } from '$ui/input';
	import { Button } from '$ui/button';
	import * as Select from '$ui/select';
	import { Badge } from '$ui/badge';
	import { Send, Check } from '@lucide/svelte';

	marked.setOptions({ breaks: true, gfm: true });

	/** Tool call input schema from the server */
	interface ToolInput {
		prompt: string;
		input_type?: 'text' | 'number' | 'date' | 'select' | 'button_select';
		options?: string[];
		placeholder?: string;
		required?: boolean;
	}

	/** Tool output schema (what addToolOutput sends) */
	interface ToolOutput {
		value: string;
	}

	interface Props {
		/** AI SDK tool part state */
		partState: string;
		/** Tool call input (the prompt/config from the model) */
		input?: ToolInput;
		/** Tool output (the user's submitted value, available after addToolOutput) */
		output?: ToolOutput;
		toolCallId: string;
		onSubmit?: (value: string, toolCallId: string) => void;
	}

	let { partState, input, output, toolCallId, onSubmit }: Props = $props();

	let inputValue = $state('');
	let selectValue = $state<string | undefined>(undefined);
	let selectedButton = $state<string | undefined>(undefined);

	const inputType = $derived(input?.input_type ?? 'text');
	const isRequired = $derived(input?.required !== false);
	const isAwaitingInput = $derived(
		partState === 'input-available' || partState === 'input-streaming'
	);
	const isSubmitted = $derived(partState === 'output-available');
	const isExpired = $derived(partState === 'expired');

	function handleButtonSelect(option: string) {
		selectedButton = option;
		// Auto-submit on button click for button_select
		onSubmit?.(option, toolCallId);
	}

	function handleSubmit() {
		const value = inputType === 'select' ? (selectValue ?? '') : String(inputValue);
		if (isRequired && !value.trim()) return;
		onSubmit?.(value, toolCallId);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	let isDisabled = $derived(isRequired && !String(inputValue).trim() && !selectValue);
</script>

{#if isAwaitingInput && input}
	<Card.Root class="w-full max-w-lg border-border/60">
		<Card.Header class="pb-3">
			<Card.Title class="text-base leading-snug font-semibold">
				<span class="prose prose-sm max-w-none [&_p]:m-0 [&_p]:inline">{@html marked(input.prompt)}</span>
			</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if inputType === 'button_select' && input.options}
				<!-- MCQ-style option list — stacked, full-width for long text -->
				<div class="flex flex-col gap-2">
					{#each input.options as option}
						<button
							type="button"
							onclick={() => handleButtonSelect(option)}
							class={[
								'w-full rounded-lg border px-4 py-3 text-left text-sm leading-relaxed transition-all',
								selectedButton === option
									? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
									: 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50'
							].join(' ')}
						>
							{option}
						</button>
					{/each}
				</div>
			{:else if inputType === 'select' && input.options}
				<Select.Root type="single" bind:value={selectValue}>
					<Select.Trigger class="w-full">
						{selectValue || input.placeholder || 'Select an option'}
					</Select.Trigger>
					<Select.Content>
						{#each input.options as option}
							<Select.Item value={option} label={option} />
						{/each}
					</Select.Content>
				</Select.Root>
			{:else if inputType === 'date'}
				<Input
					type="date"
					placeholder={input.placeholder}
					bind:value={inputValue}
					onkeydown={handleKeydown}
					required={isRequired}
					class="w-full"
				/>
			{:else if inputType === 'number'}
				<Input
					type="number"
					placeholder={input.placeholder}
					bind:value={inputValue}
					onkeydown={handleKeydown}
					required={isRequired}
					class="w-full"
				/>
			{:else}
				<Input
					type="text"
					placeholder={input.placeholder}
					bind:value={inputValue}
					onkeydown={handleKeydown}
					required={isRequired}
					class="w-full"
				/>
			{/if}
		</Card.Content>
		{#if inputType !== 'button_select'}
			<Card.Footer>
				<Button onclick={handleSubmit} disabled={isDisabled} class="w-full gap-2">
					<Send class="h-4 w-4" />
					Submit
				</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
{:else if isSubmitted}
	<!-- Show submitted state with question and answer -->
	<Card.Root class="w-full max-w-lg border-primary/20 bg-primary/5">
		<Card.Header class="pb-2">
			<div class="flex items-center gap-2">
				<Badge variant="default" class="gap-1 bg-primary">
					<Check class="h-3 w-3" />
					Answered
				</Badge>
			</div>
			<Card.Title class="text-sm leading-snug font-normal text-muted-foreground">
				<span class="prose prose-sm max-w-none [&_p]:m-0 [&_p]:inline">{@html marked(input?.prompt ?? 'Input')}</span>
			</Card.Title>
		</Card.Header>
		<Card.Content class="pt-0">
			<div class="rounded-md border border-primary/20 bg-primary/10 px-3 py-2">
				<p class="text-sm font-semibold text-foreground">{output?.value ?? ''}</p>
			</div>
		</Card.Content>
	</Card.Root>
{:else if isExpired && input}
	<!-- Show expired state — user refreshed before answering -->
	<Card.Root class="w-full max-w-lg border-muted bg-muted/30 opacity-70">
		<Card.Header class="pb-2">
			<div class="flex items-center gap-2">
				<Badge variant="secondary" class="gap-1 text-muted-foreground">Expired</Badge>
			</div>
			<Card.Title class="text-sm font-normal text-muted-foreground">
				<span class="prose prose-sm max-w-none [&_p]:m-0 [&_p]:inline">{@html marked(input.prompt)}</span>
			</Card.Title>
		</Card.Header>
		<Card.Content class="pt-0">
			<p class="text-xs text-muted-foreground/70">This input request was not answered.</p>
		</Card.Content>
	</Card.Root>
{/if}
