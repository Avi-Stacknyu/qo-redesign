<script lang="ts">
	import { marked } from 'marked';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
	import type { UIMessage } from 'ai';
	import { MessagePartsRenderer } from '@repo/shared/components';

	// Configure marked for markdown rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});
	import type { MessagePart, DoneEventData, ChatFileAttachment } from '@repo/shared/types';
	import {
		serverMessagesToUIMessages,
		uiPartsToMessageParts,
		getMessageContent
	} from '@repo/shared/utils';
	import {
		getPlaygroundThreads,
		getThreadMessagesRaw,
		createPlaygroundThread,
		deletePlaygroundThread,
		getDebugMessages,
		getAvailableModels,
		type PlaygroundThread,
		type DebugMessage,
		type DebugEvent,
		type ModelWithProvider
	} from '$lib/remote/agent.remote';
	import { Button } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Skeleton } from '$lib/components/shadcn/skeleton';
	import { ScrollArea } from '$lib/components/shadcn/scroll-area';
	import * as Resizable from '$lib/components/shadcn/resizable';
	import { toast } from 'svelte-sonner';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import PanelRightClose from '@lucide/svelte/icons/panel-right-close';
	import PanelRightOpen from '@lucide/svelte/icons/panel-right-open';
	import User from '@lucide/svelte/icons/user';
	import Bot from '@lucide/svelte/icons/bot';
	import BrainCircuit from '@lucide/svelte/icons/brain-circuit';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Coins from '@lucide/svelte/icons/coins';
	import Zap from '@lucide/svelte/icons/zap';
	import DebugPanel from './debug-panel.svelte';
	import ChatInput from './chat-input.svelte';
	import ModelPicker from './model-picker.svelte';

	interface Props {
		agentId: string;
		agentName: string;
	}

	let { agentId, agentName }: Props = $props();

	// ============================================================================
	// Thread Management
	// ============================================================================

	const threadsQuery = $derived(getPlaygroundThreads({ agentId }));
	const modelsQuery = $derived(getAvailableModels());
	let threads = $state<PlaygroundThread[]>([]);
	let models = $state<ModelWithProvider[]>([]);
	let selectedThreadId = $state<string | null>(null);
	let selectedModelId = $state<string | null>(null);
	let showDebugPanel = $state(true);

	// ============================================================================
	// Chat Instance (AI SDK)
	// ============================================================================

	let chat = $state<Chat | null>(null);
	let chatLoading = $state(false);

	// Pending file attachments for the next sendMessage call
	let pendingFiles = $state<ChatFileAttachment[]>([]);

	// ============================================================================
	// Debug State
	// ============================================================================

	let debugMessages = $state<DebugMessage[]>([]);
	let debugMessagesLoading = $state(false);

	// Real-time debug events (streamed via onData callback)
	let realtimeLogs = $state<DebugEvent[]>([]);
	let debugEventSequence = $state(0);

	// Index into realtimeLogs where the current stream's events begin
	// (so AI I/O tab builds its message from only the latest stream's events)
	let currentStreamStartIndex = $state(0);

	// Track debug message count before current stream for dedup
	let preStreamDebugCount = $state(0);

	// ============================================================================
	// Session Cost (computed from both PB debug messages AND real-time stream events)
	// ============================================================================

	let sessionCost = $derived.by(() => {
		let totalInputTokens = 0;
		let totalOutputTokens = 0;
		let totalCostUsd = 0;

		// Add from persisted debug messages (loaded from PB)
		for (const msg of debugMessages) {
			totalInputTokens += msg.inputTokens || 0;
			totalOutputTokens += msg.outputTokens || 0;
			totalCostUsd += msg.costUsd || 0;
		}

		// Add from current-stream real-time cost events only if PB hasn't ingested them yet
		const pbHasCurrentStream = debugMessages.length > preStreamDebugCount;
		if (!pbHasCurrentStream) {
			const currentStreamLogs = realtimeLogs.slice(currentStreamStartIndex);
			for (const log of currentStreamLogs) {
				if (log.eventType === 'cost_event' || log.eventType === 'llm_call_complete') {
					const data = log.data as Record<string, unknown>;
					totalInputTokens += (data.inputTokens as number) || 0;
					totalOutputTokens += (data.outputTokens as number) || 0;
					totalCostUsd += (data.costUsd as number) || 0;
				}
			}
		}

		return {
			inputTokens: totalInputTokens,
			outputTokens: totalOutputTokens,
			totalTokens: totalInputTokens + totalOutputTokens,
			costUsd: totalCostUsd
		};
	});

	// ============================================================================
	// Real-time AI I/O Debug Message (constructed from streaming events)
	// ============================================================================

	let realtimeDebugMessage = $derived.by((): DebugMessage | null => {
		// Only look at events from the current stream (not previous messages)
		const currentStreamLogs = realtimeLogs.slice(currentStreamStartIndex);

		// Build a temporary debug message from real-time events for current streaming session
		const llmComplete = currentStreamLogs.findLast((l) => l.eventType === 'llm_call_complete');
		const contextComplete = currentStreamLogs.findLast((l) => l.eventType === 'context_complete');
		const fullSystemPrompt = currentStreamLogs.findLast(
			(l) => l.eventType === 'full_system_prompt'
		);
		const chatState = currentStreamLogs.findLast((l) => l.eventType === 'chat_state');
		const fullResponse = currentStreamLogs.findLast((l) => l.eventType === 'full_response');
		const costEvent = currentStreamLogs.findLast((l) => l.eventType === 'cost_event');

		// Show partial data as soon as ANY relevant event arrives (not just llm/context complete)
		if (!llmComplete && !contextComplete && !fullSystemPrompt && !chatState) return null;

		const llmData = (llmComplete?.data as Record<string, unknown>) || {};
		const contextData = (contextComplete?.data as Record<string, unknown>) || {};
		const promptData = (fullSystemPrompt?.data as Record<string, unknown>) || {};
		const stateData = (chatState?.data as Record<string, unknown>) || {};
		const responseData = (fullResponse?.data as Record<string, unknown>) || {};
		const costData = (costEvent?.data as Record<string, unknown>) || {};

		// Prefer cost_event data as it's more complete, fall back to llmComplete
		const inputTokens = (costData.inputTokens as number) || (llmData.inputTokens as number) || 0;
		const outputTokens = (costData.outputTokens as number) || (llmData.outputTokens as number) || 0;
		const costUsd = (costData.costUsd as number) || (llmData.costUsd as number) || 0;

		return {
			id: 'realtime-debug',
			chatId: selectedThreadId || '',
			role: 'assistant',
			systemPrompt: (promptData.prompt as string) || undefined,
			fullMessagesJson:
				(stateData.messages as Array<{ role: string; content: string }>) || undefined,
			assistantResponse: (responseData.responsePreview as string) || undefined,
			modelId: (llmData.model as string) || (responseData.model as string) || undefined,
			provider: (llmData.provider as string) || undefined,
			inputTokens,
			outputTokens,
			costUsd,
			latencyMs: (llmData.durationMs as number) || 0,
			contextData: contextData as Record<string, unknown>,
			created: new Date().toISOString()
		};
	});

	// Combined debug messages: persisted + real-time
	let combinedDebugMessages = $derived.by((): DebugMessage[] => {
		const messages = [...debugMessages];
		if (realtimeDebugMessage) {
			// Show realtime debug message during AND after streaming.
			// Only exclude it once PB data has been refreshed with new entries
			// (meaning the server has persisted the debug data for this stream).
			const pbHasNewData = !isStreaming && debugMessages.length > preStreamDebugCount;
			if (!pbHasNewData) {
				messages.push(realtimeDebugMessage);
			}
		}
		return messages;
	});

	// ============================================================================
	// Auto-scroll
	// ============================================================================

	let messagesEndRef: HTMLDivElement | null = $state(null);

	function scrollToBottom() {
		setTimeout(() => {
			messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
		}, 50);
	}

	// ============================================================================
	// Derived State
	// ============================================================================

	const isStreaming = $derived(chat?.status === 'streaming' || chat?.status === 'submitted');

	const isThinking = $derived.by(() => {
		if (!chat) return false;
		if (chat.status === 'submitted') return true;
		if (chat.status === 'streaming') {
			const msgs = chat.messages;
			const lastMsg = msgs[msgs.length - 1];
			if (lastMsg?.role === 'assistant') {
				const hasVisibleContent = lastMsg.parts.some((p) => {
					if (p.type === 'text' && 'text' in p) {
						return (p as { text: string }).text.trim().length > 0;
					}
					if ((p.type as string).startsWith('tool-')) return true;
					return false;
				});
				return !hasVisibleContent;
			}
		}
		return false;
	});

	// ============================================================================
	// Sync & Effects
	// ============================================================================

	// Sync threads from query
	$effect(() => {
		const result = threadsQuery.current;
		if (result && Array.isArray(result)) {
			threads = result as PlaygroundThread[];
		}
	});

	// Sync models from query
	$effect(() => {
		const result = modelsQuery.current;
		if (result && Array.isArray(result)) {
			models = result as ModelWithProvider[];
		}
	});

	// Load chat + debug when thread changes
	$effect(() => {
		if (selectedThreadId) {
			// Clear real-time logs when switching threads
			realtimeLogs = [];
			debugEventSequence = 0;
			currentStreamStartIndex = 0;
			initChatForThread(selectedThreadId);
			loadDebugMessages(selectedThreadId);
		} else {
			chat = null;
			debugMessages = [];
			realtimeLogs = [];
			debugEventSequence = 0;
			currentStreamStartIndex = 0;
		}
	});

	// Auto-scroll on new messages
	$effect(() => {
		if (chat && chat.messages.length > 0) {
			scrollToBottom();
		}
	});

	// ============================================================================
	// Chat Initialization
	// ============================================================================

	async function initChatForThread(threadId: string) {
		chatLoading = true;
		try {
			const rawMessages = await getThreadMessagesRaw({ threadId });
			const { messages: uiMessages } = serverMessagesToUIMessages(
				rawMessages as Array<{
					id: string;
					role: string;
					content: string;
					created_at: string;
					files?: ChatFileAttachment[];
					parts?: unknown[];
				}>
			);

			chat = new Chat({
				id: threadId,
				messages: uiMessages as UIMessage[],
				transport: new DefaultChatTransport({
					api: `/api/playground/${threadId}/stream`,
					prepareSendMessagesRequest: ({ messages }) => {
						const lastMsg = messages[messages.length - 1];

						// Detect tool-result resend (HIL flow)
						if (lastMsg?.role === 'assistant') {
							const assistantText = lastMsg.parts
								.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
								.map((p) => p.text)
								.join('');

							const hilToolTypes = ['tool-ask_confirmation', 'tool-request_input'];
							const toolResults = lastMsg.parts
								.filter(
									(p) =>
										typeof p.type === 'string' &&
										hilToolTypes.includes(p.type) &&
										'state' in p &&
										(p as Record<string, unknown>).state === 'output-available' &&
										'toolCallId' in p
								)
								.map((p) => ({
									toolCallId: (p as Record<string, unknown>).toolCallId as string,
									toolName: (p.type as string).slice(5),
									args: (p as Record<string, unknown>).input,
									output: (p as Record<string, unknown>).output
								}));

							return {
								body: {
									toolResults,
									assistantText,
									agentId,
									respondMessageId: lastMsg.id,
									modelOverrideId: selectedModelId ?? undefined
								}
							};
						}

						// Normal user message
						const textPart = lastMsg?.parts?.find(
							(p): p is { type: 'text'; text: string } => p.type === 'text'
						);
						return {
							body: {
								message: textPart?.text ?? '',
								agentId,
								attachments: pendingFiles.map((f) => ({
									id: f.id,
									name: f.name,
									size: f.size,
									type: f.type
								})),
								modelOverrideId: selectedModelId ?? undefined
							}
						};
					}
				}),
				sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
				// Real-time debug event streaming
				onData: (dataPart) => {
					// Handle debug events from the worker's data stream
					if (dataPart.type === 'data-debug') {
						const debugData = dataPart.data as Record<string, unknown>;
						const eventType = (debugData.type as string) || 'unknown';

						// Map event type to category
						let eventCategory: 'context' | 'llm' | 'tool' | 'extraction' | 'error' | 'cost' =
							'context';
						if (
							eventType.startsWith('llm_') ||
							eventType === 'full_response' ||
							eventType === 'full_system_prompt' ||
							eventType === 'chat_state'
						) {
							eventCategory = 'llm';
						} else if (eventType.startsWith('extraction_')) {
							eventCategory = 'extraction';
						} else if (eventType === 'cost_event') {
							eventCategory = 'cost';
						} else if (eventType.startsWith('flow_')) {
							eventCategory = 'tool';
						}

						const debugEvent: DebugEvent = {
							id: `debug-${Date.now()}-${debugEventSequence}`,
							chatId: threadId,
							eventType,
							eventCategory,
							data: debugData,
							timestamp: new Date((debugData.timestamp as number) || Date.now()).toISOString(),
							durationMs: debugData.durationMs as number | undefined,
							sequenceNumber: debugEventSequence++
						};

						realtimeLogs = [...realtimeLogs, debugEvent];
					}
				},
				onFinish: ({ message }) => {
					// Load persisted debug messages from PB
					if (selectedThreadId) {
						loadDebugMessages(selectedThreadId);
						// Retry after delay — server may not have persisted debug data yet
						const threadId = selectedThreadId;
						setTimeout(() => {
							if (selectedThreadId === threadId) {
								loadDebugMessages(threadId);
							}
						}, 2000);
					}
					pendingFiles = [];
					scrollToBottom();
				},
				onError: (error) => {
					console.error('[Playground] Chat stream error:', error);
					toast.error('Failed to get response from agent');
				}
			});
		} catch (error) {
			console.error('[Playground] Failed to init chat:', error);
			chat = null;
		} finally {
			chatLoading = false;
		}
	}

	// ============================================================================
	// Debug Loading
	// ============================================================================

	async function loadDebugMessages(chatId: string) {
		debugMessagesLoading = true;
		try {
			const result = await getDebugMessages({ chatId });
			if (result && Array.isArray(result)) {
				debugMessages = result as DebugMessage[];
			} else {
				debugMessages = [];
			}
		} catch (error) {
			console.error('Failed to load debug messages:', error);
			debugMessages = [];
		} finally {
			debugMessagesLoading = false;
		}
	}

	// ============================================================================
	// Thread Actions
	// ============================================================================

	async function handleCreateThread() {
		try {
			const newThread = await createPlaygroundThread({
				agentId,
				name: `Test ${threads.length + 1}`
			});
			if (newThread && typeof newThread === 'object' && 'id' in newThread) {
				threads = [newThread as PlaygroundThread, ...threads];
				selectedThreadId = (newThread as PlaygroundThread).id;
				toast.success('Thread created');
			}
		} catch (error) {
			console.error('Failed to create thread:', error);
			toast.error('Failed to create thread');
		}
	}

	async function handleDeleteThread(threadId: string) {
		try {
			await deletePlaygroundThread({ threadId });
			threads = threads.filter((t) => t.id !== threadId);
			if (selectedThreadId === threadId) {
				selectedThreadId = threads[0]?.id ?? null;
			}
			toast.success('Thread deleted');
		} catch (error) {
			console.error('Failed to delete thread:', error);
			toast.error('Failed to delete thread');
		}
	}

	// ============================================================================
	// Message Sending
	// ============================================================================

	function handleSendMessage(userMessage: string, files?: ChatFileAttachment[]) {
		if (!userMessage.trim() || !chat || isStreaming) return;

		// Track count before stream for dedup when PB data loads
		preStreamDebugCount = debugMessages.length;
		// Mark where new stream events start (don't clear — Events tab keeps full history)
		currentStreamStartIndex = realtimeLogs.length;

		// Store files for the transport to include in the request body
		pendingFiles = files ?? [];

		// AI SDK Chat handles message creation, streaming, and state management
		chat.sendMessage({ text: userMessage });
		scrollToBottom();
	}

	// ============================================================================
	// HIL (Human-in-the-Loop) Handlers
	// ============================================================================

	function handleConfirmationRespond(confirmed: boolean, toolCallId: string) {
		if (!chat) return;

		// Use proper AI SDK tool output — not a formatted text message
		chat.addToolOutput({
			tool: 'ask_confirmation' as any,
			toolCallId,
			output: { confirmed, message: confirmed ? 'User confirmed.' : 'User cancelled.' }
		} as any);
	}

	function handleInputSubmit(value: string, toolCallId: string) {
		if (!chat) return;

		chat.addToolOutput({
			tool: 'request_input' as any,
			toolCallId,
			output: { value }
		} as any);
	}

	// ============================================================================
	// Helpers
	// ============================================================================

	function formatTime(dateString?: string): string {
		if (!dateString) return '';
		return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	/** Convert UIMessage parts to shared MessagePart[] for the gen-UI renderer. */
	function getMessageParts(message: UIMessage): MessagePart[] | undefined {
		return uiPartsToMessageParts(message.parts as Array<Record<string, unknown>>);
	}
</script>

<div class="flex h-full overflow-hidden">
	<!-- Threads Sidebar -->
	<div class="flex w-64 flex-col overflow-hidden border-r bg-background">
		<div class="flex shrink-0 items-center justify-between border-b p-4">
			<h3 class="font-semibold">Test Threads</h3>
			<Button variant="ghost" size="icon" onclick={handleCreateThread}>
				<Plus class="h-4 w-4" />
			</Button>
		</div>

		<div class="flex-1 overflow-hidden">
			<ScrollArea class="h-full">
				<div class="space-y-1 p-2">
					{#if threads.length === 0}
						<div class="px-2 py-8 text-center text-sm text-muted-foreground">
							No threads yet. Click + to create one.
						</div>
					{:else}
						{#each threads as thread}
							<button
								class="group flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted {selectedThreadId ===
								thread.id
									? 'bg-muted'
									: ''}"
								onclick={() => (selectedThreadId = thread.id)}
							>
								<div class="flex items-center gap-2 truncate">
									<MessageSquare class="h-4 w-4 shrink-0 text-muted-foreground" />
									<span class="truncate">{thread.name}</span>
								</div>
								<Button
									variant="ghost"
									size="icon"
									class="h-6 w-6 opacity-0 group-hover:opacity-100"
									onclick={(e: MouseEvent) => {
										e.stopPropagation();
										handleDeleteThread(thread.id);
									}}
								>
									<Trash2 class="h-3 w-3" />
								</Button>
							</button>
						{/each}
					{/if}
				</div>
			</ScrollArea>
		</div>
	</div>

	<!-- Main Area -->
	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		{#if selectedThreadId && chat}
			<Resizable.PaneGroup direction="horizontal" class="flex-1">
				<!-- Chat Panel -->
				<Resizable.Pane defaultSize={showDebugPanel ? 60 : 100} minSize={30}>
					<div class="flex h-full flex-col">
						<!-- Header -->
						<div class="flex items-center justify-between border-b px-4 py-2">
							<div class="flex items-center gap-2">
								<MessageSquare class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm font-medium">Chat</span>
								{#if isStreaming}
									<Badge variant="secondary" class="h-5 text-[10px]">Streaming</Badge>
								{/if}
								<!-- Model Override Picker -->
								{#if models.length > 0}
									<ModelPicker
										{models}
										{selectedModelId}
										onModelChange={(id) => (selectedModelId = id)}
									/>
								{/if}
							</div>
							<!-- Session Cost Display -->
							<div class="flex items-center gap-3">
								{#if sessionCost.totalTokens > 0}
									<div
										class="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground"
									>
										<Zap class="h-3 w-3" />
										<span title="Input / Output tokens"
											>{sessionCost.inputTokens.toLocaleString()} / {sessionCost.outputTokens.toLocaleString()}</span
										>
										<span class="text-muted-foreground/60">|</span>
										<Coins class="h-3 w-3 text-amber-500" />
										<span class="font-medium text-foreground"
											>${sessionCost.costUsd.toFixed(4)}</span
										>
									</div>
								{/if}
								<Button
									variant="ghost"
									size="icon"
									class="h-7 w-7"
									onclick={() => (showDebugPanel = !showDebugPanel)}
									title={showDebugPanel ? 'Hide debug panel' : 'Show debug panel'}
								>
									{#if showDebugPanel}
										<PanelRightClose class="h-4 w-4" />
									{:else}
										<PanelRightOpen class="h-4 w-4" />
									{/if}
								</Button>
							</div>
						</div>

						<!-- Messages -->
						<div class="flex-1 overflow-hidden">
							<ScrollArea class="h-full p-4">
								<div class="space-y-4">
									{#if chatLoading}
										{#each [1, 2, 3] as _}
											<Skeleton class="h-16 w-3/4" />
										{/each}
									{:else if chat.messages.length === 0}
										<div
											class="flex h-full flex-col items-center justify-center py-12 text-muted-foreground"
										>
											<Bot class="mb-4 h-12 w-12 opacity-50" />
											<p>No messages yet</p>
											<p class="text-sm">Send a message to test the agent</p>
										</div>
									{:else}
										{#each chat.messages.filter((m) => m.role !== 'system') as message}
											{@const msgParts = getMessageParts(message as any)}
											{@const textContent = getMessageContent(message as any)}
											<div class="flex gap-3 {message.role === 'user' ? 'flex-row-reverse' : ''}">
												<div
													class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {message.role ===
													'user'
														? 'bg-primary'
														: 'bg-muted'}"
												>
													{#if message.role === 'user'}
														<User class="h-4 w-4 text-primary-foreground" />
													{:else}
														<Bot class="h-4 w-4" />
													{/if}
												</div>
												<div
													class="max-w-[80%] rounded-lg px-4 py-2 {message.role === 'user'
														? 'bg-primary text-primary-foreground'
														: 'bg-muted'}"
												>
													<!-- File attachments (from metadata) -->
													{#if (message.metadata as any)?.files}
														{@const files = (message.metadata as any).files as Array<{
															name: string;
														}>}
														<div class="mb-2 flex flex-wrap gap-1">
															{#each files as attachment}
																<Badge variant="secondary" class="gap-1 text-[10px]">
																	<Paperclip class="h-2.5 w-2.5" />
																	{attachment.name}
																</Badge>
															{/each}
														</div>
													{/if}
													<!-- Render message content -->
													{#if message.role === 'assistant' && isThinking && message === chat.messages[chat.messages.length - 1]}
														<!-- Thinking indicator while waiting for response -->
														<div class="flex items-center gap-2 py-1">
															<BrainCircuit class="h-4 w-4 animate-pulse text-primary" />
															<span class="text-sm text-muted-foreground">Thinking</span>
															<span class="flex gap-1">
																<span
																	class="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]"
																></span>
																<span
																	class="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]"
																></span>
																<span
																	class="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]"
																></span>
															</span>
														</div>
													{:else if message.role === 'assistant' && msgParts}
														<!-- Use shared MessagePartsRenderer for generative UI -->
														<MessagePartsRenderer
															parts={msgParts}
															onConfirmationRespond={handleConfirmationRespond}
															onInputSubmit={handleInputSubmit}
														/>
													{:else if message.role === 'assistant'}
														<div class="prose prose-sm max-w-none dark:prose-invert">
															{@html marked(textContent)}
														</div>
													{:else}
														<p class="text-sm whitespace-pre-wrap">{textContent}</p>
													{/if}
													<!-- Timestamp -->
													<div
														class="mt-1 text-[10px] {message.role === 'user'
															? 'text-primary-foreground/70'
															: 'text-muted-foreground'}"
													>
														<span>{formatTime((message.metadata as any)?.createdAt as string)}</span
														>
													</div>
												</div>
											</div>
										{/each}
										<!-- Auto-scroll anchor -->
										<div bind:this={messagesEndRef}></div>
									{/if}
								</div>
							</ScrollArea>
						</div>
						<!-- Chat Input with file upload -->
						<ChatInput
							threadId={selectedThreadId}
							disabled={false}
							isSending={isStreaming}
							onSubmit={handleSendMessage}
						/>
					</div>
				</Resizable.Pane>

				{#if showDebugPanel}
					<Resizable.Handle withHandle />

					<!-- Debug Panel -->
					<Resizable.Pane defaultSize={40} minSize={25} maxSize={60}>
						<DebugPanel
							logs={realtimeLogs}
							loading={isStreaming}
							onClear={() => {
								realtimeLogs = [];
								debugEventSequence = 0;
							}}
							debugMessages={combinedDebugMessages}
							{debugMessagesLoading}
						/>
					</Resizable.Pane>
				{/if}
			</Resizable.PaneGroup>
		{:else if selectedThreadId && chatLoading}
			<div class="flex h-full flex-col items-center justify-center text-muted-foreground">
				<Skeleton class="mb-4 h-12 w-12 rounded-full" />
				<Skeleton class="h-4 w-48" />
			</div>
		{:else}
			<!-- No Thread Selected -->
			<div class="flex h-full flex-col items-center justify-center text-muted-foreground">
				<MessageSquare class="mb-4 h-12 w-12 opacity-50" />
				<p>Select a thread or create a new one</p>
			</div>
		{/if}
	</div>
</div>
