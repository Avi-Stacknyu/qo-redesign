<script lang="ts">
	import { page } from '$app/state';
	import {
		getChatMessages,
		getChatDebugMessages,
		getChatAnalytics
	} from '../../user-details.remote';
	import { Button } from '$lib/components/shadcn/button';
	import {
		ArrowLeft,
		Copy,
		Download,
		Bug,
		MessageSquare,
		User,
		ChevronDown,
		Sparkles,
		Brain,
		Paperclip,
		BookOpen,
		Database,
		Bot,
		Layers,
		FileJson,
		DollarSign,
		Coins,
		Clock,
		Cpu,
		ArrowRightLeft,
		Server,
		BarChart3
	} from '@lucide/svelte';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Skeleton } from '$lib/components/shadcn/skeleton';
	import { Separator } from '$lib/components/shadcn/separator';
	import * as Card from '$lib/components/shadcn/card';
	import * as Collapsible from '$lib/components/shadcn/collapsible';
	import {
		BreakdownDonutChart,
		TokenStackedBar,
		BreakdownBarChart
	} from '$lib/components/analytics';
	import ModelTimeline from './model-timeline.svelte';
	import ContextDataChart from './context-data-chart.svelte';
	import { toast } from 'svelte-sonner';
	import { marked } from 'marked';
	import { MessagePartsRenderer, type MessagePart } from '@repo/shared/components';

	const chatId = $derived(page.params.chatId ?? '');
	const userId = $derived(page.params.id);
	const messagesPromise = $derived(getChatMessages(chatId));
	const debugMessagesPromise = $derived(getChatDebugMessages(chatId));
	const analyticsPromise = $derived(getChatAnalytics(chatId));

	let activeTab = $state<'messages' | 'statistics' | 'debug'>('messages');

	function copy(text: string, label = 'Content') {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied`);
	}

	function downloadJson(data: unknown, filename: string) {
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success(`Downloaded ${filename}`);
	}

	async function copyAllMessages() {
		const messages = await messagesPromise;
		const formatted = messages
			.map((m: any) => `[${m.role?.toUpperCase()}]\n${m.message}`)
			.join('\n\n---\n\n');
		copy(formatted, 'All messages');
	}

	async function downloadChatHistory() {
		const messages = await messagesPromise;
		downloadJson(messages, `chat-${chatId}.json`);
	}

	async function downloadDebugData() {
		const debugMessages = await debugMessagesPromise;
		downloadJson(debugMessages, `chat-debug-${chatId}.json`);
	}

	function time(d: string) {
		return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function date(d: string) {
		return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function cost(c?: number): string {
		if (c == null) return '';
		return `$${c.toFixed(6)}`;
	}

	function latency(ms?: number): string {
		if (ms == null) return '';
		return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
	}

	function formatUsd(value: number) {
		return value.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 6
		});
	}

	function formatCompact(value: number) {
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
		return value.toLocaleString();
	}

	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
		if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
		return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
	}

	const tabs = [
		{ key: 'messages' as const, label: 'Messages', icon: MessageSquare },
		{ key: 'statistics' as const, label: 'Statistics', icon: BarChart3 },
		{ key: 'debug' as const, label: 'Debug', icon: Bug }
	];
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between px-5 py-3">
		<div class="flex items-center gap-3">
			<a
				href="/users/{userId}/chats"
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
			>
				<ArrowLeft class="h-4 w-4" />
			</a>
			<div class="min-w-0">
				{#await analyticsPromise then analytics}
					{#if analytics?.chat}
						<div class="flex items-center gap-2">
							<h1 class="truncate text-sm font-semibold">
								{analytics.chat.title || 'Untitled Chat'}
							</h1>
							{#if analytics.chat.agentName}
								<Badge variant="default" class="gap-1 text-[10px]">
									<Bot class="h-3 w-3" />
									{analytics.chat.agentName}
								</Badge>
							{/if}
						</div>
					{:else}
						<h1 class="text-sm font-semibold">Chat Session</h1>
					{/if}
				{:catch}
					<h1 class="text-sm font-semibold">Chat Session</h1>
				{/await}
				<p class="font-mono text-[10px] text-muted-foreground">{chatId}</p>
			</div>
		</div>

		<div class="flex items-center gap-1">
			<Button variant="ghost" size="sm" onclick={copyAllMessages} class="h-7 gap-1.5 text-xs">
				<Copy class="h-3 w-3" />
				Copy
			</Button>
			<Button variant="ghost" size="sm" onclick={downloadChatHistory} class="h-7 gap-1.5 text-xs">
				<Download class="h-3 w-3" />
				Export
			</Button>
		</div>
	</div>

	<!-- Tab navigation -->
	<nav class="flex gap-0.5 border-b px-5" aria-label="Chat sections">
		{#each tabs as tab}
			{@const active = tab.key === activeTab}
			<button
				onclick={() => (activeTab = tab.key)}
				class="relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors
					{active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
			>
				<tab.icon class="h-3.5 w-3.5" />
				{tab.label}
				{#if active}
					<span class="absolute right-3 bottom-0 left-3 h-0.5 rounded-full bg-primary"></span>
				{/if}
			</button>
		{/each}
	</nav>

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto">
		{#if activeTab === 'messages'}
			<!-- ═══════════ MESSAGES ═══════════ -->
			{#await messagesPromise}
				<div class="space-y-3 p-6">
					{#each Array(4) as _}
						<div class="space-y-2 rounded-lg border p-4">
							<Skeleton class="h-3 w-24" />
							<Skeleton class="h-16 w-full" />
						</div>
					{/each}
				</div>
			{:then messages}
				{#if messages.length === 0}
					<div class="flex flex-col items-center justify-center py-20 text-center">
						<MessageSquare class="mb-2 h-6 w-6 text-muted-foreground/30" />
						<p class="text-sm text-muted-foreground">No messages</p>
					</div>
				{:else}
					<div class="divide-y">
						{#each messages as msg, i}
							{@const isUser = msg.role === 'user'}
							{@const showDate =
								i === 0 || date(messages[i - 1].created ?? '') !== date(msg.created ?? '')}
							{@const msgMeta = msg.meta as { parts?: MessagePart[] } | undefined}
							{@const hasParts =
								msgMeta?.parts && Array.isArray(msgMeta.parts) && msgMeta.parts.length > 0}

							{#if showDate}
								<div class="flex items-center justify-center bg-muted/20 py-1.5">
									<span class="text-[11px] font-medium text-muted-foreground">
										{date(msg.created ?? '')}
									</span>
								</div>
							{/if}

							<div
								class="group relative transition-colors hover:bg-muted/20 {isUser
									? 'bg-background'
									: 'bg-muted/5'}"
							>
								<div class="mx-auto max-w-4xl px-6 py-4">
									<!-- Role header -->
									<div class="mb-2 flex items-center gap-2">
										<div
											class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full
												{isUser ? 'bg-primary/10' : 'bg-violet-500/10'}"
										>
											{#if isUser}
												<User class="h-3 w-3 text-primary" />
											{:else}
												<Sparkles class="h-3 w-3 text-violet-500" />
											{/if}
										</div>
										<span
											class="text-xs font-semibold {isUser
												? 'text-foreground'
												: 'text-violet-600 dark:text-violet-400'}"
										>
											{isUser ? 'User' : 'Assistant'}
										</span>
										<span class="text-[10px] text-muted-foreground">{time(msg.created ?? '')}</span>
										<button
											class="ml-auto opacity-0 transition-opacity group-hover:opacity-50 hover:opacity-100!"
											onclick={() => copy(msg.message || '', 'Message')}
										>
											<Copy class="h-3 w-3" />
										</button>
									</div>

									<!-- Message content -->
									<div class="space-y-3 pl-7">
										{#if msg.message}
											<!-- Render text content as markdown -->
											<div
												class="prose prose-sm max-w-none text-[13px] leading-relaxed dark:prose-invert prose-headings:mt-3 prose-headings:mb-2 prose-p:my-1.5 prose-pre:my-2 prose-ol:my-1.5 prose-ul:my-1.5"
											>
												{@html marked.parse(msg.message)}
											</div>
										{/if}
										{#if hasParts && msgMeta?.parts}
											<!-- Render gen-UI parts (charts, tables, confirmations, etc.) -->
											<MessagePartsRenderer parts={msgMeta.parts} />
										{/if}
										{#if !msg.message && !hasParts}
											<span class="text-xs text-muted-foreground italic">Empty message</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{:catch error}
				<div class="p-6 text-center">
					<p class="text-sm text-destructive">Failed to load messages: {error.message}</p>
				</div>
			{/await}
		{:else if activeTab === 'statistics'}
			<!-- ═══════════ STATISTICS ═══════════ -->
			{#await analyticsPromise}
				<div class="space-y-3 p-6">
					<div class="grid grid-cols-3 gap-3 lg:grid-cols-7">
						{#each Array(7) as _}
							<Skeleton class="h-14 rounded-lg" />
						{/each}
					</div>
					<div class="grid gap-3 md:grid-cols-2">
						<Skeleton class="h-48 rounded-lg" />
						<Skeleton class="h-48 rounded-lg" />
					</div>
				</div>
			{:then analytics}
				{#if analytics}
					{@const summary = analytics.summary}
					{@const turns = analytics.turns}
					{@const ioRatio =
						summary.totalInputTokens > 0
							? (summary.totalOutputTokens / summary.totalInputTokens).toFixed(2)
							: 'N/A'}

					<div class="space-y-4 p-6">
						<!-- Compact summary row -->
						<div class="grid grid-cols-3 gap-3 lg:grid-cols-7">
							<div class="flex items-center gap-2 rounded-lg border p-2.5">
								<div class="rounded-md bg-primary/10 p-1">
									<DollarSign class="h-3 w-3 text-primary" />
								</div>
								<div>
									<p class="text-xs font-semibold">{formatUsd(summary.totalCostUsd)}</p>
									<p class="text-[9px] text-muted-foreground">Cost</p>
								</div>
							</div>
							<div class="flex items-center gap-2 rounded-lg border p-2.5">
								<div class="rounded-md bg-blue-500/10 p-1">
									<Coins class="h-3 w-3 text-blue-500" />
								</div>
								<div>
									<p class="text-xs font-semibold">{formatCompact(summary.totalTokens)}</p>
									<p class="text-[9px] text-muted-foreground">
										{formatCompact(summary.totalInputTokens)}→{formatCompact(
											summary.totalOutputTokens
										)}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2 rounded-lg border p-2.5">
								<div class="rounded-md bg-violet-500/10 p-1">
									<MessageSquare class="h-3 w-3 text-violet-500" />
								</div>
								<div>
									<p class="text-xs font-semibold">{summary.messageCount}</p>
									<p class="text-[9px] text-muted-foreground">Turns</p>
								</div>
							</div>
							<div class="flex items-center gap-2 rounded-lg border p-2.5">
								<div class="rounded-md bg-amber-500/10 p-1">
									<Clock class="h-3 w-3 text-amber-500" />
								</div>
								<div>
									<p class="text-xs font-semibold">{formatDuration(summary.durationMs)}</p>
									<p class="text-[9px] text-muted-foreground">Duration</p>
								</div>
							</div>
							<div class="flex items-center gap-2 rounded-lg border p-2.5">
								<div class="rounded-md bg-rose-500/10 p-1">
									<ArrowRightLeft class="h-3 w-3 text-rose-500" />
								</div>
								<div>
									<p class="text-xs font-semibold">{ioRatio}</p>
									<p class="text-[9px] text-muted-foreground">I/O Ratio</p>
								</div>
							</div>
							<div class="flex items-center gap-2 rounded-lg border p-2.5">
								<div class="rounded-md bg-sky-500/10 p-1">
									<Cpu class="h-3 w-3 text-sky-500" />
								</div>
								<div>
									<p class="text-xs font-semibold">{summary.modelsUsed.length}</p>
									<p class="text-[9px] text-muted-foreground">
										{summary.modelsUsed.length === 1 ? 'Model' : 'Models'}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2 rounded-lg border p-2.5">
								<div class="rounded-md bg-orange-500/10 p-1">
									<Server class="h-3 w-3 text-orange-500" />
								</div>
								<div>
									<p class="text-xs font-semibold">{summary.providersUsed.length}</p>
									<p class="text-[9px] text-muted-foreground">
										{summary.providersUsed.length === 1 ? 'Provider' : 'Providers'}
									</p>
								</div>
							</div>
						</div>

						<!-- Model/provider tags -->
						<div class="flex flex-wrap gap-1.5">
							{#each summary.modelsUsed as model}
								<Badge variant="secondary" class="text-[10px]">
									<Cpu class="mr-1 h-2.5 w-2.5" />{model}
								</Badge>
							{/each}
							{#each summary.providersUsed as provider}
								<Badge variant="outline" class="text-[10px]">
									<Server class="mr-1 h-2.5 w-2.5" />{provider}
								</Badge>
							{/each}
						</div>

						<!-- Charts -->
						<div class="grid gap-3 md:grid-cols-2">
							<Card.Root>
								<Card.Header class="px-4 pt-3 pb-1">
									<Card.Title class="text-xs font-medium">Cost per Turn</Card.Title>
								</Card.Header>
								<Card.Content class="px-2 pb-3">
									<BreakdownBarChart
										data={turns.map((t) => ({ label: `#${t.sequenceNumber}`, value: t.costUsd }))}
										height="h-40"
										color="var(--chart-1)"
										valueLabel="Cost (USD)"
										formatValue={(v) => `$${v.toFixed(6)}`}
									/>
								</Card.Content>
							</Card.Root>
							<Card.Root>
								<Card.Header class="px-4 pt-3 pb-1">
									<Card.Title class="text-xs font-medium">Tokens per Turn</Card.Title>
								</Card.Header>
								<Card.Content class="px-2 pb-3">
									<TokenStackedBar
										data={turns.map((t) => ({
											label: `#${t.sequenceNumber}`,
											inputTokens: t.inputTokens,
											outputTokens: t.outputTokens
										}))}
										height="h-40"
									/>
								</Card.Content>
							</Card.Root>
							{#if summary.modelsUsed.length > 1}
								<Card.Root>
									<Card.Header class="px-4 pt-3 pb-1">
										<Card.Title class="text-xs font-medium">Cost by Model</Card.Title>
									</Card.Header>
									<Card.Content class="px-2 pb-3">
										<BreakdownDonutChart
											data={(() => {
												const m = new Map<string, number>();
												turns.forEach((t) => m.set(t.modelId, (m.get(t.modelId) ?? 0) + t.costUsd));
												return Array.from(m.entries()).map(([model, c]) => ({
													label: model.length > 20 ? model.slice(0, 19) + '…' : model,
													value: c
												}));
											})()}
											formatValue={(v) => `$${v.toFixed(4)}`}
											size={120}
										/>
									</Card.Content>
								</Card.Root>
							{/if}
						</div>

						<!-- Model Timeline -->
						{#if turns.length > 1}
							<Card.Root>
								<Card.Header class="px-4 pt-3 pb-1">
									<Card.Title class="text-xs font-medium">Model Timeline</Card.Title>
								</Card.Header>
								<Card.Content class="px-4 pb-3">
									<ModelTimeline {turns} />
								</Card.Content>
							</Card.Root>
						{/if}

						<!-- Context Injection -->
						{#if turns.some((t) => t.contextData.factsCount > 0 || t.contextData.attachedFilesCount > 0 || t.contextData.docsCount > 0 || t.contextData.knowledgeCount > 0)}
							<Card.Root>
								<Card.Header class="px-4 pt-3 pb-1">
									<Card.Title class="text-xs font-medium">Context Injection</Card.Title>
								</Card.Header>
								<Card.Content class="px-4 pb-3">
									<ContextDataChart {turns} />
								</Card.Content>
							</Card.Root>
						{/if}

						<!-- Prompt/Completion Ratio -->
						<Card.Root>
							<Card.Header class="px-4 pt-3 pb-1">
								<Card.Title class="text-xs font-medium">Prompt / Completion Ratio</Card.Title>
							</Card.Header>
							<Card.Content class="px-4 pb-3">
								<div class="space-y-1.5">
									{#each turns as turn}
										{@const total = turn.inputTokens + turn.outputTokens}
										{@const inputPct = total > 0 ? (turn.inputTokens / total) * 100 : 0}
										{@const outputPct = total > 0 ? (turn.outputTokens / total) * 100 : 0}
										<div class="flex items-center gap-2">
											<span class="w-6 text-right font-mono text-[10px] text-muted-foreground">
												#{turn.sequenceNumber}
											</span>
											<div class="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
												{#if inputPct > 0}
													<div
														class="flex items-center justify-center"
														style="width: {inputPct}%; background: var(--chart-1)"
													>
														{#if inputPct > 18}
															<span class="text-[8px] font-medium text-white"
																>{inputPct.toFixed(0)}%</span
															>
														{/if}
													</div>
												{/if}
												{#if outputPct > 0}
													<div
														class="flex items-center justify-center"
														style="width: {outputPct}%; background: var(--chart-2)"
													>
														{#if outputPct > 18}
															<span class="text-[8px] font-medium text-white"
																>{outputPct.toFixed(0)}%</span
															>
														{/if}
													</div>
												{/if}
											</div>
											<span class="w-14 text-right font-mono text-[10px] text-muted-foreground">
												{formatCompact(total)}
											</span>
										</div>
									{/each}
									<div class="flex items-center gap-3 pt-1 text-[10px]">
										<div class="flex items-center gap-1">
											<span class="h-2 w-2 rounded-sm" style="background: var(--chart-1)"></span>
											<span class="text-muted-foreground">Input</span>
										</div>
										<div class="flex items-center gap-1">
											<span class="h-2 w-2 rounded-sm" style="background: var(--chart-2)"></span>
											<span class="text-muted-foreground">Output</span>
										</div>
									</div>
								</div>
							</Card.Content>
						</Card.Root>
					</div>
				{:else}
					<div class="p-6 text-center">
						<p class="text-sm text-muted-foreground">No analytics data available</p>
					</div>
				{/if}
			{:catch error}
				<div class="p-6">
					<p class="text-sm text-destructive">Failed to load analytics: {error.message}</p>
				</div>
			{/await}
		{:else if activeTab === 'debug'}
			<!-- ═══════════ DEBUG ═══════════ -->
			<div class="flex items-center justify-between px-6 pt-4 pb-2">
				<p class="text-xs text-muted-foreground">Per-turn AI request details</p>
				<Button variant="ghost" size="sm" onclick={downloadDebugData} class="h-7 gap-1.5 text-xs">
					<Download class="h-3 w-3" />
					Export
				</Button>
			</div>

			{#await debugMessagesPromise}
				<div class="space-y-2 px-6 pb-6">
					{#each Array(3) as _}
						<Skeleton class="h-16 w-full rounded-lg" />
					{/each}
				</div>
			{:then debugMessages}
				{#if debugMessages.length === 0}
					<div class="flex flex-col items-center justify-center py-20 text-center">
						<Bug class="mb-2 h-6 w-6 text-muted-foreground/30" />
						<p class="text-sm text-muted-foreground">No debug data</p>
					</div>
				{:else}
					<div class="space-y-2 px-6 pb-6">
						{#each debugMessages as debug, i}
							{@const cd = (debug.contextData ?? {}) as Record<string, number>}
							{@const hasContext =
								(cd.factsCount ?? 0) > 0 ||
								(cd.attachedFilesCount ?? 0) > 0 ||
								(cd.docsCount ?? 0) > 0 ||
								(cd.knowledgeCount ?? 0) > 0}

							<Collapsible.Root
								class="group/turn rounded-lg border transition-colors hover:border-border/80"
							>
								<Collapsible.Trigger class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
									<span
										class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] font-semibold text-muted-foreground"
									>
										{i + 1}
									</span>

									<div class="flex min-w-0 flex-1 items-center gap-1.5">
										{#if debug.modelId}
											<span class="truncate text-xs font-medium">{debug.modelId}</span>
										{/if}
										{#if debug.provider}
											<Badge variant="secondary" class="shrink-0 text-[10px]">
												{debug.provider}
											</Badge>
										{/if}
									</div>

									<div class="flex shrink-0 items-center gap-1.5">
										{#if debug.inputTokens || debug.outputTokens}
											<span
												class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
											>
												{debug.inputTokens ?? 0}→{debug.outputTokens ?? 0}
											</span>
										{/if}
										{#if debug.costUsd}
											<span
												class="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400"
											>
												{cost(debug.costUsd)}
											</span>
										{/if}
										{#if debug.latencyMs}
											<span
												class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
											>
												{latency(debug.latencyMs)}
											</span>
										{/if}
										{#if hasContext}
											<div class="flex items-center gap-0.5">
												{#if (cd.factsCount ?? 0) > 0}
													<span
														class="flex items-center gap-0.5 rounded bg-violet-500/10 px-1 py-0.5 text-[10px] text-violet-600 dark:text-violet-400"
													>
														<Brain class="h-2.5 w-2.5" />{cd.factsCount}
													</span>
												{/if}
												{#if (cd.attachedFilesCount ?? 0) > 0}
													<span
														class="flex items-center gap-0.5 rounded bg-blue-500/10 px-1 py-0.5 text-[10px] text-blue-600 dark:text-blue-400"
													>
														<Paperclip class="h-2.5 w-2.5" />{cd.attachedFilesCount}
													</span>
												{/if}
												{#if (cd.docsCount ?? 0) > 0}
													<span
														class="flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.5 text-[10px] text-amber-600 dark:text-amber-400"
													>
														<BookOpen class="h-2.5 w-2.5" />{cd.docsCount}
													</span>
												{/if}
												{#if (cd.knowledgeCount ?? 0) > 0}
													<span
														class="flex items-center gap-0.5 rounded bg-teal-500/10 px-1 py-0.5 text-[10px] text-teal-600 dark:text-teal-400"
													>
														<Database class="h-2.5 w-2.5" />{cd.knowledgeCount}
													</span>
												{/if}
											</div>
										{/if}
										<ChevronDown
											class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/turn:rotate-180"
										/>
									</div>
								</Collapsible.Trigger>

								<Collapsible.Content>
									<div class="space-y-2.5 border-t px-3 py-3">
										{#if debug.userMessage}
											<div class="space-y-1">
												<div class="flex items-center gap-1.5">
													<User class="h-3 w-3 text-muted-foreground" />
													<span class="text-[11px] font-medium text-muted-foreground">User</span>
													<button
														class="ml-auto opacity-40 hover:opacity-100"
														onclick={() => copy(debug.userMessage ?? '', 'User message')}
													>
														<Copy class="h-3 w-3" />
													</button>
												</div>
												<p
													class="rounded-md bg-muted/40 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
												>
													{debug.userMessage}
												</p>
											</div>
										{/if}

										{#if debug.assistantResponse}
											<div class="space-y-1">
												<div class="flex items-center gap-1.5">
													<Sparkles class="h-3 w-3 text-violet-500" />
													<span class="text-[11px] font-medium text-muted-foreground"
														>Assistant</span
													>
													<Badge variant="secondary" class="text-[9px]">
														{debug.assistantResponse.length.toLocaleString()} chars
													</Badge>
													<button
														class="ml-auto opacity-40 hover:opacity-100"
														onclick={() => copy(debug.assistantResponse ?? '', 'Response')}
													>
														<Copy class="h-3 w-3" />
													</button>
												</div>
												<p
													class="max-h-40 overflow-y-auto rounded-md bg-muted/40 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
												>
													{debug.assistantResponse}
												</p>
											</div>
										{/if}

										{#if debug.systemPrompt}
											<Collapsible.Root>
												<Collapsible.Trigger
													class="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-muted/40"
												>
													<FileJson class="h-3 w-3 text-amber-500" />
													<span class="text-[11px] font-medium text-muted-foreground"
														>System Prompt</span
													>
													<Badge variant="secondary" class="text-[9px]">
														{debug.systemPrompt.length.toLocaleString()} chars
													</Badge>
													<ChevronDown
														class="ml-auto h-3 w-3 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180"
													/>
												</Collapsible.Trigger>
												<Collapsible.Content>
													<div class="mt-1 flex justify-end">
														<button
															class="text-[10px] text-muted-foreground hover:text-foreground"
															onclick={() => copy(debug.systemPrompt ?? '', 'System prompt')}
														>
															Copy
														</button>
													</div>
													<pre
														class="max-h-48 overflow-auto rounded-md bg-muted/30 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{debug.systemPrompt}</pre>
												</Collapsible.Content>
											</Collapsible.Root>
										{/if}

										{#if debug.fullMessagesJson && debug.fullMessagesJson.length > 0}
											<Collapsible.Root>
												<Collapsible.Trigger
													class="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-muted/40"
												>
													<Layers class="h-3 w-3 text-blue-500" />
													<span class="text-[11px] font-medium text-muted-foreground"
														>Full Context</span
													>
													<Badge variant="secondary" class="text-[9px]">
														{debug.fullMessagesJson.length} msgs
													</Badge>
													<ChevronDown
														class="ml-auto h-3 w-3 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180"
													/>
												</Collapsible.Trigger>
												<Collapsible.Content>
													<div class="mt-1 flex justify-end">
														<button
															class="text-[10px] text-muted-foreground hover:text-foreground"
															onclick={() =>
																copy(
																	JSON.stringify(debug.fullMessagesJson, null, 2),
																	'Context JSON'
																)}
														>
															Copy JSON
														</button>
													</div>
													<div class="space-y-1">
														{#each debug.fullMessagesJson as contextMsg, idx}
															<div class="rounded-md bg-muted/30 p-2">
																<div class="mb-0.5 flex items-center gap-1.5">
																	<Badge
																		variant={contextMsg.role === 'user'
																			? 'default'
																			: contextMsg.role === 'system'
																				? 'secondary'
																				: 'outline'}
																		class="text-[9px]"
																	>
																		{contextMsg.role}
																	</Badge>
																	<span class="text-[10px] text-muted-foreground">#{idx + 1}</span>
																</div>
																<p
																	class="line-clamp-3 text-[11px] whitespace-pre-wrap text-muted-foreground"
																>
																	{contextMsg.content}
																</p>
															</div>
														{/each}
													</div>
												</Collapsible.Content>
											</Collapsible.Root>
										{/if}
									</div>
								</Collapsible.Content>
							</Collapsible.Root>
						{/each}
					</div>
				{/if}
			{:catch error}
				<div class="p-6">
					<p class="text-sm text-destructive">Failed to load debug data: {error.message}</p>
				</div>
			{/await}
		{/if}
	</div>
</div>
