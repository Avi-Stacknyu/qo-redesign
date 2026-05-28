<!--
  ConfirmationDialog - Renders confirmation requests from AI (Human-in-the-Loop)

  AI SDK pattern: The ask_confirmation tool has NO execute function on the server.
  The tool call is forwarded to the client in 'input-available' state with
  part.input containing { message, action_description, severity }.
  When the user responds, addToolOutput() is called, which transitions the
  part to 'output-available' with part.output = { confirmed, message }.
-->
<script lang="ts">
	import { marked } from 'marked';
	import * as AlertDialog from '$ui/alert-dialog';
	import { Badge } from '$ui/badge';
	import { AlertTriangle, AlertCircle, Info, Check, X } from '@lucide/svelte';

	marked.setOptions({ breaks: true, gfm: true });

	/** Tool call input schema from the server */
	interface ToolInput {
		message: string;
		action_description: string;
		severity?: 'info' | 'warning' | 'danger';
	}

	/** Tool output schema (what addToolOutput sends) */
	interface ToolOutput {
		confirmed: boolean;
		message: string;
	}

	interface Props {
		/** AI SDK tool part state */
		partState: string;
		/** Tool call input (the confirmation config from the model) */
		input?: ToolInput;
		/** Tool output (the user's response, available after addToolOutput) */
		output?: ToolOutput;
		toolCallId: string;
		onRespond?: (confirmed: boolean, toolCallId: string) => void;
	}

	let { partState, input, output, toolCallId, onRespond }: Props = $props();

	const isAwaitingConfirmation = $derived(
		partState === 'input-available' || partState === 'input-streaming'
	);
	const isResolved = $derived(partState === 'output-available');
	const isExpired = $derived(partState === 'expired');
	const severity = $derived(input?.severity ?? 'warning');

	function handleConfirm() {
		onRespond?.(true, toolCallId);
	}

	function handleCancel() {
		onRespond?.(false, toolCallId);
	}

	function getSeverityIcon(sev: 'info' | 'warning' | 'danger') {
		switch (sev) {
			case 'danger':
				return AlertTriangle;
			case 'warning':
				return AlertCircle;
			default:
				return Info;
		}
	}

	function getSeverityColor(sev: 'info' | 'warning' | 'danger') {
		switch (sev) {
			case 'danger':
				return 'text-destructive';
			case 'warning':
				return 'text-destructive/70';
			default:
				return 'text-primary';
		}
	}

	let SeverityIcon = $derived(getSeverityIcon(severity));
	let severityColor = $derived(getSeverityColor(severity));
</script>

{#if isAwaitingConfirmation && input}
	<AlertDialog.Root open={true}>
		<AlertDialog.Content class="max-w-md">
			<AlertDialog.Header>
				<div class="flex items-start gap-3">
					<div class="rounded-full bg-muted p-2 {severityColor}">
						<SeverityIcon class="h-5 w-5" />
					</div>
					<div class="flex-1">
						<AlertDialog.Title class="text-base">
							<span class="prose prose-sm max-w-none [&_p]:m-0 [&_p]:inline">{@html marked(input.message)}</span>
						</AlertDialog.Title>
						<AlertDialog.Description class="mt-2">
							<span class="prose prose-sm max-w-none [&_p]:m-0 [&_p]:inline">{@html marked(input.action_description)}</span>
						</AlertDialog.Description>
					</div>
				</div>
			</AlertDialog.Header>
			<AlertDialog.Footer class="gap-2 sm:gap-2">
				<AlertDialog.Cancel onclick={handleCancel} class="gap-2">
					<X class="h-4 w-4" />
					Cancel
				</AlertDialog.Cancel>
				<AlertDialog.Action
					onclick={handleConfirm}
					class="gap-2 {severity === 'danger' ? 'bg-destructive hover:bg-destructive/90' : ''}"
				>
					<Check class="h-4 w-4" />
					Confirm
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{:else if isResolved}
	<!-- Show result card when already responded -->
	{@const confirmed = output?.confirmed ?? false}
	<div
		class="w-full max-w-md rounded-lg border {confirmed
			? 'border-primary/20 bg-primary/5'
			: 'border-muted bg-muted/30'}"
	>
		<div class="p-4">
			<div class="flex items-start gap-3">
				<div
					class="rounded-full p-2 {confirmed
						? 'bg-primary/10 text-primary'
						: 'bg-muted text-muted-foreground'}"
				>
					{#if confirmed}
						<Check class="h-4 w-4" />
					{:else}
						<X class="h-4 w-4" />
					{/if}
				</div>
				<div class="flex-1">
					<div class="mb-1 flex items-center gap-2">
						<Badge variant={confirmed ? 'default' : 'secondary'} class="gap-1">
							{#if confirmed}
								<Check class="h-3 w-3" />
								Confirmed
							{:else}
								<X class="h-3 w-3" />
								Declined
							{/if}
						</Badge>
					</div>
					<div class="prose prose-sm max-w-none text-sm text-muted-foreground [&_p]:m-0">{@html marked(input?.message ?? '')}</div>
					<div class="prose prose-sm max-w-none mt-1 text-xs text-muted-foreground/70 [&_p]:m-0">{@html marked(input?.action_description ?? '')}</div>
				</div>
			</div>
		</div>
	</div>
{:else if isExpired && input}
	<!-- Show expired state — user refreshed before answering -->
	<div class="w-full max-w-md rounded-lg border border-muted bg-muted/30 opacity-70">
		<div class="p-4">
			<div class="flex items-start gap-3">
				<div class="rounded-full bg-muted p-2 text-muted-foreground">
					<SeverityIcon class="h-4 w-4" />
				</div>
				<div class="flex-1">
					<div class="mb-1 flex items-center gap-2">
						<Badge variant="secondary" class="gap-1 text-muted-foreground">Expired</Badge>
					</div>
					<div class="prose prose-sm max-w-none text-sm text-muted-foreground [&_p]:m-0">{@html marked(input.message)}</div>
					<p class="mt-1 text-xs text-muted-foreground/70">This confirmation was not answered.</p>
				</div>
			</div>
		</div>
	</div>
{/if}
