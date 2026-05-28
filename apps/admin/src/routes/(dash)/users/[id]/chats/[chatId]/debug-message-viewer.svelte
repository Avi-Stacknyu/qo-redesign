<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import * as Collapsible from '$lib/components/shadcn/collapsible';
	import * as Card from '$lib/components/shadcn/card';
	import {
		Copy,
		ChevronDown,
		ChevronRight,
		Clock,
		Cpu,
		DollarSign,
		FileJson
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { ChatDebugMessage } from '../../user-details.remote';

	interface Props {
		debugMessage: ChatDebugMessage;
	}

	let { debugMessage }: Props = $props();

	let systemPromptOpen = $state(false);
	let messagesOpen = $state(false);
	let responseOpen = $state(false);

	function copyToClipboard(text: string, label: string) {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	}

	function formatJson(obj: unknown): string {
		return JSON.stringify(obj, null, 2);
	}

	function formatCost(cost?: number): string {
		if (cost === undefined || cost === null) return 'N/A';
		return `$${cost.toFixed(6)}`;
	}

	function formatLatency(ms?: number): string {
		if (ms === undefined || ms === null) return 'N/A';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}
</script>

<Card.Root class="border-border/50 bg-muted/30">
	<Card.Header class="pb-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Badge variant="outline" class="bg-background">
					{debugMessage.role}
				</Badge>
				<span class="text-xs text-muted-foreground">
					{new Date(debugMessage.created).toLocaleString()}
				</span>
			</div>
			<div class="flex items-center gap-4 text-xs text-muted-foreground">
				{#if debugMessage.modelId}
					<div class="flex items-center gap-1">
						<Cpu class="h-3 w-3" />
						<span>{debugMessage.modelId}</span>
					</div>
				{/if}
				{#if debugMessage.latencyMs}
					<div class="flex items-center gap-1">
						<Clock class="h-3 w-3" />
						<span>{formatLatency(debugMessage.latencyMs)}</span>
					</div>
				{/if}
				{#if debugMessage.costUsd}
					<div class="flex items-center gap-1">
						<DollarSign class="h-3 w-3" />
						<span>{formatCost(debugMessage.costUsd)}</span>
					</div>
				{/if}
			</div>
		</div>
		{#if debugMessage.inputTokens || debugMessage.outputTokens}
			<div class="flex gap-4 pt-2 text-xs">
				<span class="text-muted-foreground">
					Input: <span class="font-mono text-foreground">{debugMessage.inputTokens ?? 0}</span> tokens
				</span>
				<span class="text-muted-foreground">
					Output: <span class="font-mono text-foreground">{debugMessage.outputTokens ?? 0}</span> tokens
				</span>
			</div>
		{/if}
	</Card.Header>
	<Card.Content class="space-y-3 pt-0">
		<!-- User Message -->
		{#if debugMessage.userMessage}
			<div class="rounded-md border bg-background p-3">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-medium text-muted-foreground">User Message</span>
					<Button
						variant="ghost"
						size="icon"
						class="h-6 w-6"
						onclick={() => copyToClipboard(debugMessage.userMessage ?? '', 'User message')}
					>
						<Copy class="h-3 w-3" />
					</Button>
				</div>
				<p class="text-sm whitespace-pre-wrap">{debugMessage.userMessage}</p>
			</div>
		{/if}

		<!-- System Prompt (Collapsible) -->
		{#if debugMessage.systemPrompt}
			<Collapsible.Root bind:open={systemPromptOpen}>
				<div class="rounded-md border bg-background">
					<Collapsible.Trigger
						class="flex w-full items-center justify-between p-3 hover:bg-muted/50"
					>
						<div class="flex items-center gap-2">
							{#if systemPromptOpen}
								<ChevronDown class="h-4 w-4" />
							{:else}
								<ChevronRight class="h-4 w-4" />
							{/if}
							<span class="text-xs font-medium text-muted-foreground">System Prompt</span>
							<Badge variant="secondary" class="text-xs">
								{debugMessage.systemPrompt.length.toLocaleString()} chars
							</Badge>
						</div>
						<Button
							variant="ghost"
							size="icon"
							class="h-6 w-6"
							onclick={(e) => {
								e.stopPropagation();
								copyToClipboard(debugMessage.systemPrompt ?? '', 'System prompt');
							}}
						>
							<Copy class="h-3 w-3" />
						</Button>
					</Collapsible.Trigger>
					<Collapsible.Content>
						<div class="border-t p-3">
							<pre
								class="max-h-96 overflow-auto font-mono text-xs whitespace-pre-wrap text-muted-foreground">{debugMessage.systemPrompt}</pre>
						</div>
					</Collapsible.Content>
				</div>
			</Collapsible.Root>
		{/if}

		<!-- Full Messages Array (Collapsible) -->
		{#if debugMessage.fullMessagesJson && debugMessage.fullMessagesJson.length > 0}
			<Collapsible.Root bind:open={messagesOpen}>
				<div class="rounded-md border bg-background">
					<Collapsible.Trigger
						class="flex w-full items-center justify-between p-3 hover:bg-muted/50"
					>
						<div class="flex items-center gap-2">
							{#if messagesOpen}
								<ChevronDown class="h-4 w-4" />
							{:else}
								<ChevronRight class="h-4 w-4" />
							{/if}
							<FileJson class="h-4 w-4 text-muted-foreground" />
							<span class="text-xs font-medium text-muted-foreground">Full Messages Array</span>
							<Badge variant="secondary" class="text-xs">
								{debugMessage.fullMessagesJson.length} messages
							</Badge>
						</div>
						<Button
							variant="ghost"
							size="icon"
							class="h-6 w-6"
							onclick={(e) => {
								e.stopPropagation();
								copyToClipboard(formatJson(debugMessage.fullMessagesJson), 'Messages JSON');
							}}
						>
							<Copy class="h-3 w-3" />
						</Button>
					</Collapsible.Trigger>
					<Collapsible.Content>
						<div class="border-t p-3">
							<pre
								class="max-h-96 overflow-auto font-mono text-xs text-muted-foreground">{formatJson(
									debugMessage.fullMessagesJson
								)}</pre>
						</div>
					</Collapsible.Content>
				</div>
			</Collapsible.Root>
		{/if}

		<!-- Assistant Response (Collapsible) -->
		{#if debugMessage.assistantResponse}
			<Collapsible.Root bind:open={responseOpen}>
				<div class="rounded-md border bg-background">
					<Collapsible.Trigger
						class="flex w-full items-center justify-between p-3 hover:bg-muted/50"
					>
						<div class="flex items-center gap-2">
							{#if responseOpen}
								<ChevronDown class="h-4 w-4" />
							{:else}
								<ChevronRight class="h-4 w-4" />
							{/if}
							<span class="text-xs font-medium text-muted-foreground">Assistant Response</span>
							<Badge variant="secondary" class="text-xs">
								{debugMessage.assistantResponse.length.toLocaleString()} chars
							</Badge>
						</div>
						<Button
							variant="ghost"
							size="icon"
							class="h-6 w-6"
							onclick={(e) => {
								e.stopPropagation();
								copyToClipboard(debugMessage.assistantResponse ?? '', 'Assistant response');
							}}
						>
							<Copy class="h-3 w-3" />
						</Button>
					</Collapsible.Trigger>
					<Collapsible.Content>
						<div class="border-t p-3">
							<pre
								class="max-h-96 overflow-auto font-mono text-xs whitespace-pre-wrap text-muted-foreground">{debugMessage.assistantResponse}</pre>
						</div>
					</Collapsible.Content>
				</div>
			</Collapsible.Root>
		{/if}

		<!-- Context Data -->
		{#if debugMessage.contextData && Object.keys(debugMessage.contextData).length > 0}
			<div class="rounded-md border bg-background p-3">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-medium text-muted-foreground">Context Summary</span>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each Object.entries(debugMessage.contextData) as [key, value]}
						<Badge variant="outline" class="text-xs">
							{key}: {value}
						</Badge>
					{/each}
				</div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
