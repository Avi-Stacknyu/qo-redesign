<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import { ScrollArea } from '$lib/components/shadcn/scroll-area';
	import { Skeleton } from '$lib/components/shadcn/skeleton';
	import * as Collapsible from '$lib/components/shadcn/collapsible';
	import * as ToggleGroup from '$lib/components/shadcn/toggle-group';
	import * as Tabs from '$lib/components/shadcn/tabs';
	import type { DebugEvent, DebugMessage } from '$lib/remote/agent.remote';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Clock from '@lucide/svelte/icons/clock';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import XCircle from '@lucide/svelte/icons/x-circle';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Zap from '@lucide/svelte/icons/zap';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Code from '@lucide/svelte/icons/code';
	import Database from '@lucide/svelte/icons/database';
	import Cpu from '@lucide/svelte/icons/cpu';
	import Activity from '@lucide/svelte/icons/activity';
	import Filter from '@lucide/svelte/icons/filter';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import FileJson from '@lucide/svelte/icons/file-json';
	import Copy from '@lucide/svelte/icons/copy';
	import { toast } from 'svelte-sonner';
	import type { Component } from 'svelte';

	interface Props {
		logs: DebugEvent[];
		loading: boolean;
		onClear?: () => void;
		debugMessages?: DebugMessage[];
		debugMessagesLoading?: boolean;
	}

	let {
		logs,
		loading,
		onClear,
		debugMessages = [],
		debugMessagesLoading = false
	}: Props = $props();

	// Active tab
	let activeTab = $state<'events' | 'messages'>('messages');

	// Filter state
	type CategoryFilter = 'all' | 'context' | 'llm' | 'tool' | 'extraction' | 'error' | 'cost';
	let activeFilter = $state<CategoryFilter>('all');

	// Filtered logs
	let filteredLogs = $derived(
		activeFilter === 'all' ? logs : logs.filter((l) => l.eventCategory === activeFilter)
	);

	// Computed stats
	let stats = $derived(() => {
		const errorCount = logs.filter((l) => l.eventCategory === 'error').length;
		const totalDuration = logs.reduce((sum, l) => sum + (l.durationMs || 0), 0);
		const llmCount = logs.filter((l) => l.eventCategory === 'llm').length;
		const toolCount = logs.filter((l) => l.eventCategory === 'tool').length;
		return { errorCount, totalDuration, llmCount, toolCount };
	});

	// Category counts for filter badges
	let categoryCounts = $derived(() => {
		const counts: Record<string, number> = {};
		logs.forEach((l) => {
			counts[l.eventCategory] = (counts[l.eventCategory] || 0) + 1;
		});
		return counts;
	});

	function getEventIcon(category: string): Component {
		switch (category) {
			case 'llm':
				return MessageSquare;
			case 'tool':
				return Zap;
			case 'extraction':
				return Code;
			case 'context':
				return Database;
			default:
				return Cpu;
		}
	}

	function getCategoryColor(category: string): string {
		switch (category) {
			case 'llm':
				return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
			case 'tool':
				return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
			case 'extraction':
				return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
			case 'context':
				return 'bg-green-500/10 text-green-500 border-green-500/20';
			case 'error':
				return 'bg-red-500/10 text-red-500 border-red-500/20';
			case 'cost':
				return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}

	function getStatusFromCategory(category: string): string {
		switch (category) {
			case 'error':
				return 'error';
			case 'cost':
				return 'success';
			default:
				return 'pending';
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'success':
				return 'text-green-500';
			case 'error':
				return 'text-red-500';
			case 'warning':
				return 'text-yellow-500';
			case 'pending':
				return 'text-blue-500';
			default:
				return 'text-muted-foreground';
		}
	}

	function getStatusIcon(status: string): Component {
		switch (status) {
			case 'success':
				return CheckCircle;
			case 'error':
				return XCircle;
			case 'warning':
				return AlertTriangle;
			default:
				return Clock;
		}
	}

	function formatDuration(ms: number | undefined): string {
		if (!ms) return '-';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	function formatTimestamp(dateString: string): string {
		return new Date(dateString).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3
		});
	}

	function formatJSON(data: unknown): string {
		try {
			return JSON.stringify(data, null, 2);
		} catch {
			return String(data);
		}
	}

	function copyToClipboard(text: string, label: string) {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	}

	function formatCost(cost?: number): string {
		if (cost === undefined || cost === null) return 'N/A';
		return `$${cost.toFixed(6)}`;
	}
</script>

<div class="flex h-full flex-col overflow-hidden border-l bg-muted/30">
	<!-- Header -->
	<div class="flex shrink-0 items-center justify-between border-b bg-background px-3 py-2">
		<div class="flex items-center gap-2">
			<Activity class="h-4 w-4 text-muted-foreground" />
			<span class="text-sm font-medium">Debug</span>
		</div>
		<div class="flex items-center gap-2">
			{#if activeTab === 'events' && stats().errorCount > 0}
				<Badge variant="destructive" class="h-5 text-[10px]">
					{stats().errorCount} errors
				</Badge>
			{/if}
			<Badge variant="outline" class="h-5 text-[10px]">
				{activeTab === 'events' ? logs.length : debugMessages.length}
			</Badge>
			{#if activeTab === 'events' && logs.length > 0 && onClear}
				<Button
					variant="ghost"
					size="icon"
					class="h-6 w-6 text-muted-foreground hover:text-destructive"
					onclick={onClear}
				>
					<Trash2 class="h-3.5 w-3.5" />
					<span class="sr-only">Clear logs</span>
				</Button>
			{/if}
		</div>
	</div>

	<!-- Tabs -->
	<Tabs.Root bind:value={activeTab} class="flex flex-1 flex-col overflow-hidden">
		<div class="border-b px-2 py-1.5">
			<Tabs.List class="h-8">
				<Tabs.Trigger value="messages" class="gap-1.5 text-xs">
					<FileJson class="h-3.5 w-3.5" />
					AI Input/Output
				</Tabs.Trigger>
				<Tabs.Trigger value="events" class="gap-1.5 text-xs">
					<Activity class="h-3.5 w-3.5" />
					Events
				</Tabs.Trigger>
			</Tabs.List>
		</div>

		<!-- Messages Tab - Full AI Input/Output -->
		<Tabs.Content value="messages" class="flex-1 overflow-hidden data-[state=inactive]:hidden">
			<ScrollArea class="h-full">
				{#if debugMessagesLoading}
					<div class="space-y-2 p-3">
						{#each [1, 2] as _}
							<Skeleton class="h-24 w-full" />
						{/each}
					</div>
				{:else if debugMessages.length === 0}
					<div class="flex h-full flex-col items-center justify-center py-12 text-muted-foreground">
						<FileJson class="mb-3 h-10 w-10 opacity-40" />
						<p class="text-sm">No debug data yet</p>
						<p class="text-xs opacity-70">Send a message to capture AI input/output</p>
					</div>
				{:else}
					<div class="space-y-2 p-2">
						{#each debugMessages as msg}
							<div class="rounded-md border bg-background">
								<!-- Header -->
								<div class="flex items-center justify-between border-b px-3 py-2">
									<div class="flex items-center gap-2">
										<Badge variant="outline" class="text-[10px]">{msg.role}</Badge>
										<span class="text-[10px] text-muted-foreground">
											{formatTimestamp(msg.created)}
										</span>
									</div>
									<div class="flex items-center gap-3 text-[10px] text-muted-foreground">
										{#if msg.modelId}
											<span class="flex items-center gap-1">
												<Cpu class="h-3 w-3" />
												{msg.modelId}
											</span>
										{/if}
										{#if msg.latencyMs}
											<span>{formatDuration(msg.latencyMs)}</span>
										{/if}
										{#if msg.costUsd}
											<span>{formatCost(msg.costUsd)}</span>
										{/if}
									</div>
								</div>

								<!-- Token Stats -->
								{#if msg.inputTokens || msg.outputTokens}
									<div class="flex gap-4 border-b px-3 py-1.5 text-[10px] text-muted-foreground">
										<span>Input: <span class="font-mono">{msg.inputTokens ?? 0}</span></span>
										<span>Output: <span class="font-mono">{msg.outputTokens ?? 0}</span></span>
									</div>
								{/if}

								<!-- Collapsible Content -->
								<div class="space-y-1 p-2">
									<!-- User Message -->
									{#if msg.userMessage}
										<Collapsible.Root class="rounded border">
											<Collapsible.Trigger
												class="flex w-full items-center justify-between px-2 py-1 hover:bg-muted/50"
											>
												<span class="text-[10px] font-medium">User Message</span>
												<Button
													variant="ghost"
													size="icon"
													class="h-5 w-5"
													onclick={(e) => {
														e.stopPropagation();
														copyToClipboard(msg.userMessage ?? '', 'User message');
													}}
												>
													<Copy class="h-3 w-3" />
												</Button>
											</Collapsible.Trigger>
											<Collapsible.Content>
												<div class="border-t p-2">
													<pre
														class="max-h-24 overflow-auto text-[10px] whitespace-pre-wrap">{msg.userMessage}</pre>
												</div>
											</Collapsible.Content>
										</Collapsible.Root>
									{/if}

									<!-- System Prompt -->
									{#if msg.systemPrompt}
										<Collapsible.Root class="rounded border">
											<Collapsible.Trigger
												class="flex w-full items-center justify-between px-2 py-1 hover:bg-muted/50"
											>
												<div class="flex items-center gap-2">
													<span class="text-[10px] font-medium">System Prompt</span>
													<Badge variant="secondary" class="h-4 text-[9px]">
														{msg.systemPrompt.length.toLocaleString()} chars
													</Badge>
												</div>
												<Button
													variant="ghost"
													size="icon"
													class="h-5 w-5"
													onclick={(e) => {
														e.stopPropagation();
														copyToClipboard(msg.systemPrompt ?? '', 'System prompt');
													}}
												>
													<Copy class="h-3 w-3" />
												</Button>
											</Collapsible.Trigger>
											<Collapsible.Content>
												<div class="border-t p-2">
													<pre
														class="max-h-48 overflow-auto font-mono text-[10px] whitespace-pre-wrap">{msg.systemPrompt}</pre>
												</div>
											</Collapsible.Content>
										</Collapsible.Root>
									{/if}

									<!-- Full Messages Array -->
									{#if msg.fullMessagesJson && msg.fullMessagesJson.length > 0}
										<Collapsible.Root class="rounded border">
											<Collapsible.Trigger
												class="flex w-full items-center justify-between px-2 py-1 hover:bg-muted/50"
											>
												<div class="flex items-center gap-2">
													<span class="text-[10px] font-medium">Messages Array</span>
													<Badge variant="secondary" class="h-4 text-[9px]">
														{msg.fullMessagesJson.length} messages
													</Badge>
												</div>
												<Button
													variant="ghost"
													size="icon"
													class="h-5 w-5"
													onclick={(e) => {
														e.stopPropagation();
														copyToClipboard(formatJSON(msg.fullMessagesJson), 'Messages JSON');
													}}
												>
													<Copy class="h-3 w-3" />
												</Button>
											</Collapsible.Trigger>
											<Collapsible.Content>
												<div class="border-t p-2">
													<pre class="max-h-48 overflow-auto font-mono text-[10px]">{formatJSON(
															msg.fullMessagesJson
														)}</pre>
												</div>
											</Collapsible.Content>
										</Collapsible.Root>
									{/if}

									<!-- Assistant Response -->
									{#if msg.assistantResponse}
										<Collapsible.Root class="rounded border">
											<Collapsible.Trigger
												class="flex w-full items-center justify-between px-2 py-1 hover:bg-muted/50"
											>
												<div class="flex items-center gap-2">
													<span class="text-[10px] font-medium">Assistant Response</span>
													<Badge variant="secondary" class="h-4 text-[9px]">
														{msg.assistantResponse.length.toLocaleString()} chars
													</Badge>
												</div>
												<Button
													variant="ghost"
													size="icon"
													class="h-5 w-5"
													onclick={(e) => {
														e.stopPropagation();
														copyToClipboard(msg.assistantResponse ?? '', 'Assistant response');
													}}
												>
													<Copy class="h-3 w-3" />
												</Button>
											</Collapsible.Trigger>
											<Collapsible.Content>
												<div class="border-t p-2">
													<pre
														class="max-h-48 overflow-auto font-mono text-[10px] whitespace-pre-wrap">{msg.assistantResponse}</pre>
												</div>
											</Collapsible.Content>
										</Collapsible.Root>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</ScrollArea>
		</Tabs.Content>

		<!-- Events Tab - Real-time Debug Events -->
		<Tabs.Content
			value="events"
			class="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
		>
			<!-- Filter Bar -->
			{#if logs.length > 0}
				<div
					class="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background/50 px-2 py-1.5"
				>
					<Filter class="h-3 w-3 text-muted-foreground" />
					<Button
						variant={activeFilter === 'all' ? 'secondary' : 'ghost'}
						size="sm"
						class="h-5 px-1.5 text-[10px]"
						onclick={() => (activeFilter = 'all')}
					>
						All
						<Badge variant="outline" class="ml-1 h-3.5 px-1 text-[9px]">{logs.length}</Badge>
					</Button>
					{#each ['llm', 'tool', 'context', 'extraction', 'cost', 'error'] as category}
						{@const count = categoryCounts()[category] || 0}
						{#if count > 0}
							<Button
								variant={activeFilter === category ? 'secondary' : 'ghost'}
								size="sm"
								class="h-5 px-1.5 text-[10px] {activeFilter === category
									? getCategoryColor(category)
									: ''}"
								onclick={() => (activeFilter = category as CategoryFilter)}
							>
								{category}
								<Badge variant="outline" class="ml-1 h-3.5 px-1 text-[9px]">{count}</Badge>
							</Button>
						{/if}
					{/each}
				</div>

				<!-- Stats Bar -->
				<div
					class="flex shrink-0 items-center gap-4 border-b bg-background/50 px-3 py-1.5 text-[10px] text-muted-foreground"
				>
					<span>Total: {formatDuration(stats().totalDuration)}</span>
					<span>LLM calls: {stats().llmCount}</span>
					<span>Tool calls: {stats().toolCount}</span>
				</div>
			{/if}

			<ScrollArea class="min-h-0 flex-1">
				{#if logs.length === 0 && !loading}
					<div class="flex h-full flex-col items-center justify-center py-12 text-muted-foreground">
						<Cpu class="mb-3 h-10 w-10 opacity-40" />
						<p class="text-sm">No debug events yet</p>
						<p class="text-xs opacity-70">Events stream in real-time during execution</p>
					</div>
				{:else if logs.length === 0 && loading}
					<div class="flex h-full flex-col items-center justify-center py-12 text-muted-foreground">
						<Activity class="mb-3 h-10 w-10 animate-pulse opacity-40" />
						<p class="text-sm">Waiting for events...</p>
					</div>
				{:else if filteredLogs.length === 0}
					<div class="flex h-full flex-col items-center justify-center py-12 text-muted-foreground">
						<Filter class="mb-3 h-10 w-10 opacity-40" />
						<p class="text-sm">No logs match filter</p>
						<Button variant="ghost" size="sm" onclick={() => (activeFilter = 'all')}>
							Clear filter
						</Button>
					</div>
				{:else}
					<div class="space-y-1 p-2">
						{#each filteredLogs as log, i}
							{@const EventIcon = getEventIcon(log.eventCategory)}
							{@const status = getStatusFromCategory(log.eventCategory)}
							{@const StatusIcon = getStatusIcon(status)}

							<Collapsible.Root class="rounded-md border bg-background">
								<Collapsible.Trigger
									class="flex w-full items-center gap-2 px-2 py-1.5 hover:bg-muted/50"
								>
									<ChevronRight
										class="h-3 w-3 shrink-0 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90"
									/>

									<div
										class="flex h-6 w-6 shrink-0 items-center justify-center rounded {getCategoryColor(
											log.eventCategory
										)}"
									>
										<EventIcon class="h-3 w-3" />
									</div>

									<div class="flex min-w-0 flex-1 items-center gap-2">
										<span class="truncate text-xs font-medium">{log.eventType}</span>
										<Badge variant="outline" class="h-4 shrink-0 px-1 text-[9px]"
											>{log.eventCategory}</Badge
										>
									</div>

									<div class="flex shrink-0 items-center gap-1.5">
										{#if log.durationMs}
											<span class="text-[10px] text-muted-foreground tabular-nums">
												{formatDuration(log.durationMs)}
											</span>
										{/if}
										<StatusIcon class="h-3.5 w-3.5 {getStatusColor(status)}" />
									</div>
								</Collapsible.Trigger>

								<Collapsible.Content>
									<div class="space-y-2 border-t bg-muted/20 px-2 py-2">
										<!-- Timestamp & Sequence -->
										<div
											class="flex items-center justify-between text-[10px] text-muted-foreground"
										>
											<div class="flex items-center gap-1">
												<Clock class="h-3 w-3" />
												<span class="tabular-nums">{formatTimestamp(log.timestamp)}</span>
											</div>
											<span>#{log.sequenceNumber}</span>
										</div>

										<!-- Data -->
										{#if log.data && Object.keys(log.data).length > 0}
											<div class="space-y-1">
												<p class="text-[10px] font-medium text-muted-foreground">Payload</p>
												<pre
													class="max-h-32 overflow-auto rounded border bg-background p-1.5 text-[10px] leading-relaxed">{formatJSON(
														log.data
													)}</pre>
											</div>
										{/if}

										<!-- Message ID reference -->
										{#if log.messageId}
											<div class="flex items-center gap-2 text-[10px]">
												<span class="text-muted-foreground">Message:</span>
												<code class="rounded bg-muted px-1 py-0.5 font-mono">{log.messageId}</code>
											</div>
										{/if}
									</div>
								</Collapsible.Content>
							</Collapsible.Root>
						{/each}
					</div>
				{/if}
			</ScrollArea>
		</Tabs.Content>
	</Tabs.Root>
</div>
