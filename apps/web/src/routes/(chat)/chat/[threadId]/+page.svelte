<script lang="ts">
	import { page } from '$app/state';
	import { beforeNavigate } from '$app/navigation';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import ChatMessage from '$lib/components/chat/ChatMessage.svelte';
	import ThinkingIndicator from '$lib/components/chat/ThinkingIndicator.svelte';
	import { updateThreadAgent, updateThreadModel } from '$lib/remote/chat-threads.remote';
	import { saveMessageAsNote } from '$lib/remote/knowledge.remote';
	import { Chat } from '@ai-sdk/svelte';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import QIcon from '$lib/components/icons/QIcon.svelte';
	import type {
		ChatFileAttachment,
		DoneEventData,
		ConfirmationToolOutput,
		InputRequestToolOutput
	} from '@repo/shared/types';
	import {
		getMessageContent,
		serverMessagesToUIMessages,
		uiPartsToMessageParts,
		type UIMessageLike
	} from '@repo/shared/utils';
	import type { UIMessage } from 'ai';
	import { DefaultChatTransport } from 'ai';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import type { PinnedModelInfo } from '@repo/shared/utils';
	import type { AvailableModel } from '$lib/remote/models.remote';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	type ChatPageAgent = PageData['agents'][number] & {
		pinnedModelInfo?: PinnedModelInfo | null;
	};
	type ChatPart = UIMessage['parts'][number];
	type HilToolType = 'tool-ask_confirmation' | 'tool-request_input';
	type ToolPartWithState = ChatPart & {
		type: string;
		state: string;
		toolCallId: string;
		input?: unknown;
		output?: unknown;
	};
	type HilToolResult = {
		toolCallId: string;
		toolName: 'ask_confirmation' | 'request_input';
		args: unknown;
		output: unknown;
	};
	type HilToolOutputPayload =
		| {
				tool: 'ask_confirmation';
				toolCallId: string;
				output: ConfirmationToolOutput;
		  }
		| {
				tool: 'request_input';
				toolCallId: string;
				output: InputRequestToolOutput;
		  };

	const HIL_TOOL_TYPES = new Set<HilToolType>(['tool-ask_confirmation', 'tool-request_input']);

	function isToolPartWithState(part: ChatPart): part is ToolPartWithState {
		return (
			typeof part.type === 'string' &&
			'state' in part &&
			typeof part.state === 'string' &&
			'toolCallId' in part &&
			typeof part.toolCallId === 'string'
		);
	}

	function isHilToolType(type: string): type is HilToolType {
		return HIL_TOOL_TYPES.has(type as HilToolType);
	}

	function isCompletedHilToolPart(
		part: ChatPart
	): part is ToolPartWithState & { type: HilToolType } {
		return (
			isToolPartWithState(part) && isHilToolType(part.type) && part.state === 'output-available'
		);
	}

	function isPendingHilToolPart(part: ChatPart): part is ToolPartWithState & { type: HilToolType } {
		return (
			isToolPartWithState(part) &&
			isHilToolType(part.type) &&
			(part.state === 'input-available' || part.state === 'input-streaming')
		);
	}

	function addHilToolOutput(payload: HilToolOutputPayload) {
		return (
			chat.addToolOutput as unknown as (payload: HilToolOutputPayload) => PromiseLike<void> | void
		)(payload);
	}

	let currentAgentId = $state('');
	let currentModelId = $state<string | null>(null);

	const currentAgent = $derived(
		data.agents.find((a: ChatPageAgent) => a.id === currentAgentId) as ChatPageAgent | undefined
	);
	const currentPinnedModelInfo = $derived(currentAgent?.pinnedModelInfo ?? null);
	let messagesContainer: HTMLDivElement | undefined = $state();
	let savedMessageIds = $state(new Set<string>());
	let pbIdMap = new SvelteMap<string, string>();
	let pendingFiles = $state<ChatFileAttachment[]>([]);
	let modelRestrictionWarning = $state<string | null>(null);
	/** Tool-call IDs already auto-sent via sendAutomaticallyWhen — prevents infinite retry on stream errors */
	let sentHilToolCallIds = new Set<string>();

	// ── Tier Context ─────────────────────────────────────────────────────────

	const tierContext = $derived(data.tierContext);
	const allowedModelIds = $derived(tierContext.allowedModelIds);
	const creditBalance = $derived(tierContext.creditBalance);
	const hasSubscription = $derived(tierContext.hasSubscription);

	// Detect if selected model is no longer allowed after tier change
	$effect(() => {
		if (currentPinnedModelInfo) {
			if (
				currentModelId &&
				allowedModelIds.length > 0 &&
				!allowedModelIds.includes(currentModelId)
			) {
				currentModelId = null;
				updateThreadModel({ thread_id: data.thread.id, model_id: null }).catch(() => {});
			}
			modelRestrictionWarning = null;
			return;
		}

		if (currentModelId && allowedModelIds.length > 0 && !allowedModelIds.includes(currentModelId)) {
			const modelName =
				data.availableModels.find((m: AvailableModel) => m.id === currentModelId)?.display_name ??
				'selected model';
			modelRestrictionWarning = `${modelName} is no longer available on your plan. Switched to Auto.`;
			currentModelId = null;
			updateThreadModel({ thread_id: data.thread.id, model_id: null }).catch(() => {});
		}
	});
	let messageFiles = new SvelteMap<string, ChatFileAttachment[]>();

	// ── Chat Instance ────────────────────────────────────────────────────────

	// Track which thread ID was last initialized to avoid reading chat.id in $effect
	// svelte-ignore state_referenced_locally
	let initializedThreadId = $state(data.thread.id);

	// svelte-ignore state_referenced_locally
	let chat = $state<Chat>(createChat(data));

	function createChat(pageData: PageData): Chat {
		const { messages: initialMessages, fileMap } = serverMessagesToUIMessages(pageData.messages);
		messageFiles.clear();
		for (const [id, files] of fileMap) messageFiles.set(id, files);

		return new Chat({
			id: pageData.thread.id,
			messages: initialMessages as UIMessage[],
			transport: new DefaultChatTransport({
				api: `/api/chat/threads/${pageData.thread.id}/stream`,
				prepareSendMessagesRequest: ({ messages }) => {
					const lastMsg = messages[messages.length - 1];

					// Tool-result resend (HIL tool responses)
					if (lastMsg?.role === 'assistant') {
						const assistantText = lastMsg.parts
							.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
							.map((p) => p.text)
							.join('');

						const toolResults = lastMsg.parts.filter(isCompletedHilToolPart).map(
							(p): HilToolResult => ({
								toolCallId: p.toolCallId,
								toolName: p.type.slice(5) as HilToolResult['toolName'],
								args: p.input,
								output: p.output
							})
						);

						// Shouldn't fire for non-HIL tools (sendAutomaticallyWhen guards this)
						return {
							body: {
								toolResults,
								assistantText,
								agentId: currentAgentId,
								respondMessageId: lastMsg.id,
								modelOverrideId: currentModelId ?? undefined
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
							agentId: currentAgentId,
							attachments: pendingFiles.map((f) => ({
								id: f.id,
								name: f.name,
								size: f.size,
								type: f.type
							})),
							modelOverrideId: currentModelId ?? undefined
						}
					};
				}
			}),
			sendAutomaticallyWhen: ({ messages }) => {
				// Only auto-send when the last assistant message has completed HIL tool calls
				// that haven't already been sent (prevents infinite retry loops on stream errors)
				const lastMsg = messages[messages.length - 1];
				if (!lastMsg || lastMsg.role !== 'assistant') return false;
				const hasUnsent = lastMsg.parts.some(
					(p) => isCompletedHilToolPart(p) && !sentHilToolCallIds.has(p.toolCallId)
				);
				if (hasUnsent) {
					// Mark these tool calls as sent before the request fires
					for (const p of lastMsg.parts) {
						if (isCompletedHilToolPart(p)) sentHilToolCallIds.add(p.toolCallId);
					}
				}
				return hasUnsent;
			},
			onFinish: ({ message }) => {
				for (const part of message.parts) {
					if (part.type === 'data-done') {
						const doneData = (part as { type: string; data: DoneEventData }).data;
						if (doneData?.assistantMessageId) pbIdMap.set(message.id, doneData.assistantMessageId);
						if (doneData?.userMessageId) {
							const msgs = chat.messages;
							const userMsg = msgs.length >= 2 ? msgs[msgs.length - 2] : null;
							if (userMsg?.role === 'user') pbIdMap.set(userMsg.id, doneData.userMessageId);
						}
					}
				}
				pendingFiles = [];
				scrollToBottom();
			},
			onError: (error) => {
				console.error('Chat stream error:', error);
				chat.stop();

				// Remove incomplete/blank assistant message so user doesn't see empty bubble
				const lastMsg = chat.messages[chat.messages.length - 1];
				if (lastMsg?.role === 'assistant') {
					const hasContent = lastMsg.parts.some(
						(p) =>
							(p.type === 'text' && p.text?.trim()) ||
							(typeof p.type === 'string' && p.type.startsWith('tool-'))
					);
					if (!hasContent) {
						// setMessages exists at runtime but isn't in type definitions
						(chat as unknown as { setMessages: (msgs: UIMessage[]) => void }).setMessages(
							chat.messages.slice(0, -1)
						);
					}
				}

				toast.error(
					typeof error === 'string'
						? error
						: error.message || 'Something went wrong. Please try again.'
				);
			}
		});
	}

	// Reinitialize on thread navigation
	$effect(() => {
		const newThreadId = data.thread.id;
		if (newThreadId !== untrack(() => initializedThreadId)) {
			// Flush pending profiler for the old chat before switching
			untrack(() => flushPendingMessages(chat.id, currentAgentId));
			chat = createChat(data);
			initializedThreadId = newThreadId;
			currentAgentId = data.thread.agentId || data.agents[0]?.id || '';
			currentModelId = data.thread.modelOverrideId ?? null;
			pbIdMap.clear();
			savedMessageIds = new Set();
			sentHilToolCallIds = new Set();
			scrollToBottom();
		}
	});

	$effect(() => {
		const agentId = data.thread.agentId || data.agents[0]?.id || '';
		if (!untrack(() => currentAgentId)) currentAgentId = agentId;
	});

	$effect(() => {
		const modelId = data.thread.modelOverrideId ?? null;
		if (untrack(() => currentModelId) === undefined) currentModelId = modelId;
	});

	// ── Derived State ────────────────────────────────────────────────────────

	const threadId = $derived(data.thread.id);
	const hasMessages = $derived(chat.messages.length > 0);
	const isStreaming = $derived(chat.status === 'streaming' || chat.status === 'submitted');

	const isThinking = $derived.by(() => {
		if (chat.status === 'submitted') return true;
		if (chat.status !== 'streaming') return false;

		const lastMsg = chat.messages[chat.messages.length - 1];
		if (!lastMsg || lastMsg.role !== 'assistant') return false;

		const hasAnsweredToolParts = lastMsg.parts.some(
			(p) =>
				typeof p.type === 'string' &&
				p.type.startsWith('tool-') &&
				isToolPartWithState(p) &&
				p.state === 'output-available'
		);

		if (hasAnsweredToolParts) {
			let lastToolIdx = -1;
			for (let i = lastMsg.parts.length - 1; i >= 0; i--) {
				const p = lastMsg.parts[i];
				if (
					typeof p.type === 'string' &&
					p.type.startsWith('tool-') &&
					isToolPartWithState(p) &&
					p.state === 'output-available'
				) {
					lastToolIdx = i;
					break;
				}
			}
			return !lastMsg.parts
				.slice(lastToolIdx + 1)
				.some(
					(p) => p.type === 'text' && 'text' in p && (p as { text: string }).text.trim().length > 0
				);
		}

		return !lastMsg.parts.some((p) => {
			if (p.type === 'text' && 'text' in p) return (p as { text: string }).text.trim().length > 0;
			if ((p.type as string).startsWith('tool-')) return true;
			return false;
		});
	});

	const hasPendingToolCalls = $derived.by(() => {
		const lastMsg = chat.messages[chat.messages.length - 1];
		if (!lastMsg || lastMsg.role !== 'assistant') return false;
		return lastMsg.parts.some((part) => {
			const t = part.type as string;
			if ((t === 'tool-ask_confirmation' || t === 'tool-request_input') && 'state' in part) {
				const s = (part as { state: string }).state;
				return s === 'input-available' || s === 'input-streaming';
			}
			return false;
		});
	});

	const currentToolName = $derived.by(() => {
		if (chat.status !== 'streaming') return '';
		const lastMsg = chat.messages[chat.messages.length - 1];
		if (!lastMsg || lastMsg.role !== 'assistant') return '';
		for (const part of lastMsg.parts) {
			const t = part.type as string;
			if (t.startsWith('tool-') && t !== 'tool-result' && 'state' in part) {
				const s = (part as { state: string }).state;
				if (s === 'input-streaming' || s === 'input-available') return t.slice(5);
			}
		}
		return '';
	});

	// ── Helpers ──────────────────────────────────────────────────────────────

	function getMessageFiles(msgId: string): ChatFileAttachment[] | undefined {
		return messageFiles.get(msgId);
	}

	function getPbId(chatMsgId: string): string {
		return pbIdMap.get(chatMsgId) || chatMsgId;
	}

	// ── Actions ──────────────────────────────────────────────────────────────

	onMount(() => {
		const state = page.state as
			| { initialMessage?: string; modelOverrideId?: string | null }
			| undefined;
		if (state?.modelOverrideId) currentModelId = state.modelOverrideId;
		if (state?.initialMessage && chat.messages.length === 0) {
			history.replaceState({}, '');
			setTimeout(() => {
				chat.sendMessage({ text: state.initialMessage! });
			}, 100);
		}
	});

	// ── Flush pending profiler on navigation away ────────────────────────────

	function flushPendingMessages(threadId: string, agentId: string) {
		if (!threadId || !agentId) return;
		fetch(`/api/chat/threads/${threadId}/flush`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agentId }),
			keepalive: true
		}).catch(() => {});
	}

	beforeNavigate(() => {
		flushPendingMessages(chat.id, currentAgentId);
	});

	function scrollToBottom() {
		if (messagesContainer) {
			setTimeout(() => {
				messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
			}, 50);
		}
	}

	$effect(() => {
		if (chat.status === 'streaming') scrollToBottom();
	});

	async function handleAgentChange(agentId: string) {
		if (hasMessages || agentId === currentAgentId) return;
		try {
			await updateThreadAgent({ thread_id: threadId, agent_id: agentId });
			currentAgentId = agentId;
		} catch (err) {
			console.error('Failed to update agent:', err);
		}
	}

	async function handleModelChange(modelId: string | null) {
		if (modelId === currentModelId) return;
		currentModelId = modelId;
		try {
			await updateThreadModel({ thread_id: threadId, model_id: modelId });
		} catch (err) {
			console.error('Failed to update model:', err);
			currentModelId = data.thread.modelOverrideId ?? null;
		}
	}

	async function handleSend(content: string, files?: ChatFileAttachment[]) {
		if (isStreaming || !content.trim()) return;
		pendingFiles = files || [];

		if (files?.length) {
			// Optimistically set pending files for immediate feedback if needed
			// But here we rely on messageFiles map.
			// We need the ID of the message that will be created.
			// sendMessage usually returns a promise resolving to the response.
			// But it adds the user message immediately for optimistic UI.

			const preLen = chat.messages.length;
			const responsePromise = chat.sendMessage({ text: content });

			// Try to associate files with the new message immediately
			setTimeout(() => {
				if (chat.messages.length > preLen) {
					const userMsg = chat.messages[preLen]; // The new message
					if (userMsg) {
						messageFiles.set(userMsg.id, files!);
					}
				}
			}, 0);

			await responsePromise;
		} else {
			await chat.sendMessage({ text: content });
		}
	}

	function stopStreaming() {
		if (hasPendingToolCalls) cancelPendingToolCalls();
		else chat.stop();
	}

	function cancelPendingToolCalls() {
		const lastMsg = chat.messages[chat.messages.length - 1];
		if (!lastMsg || lastMsg.role !== 'assistant') return;
		for (const part of lastMsg.parts) {
			if (!isPendingHilToolPart(part)) continue;
			if (part.type === 'tool-ask_confirmation') {
				addHilToolOutput({
					tool: 'ask_confirmation',
					toolCallId: part.toolCallId,
					output: { confirmed: false, message: 'User cancelled the request.' }
				});
			} else if (part.type === 'tool-request_input') {
				addHilToolOutput({
					tool: 'request_input',
					toolCallId: part.toolCallId,
					output: { value: '[cancelled]' }
				});
			}
		}
	}

	// ── Generative UI Handlers ───────────────────────────────────────────────

	async function handleConfirmationRespond(confirmed: boolean, toolCallId: string) {
		await addHilToolOutput({
			tool: 'ask_confirmation',
			toolCallId,
			output: {
				confirmed,
				message: confirmed ? 'User confirmed the action.' : 'User declined the action.'
			}
		});
	}

	async function handleInputSubmit(value: string, toolCallId: string) {
		await addHilToolOutput({
			tool: 'request_input',
			toolCallId,
			output: { value }
		});
	}

	async function handleSaveAsNote(messageId: string, content: string) {
		const pbId = getPbId(messageId);
		if (savedMessageIds.has(messageId) || pbId.startsWith('temp-')) return;
		try {
			await saveMessageAsNote({ messageId: pbId, chatId: threadId, content });
			savedMessageIds = new Set([...savedMessageIds, messageId]);
			toast.success('Saved to Knowledge Base');
		} catch (err) {
			console.error('Failed to save note:', err);
			toast.error('Failed to save note');
		}
	}
</script>

<div class="relative flex h-full flex-col">
	<!-- Messages area -->
	<div bind:this={messagesContainer} class="flex-1 overflow-y-auto">
		{#if chat.messages.length === 0}
			<div class="flex h-full items-center justify-center px-4">
				<div class="text-center">
					<div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
						{#if currentAgent}
							<AgentAvatar agent={currentAgent} size="lg" />
						{:else}
							<div
								class="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
							>
								<QIcon class="size-6" />
							</div>
						{/if}
					</div>
					<h2 class="text-lg font-semibold">How can I help you today?</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Ask about your portfolio, finances, or anything else.
					</p>
				</div>
			</div>
		{:else}
			<div class="space-y-1 pt-14 pb-32 md:pt-16 md:pb-48">
				{#each chat.messages as message, i (`${message.id}-${i}`)}
					{@const content = getMessageContent(message as UIMessageLike)}
					{@const parts = uiPartsToMessageParts(message.parts)}
					{@const files = getMessageFiles(message.id)}
					{@const meta = message.metadata as Record<string, unknown> | undefined}
					<ChatMessage
						role={message.role as 'user' | 'assistant'}
						{content}
						timestamp={meta?.createdAt as string | undefined}
						{files}
						{parts}
						agent={message.role === 'assistant' ? currentAgent : undefined}
						onConfirmationRespond={handleConfirmationRespond}
						onInputSubmit={handleInputSubmit}
						onSaveAsNote={message.role === 'assistant'
							? (c) => handleSaveAsNote(message.id, c)
							: undefined}
						isSaved={savedMessageIds.has(message.id)}
					/>
				{/each}
				{#if isThinking || currentToolName}
					<ThinkingIndicator {isThinking} {currentToolName} agent={currentAgent} />
				{/if}
			</div>
		{/if}
	</div>

	<!-- Model restriction warning -->
	{#if modelRestrictionWarning}
		<div class="absolute top-14 right-0 left-0 z-40 flex justify-center px-4 md:top-16">
			<div
				class="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm shadow-lg backdrop-blur-sm"
			>
				<span class="text-amber-600 dark:text-amber-400">{modelRestrictionWarning}</span>
				<button
					type="button"
					class="text-muted-foreground hover:text-foreground"
					onclick={() => (modelRestrictionWarning = null)}>✕</button
				>
			</div>
		</div>
	{/if}

	<!-- Input area -->
	<div class="shrink-0">
		<ChatInput
			onSubmit={handleSend}
			isStreaming={isStreaming || hasPendingToolCalls}
			onStop={stopStreaming}
			placeholder={hasPendingToolCalls ? 'Please respond to the form above...' : 'Message Orion...'}
			threadId={data?.thread?.id}
			agents={data.agents}
			selectedAgentId={currentAgentId}
			onAgentChange={handleAgentChange}
			hideAgentSelector={hasMessages}
			availableModels={data.availableModels}
			selectedModelId={currentModelId}
			onModelChange={handleModelChange}
			{allowedModelIds}
			pinnedModelInfo={currentPinnedModelInfo}
			{creditBalance}
			{hasSubscription}
		/>
	</div>
</div>
