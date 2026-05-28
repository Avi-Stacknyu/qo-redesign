<!--
  MessagePartsRenderer - Renders all parts of an AI message
  Handles text, charts, tables, confirmations, and input requests.
  AI SDK tool part states: input-streaming → input-available → output-available | output-error
-->
<script lang="ts">
	import { marked } from 'marked';
	import { Skeleton } from '$ui/skeleton';
	import ChartRenderer from './chart-renderer.svelte';
	import TableRenderer from './table-renderer.svelte';
	import ConfirmationDialog from './confirmation-dialog.svelte';
	import InputRequestForm from './input-request-form.svelte';
	import type { MessagePart } from '../../types/generative-ui';
	import { AlertCircle, CircleCheck, Loader2 } from '@lucide/svelte';

	interface Props {
		parts: MessagePart[];
		onConfirmationRespond?: (confirmed: boolean, toolCallId: string) => void;
		onInputSubmit?: (value: string, toolCallId: string) => void;
	}

	let { parts, onConfirmationRespond, onInputSubmit }: Props = $props();

	// Configure marked for text part rendering
	marked.setOptions({ breaks: true, gfm: true });

	// Friendly tool name labels for loading states
	const toolLabels: Record<string, string> = {
		'tool-display_chart': 'Generating chart',
		'tool-display_table': 'Building table',
		'tool-ask_confirmation': 'Preparing confirmation',
		'tool-request_input': 'Preparing input form',
		'tool-dashboard_update': 'Updating dashboard'
	};

	const dashboardActionLabels: Record<string, string> = {
		widget_added: 'Widget added to dashboard',
		widget_removed: 'Widget removed from dashboard',
		widget_updated: 'Widget updated',
		widgets_reordered: 'Widgets reordered',
		theme_updated: 'Dashboard theme updated',
		data_created: 'Widget data created'
	};
</script>

<div class="space-y-3">
	{#each parts as part, index (index)}
		{#if part.type === 'text'}
			<!-- Text content rendered with full markdown support -->
			<div class="rounded-2xl rounded-bl-md border border-border/60 bg-muted px-4 py-2.5 text-foreground shadow-sm">
				<div
					class="prose prose-sm max-w-none prose-a:font-medium prose-code:before:content-none prose-code:after:content-none prose-code:bg-background/80 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-pre:bg-background prose-hr:hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:m-0 [&>p]:leading-relaxed"
				>
					{@html marked(part.text)}
				</div>
			</div>
		{:else if part.type === 'tool-display_chart'}
			{#if part.state === 'output-available' && part.output}
				<ChartRenderer output={part.output} />
			{:else if part.state === 'output-error'}
				<div
					class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
				>
					<AlertCircle class="h-4 w-4 shrink-0" />
					<span>Failed to generate chart{part.errorText ? `: ${part.errorText}` : ''}</span>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
						<Loader2 class="h-3 w-3 animate-spin" />
						<span>{toolLabels[part.type] ?? 'Loading'}…</span>
					</div>
					<Skeleton class="h-50 w-full rounded-lg" />
				</div>
			{/if}
		{:else if part.type === 'tool-display_table'}
			{#if part.state === 'output-available' && part.output}
				<TableRenderer output={part.output} />
			{:else if part.state === 'output-error'}
				<div
					class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
				>
					<AlertCircle class="h-4 w-4 shrink-0" />
					<span>Failed to build table{part.errorText ? `: ${part.errorText}` : ''}</span>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
						<Loader2 class="h-3 w-3 animate-spin" />
						<span>{toolLabels[part.type] ?? 'Loading'}…</span>
					</div>
					<Skeleton class="h-37.5 w-full rounded-lg" />
				</div>
			{/if}
		{:else if part.type === 'tool-ask_confirmation'}
			{#if part.state === 'input-available' || part.state === 'output-available' || part.state === 'expired'}
				<ConfirmationDialog
					partState={part.state}
					input={part.input}
					output={part.output}
					toolCallId={part.toolCallId}
					onRespond={onConfirmationRespond}
				/>
			{:else if part.state === 'output-error'}
				<div
					class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
				>
					<AlertCircle class="h-4 w-4 shrink-0" />
					<span>Confirmation failed{part.errorText ? `: ${part.errorText}` : ''}</span>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
						<Loader2 class="h-3 w-3 animate-spin" />
						<span>{toolLabels[part.type] ?? 'Loading'}…</span>
					</div>
					<Skeleton class="h-25 w-full max-w-md rounded-lg" />
				</div>
			{/if}
		{:else if part.type === 'tool-request_input'}
			{#if part.state === 'input-available' || part.state === 'output-available' || part.state === 'expired'}
				<InputRequestForm
					partState={part.state}
					input={part.input}
					output={part.output}
					toolCallId={part.toolCallId}
					onSubmit={onInputSubmit}
				/>
			{:else if part.state === 'output-error'}
				<div
					class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
				>
					<AlertCircle class="h-4 w-4 shrink-0" />
					<span>Input request failed{part.errorText ? `: ${part.errorText}` : ''}</span>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
						<Loader2 class="h-3 w-3 animate-spin" />
						<span>{toolLabels[part.type] ?? 'Loading'}…</span>
					</div>
					<Skeleton class="h-37.5 w-full max-w-md rounded-lg" />
				</div>
			{/if}
		{:else if part.type === 'tool-dashboard_update'}
			{#if part.state === 'output-available' && part.output}
				<div
					class="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground"
				>
					<CircleCheck class="h-4 w-4 shrink-0 text-primary" />
					<span>{dashboardActionLabels[part.output.action] ?? 'Dashboard updated'}</span>
				</div>
			{:else if part.state === 'output-error'}
				<div
					class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
				>
					<AlertCircle class="h-4 w-4 shrink-0" />
					<span>Dashboard update failed{part.errorText ? `: ${part.errorText}` : ''}</span>
				</div>
			{:else}
				<div class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
					<Loader2 class="h-3 w-3 animate-spin" />
					<span>{toolLabels[part.type] ?? 'Loading'}…</span>
				</div>
			{/if}
		{/if}
	{/each}
</div>
