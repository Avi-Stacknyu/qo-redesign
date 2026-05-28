<script lang="ts">
	import { Compass, Loader2, Send, Check, ChevronDown, ChevronUp, User } from '@lucide/svelte';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import ProfileCompletionBar from './ProfileCompletionBar.svelte';
	import QIcon from '$lib/components/icons/QIcon.svelte';
	import type { ProfileData, ProfileSection } from '$lib/data/profile-types';
	import { createThread } from '$lib/remote/chat-threads.remote';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import type { UIMessage } from 'ai';
	import { toast } from 'svelte-sonner';
	import { marked } from 'marked';
	import { beforeNavigate } from '$app/navigation';

	marked.setOptions({ breaks: true, gfm: true });

	let {
		profile,
		defaultAgentId,
		onThreadReady
	}: {
		profile: ProfileData;
		defaultAgentId: string;
		onThreadReady?: (threadId: string) => void;
	} = $props();

	// ── Thread + Chat State ─────────────────────────────────────────────
	let threadId = $state<string | null>(null);
	let isCreatingThread = $state(false);
	let chat = $state<Chat | null>(null);
	let chatContainer: HTMLDivElement | undefined = $state();
	let inputText = $state('');
	let activeSection = $state<string | null>(null);
	let mobileSectionsOpen = $state(false);

	let messages = $derived(chat?.messages ?? []);
	let isStreaming = $derived(chat?.status === 'streaming' || chat?.status === 'submitted');

	let sortedSections = $derived([...profile.sections].sort((a, b) => a.order - b.order));

	function getEmptyFields(section: ProfileSection): string[] {
		return section.fields.filter((f) => f.isSchema && !f.value.trim()).map((f) => f.label);
	}

	function scrollToBottom() {
		requestAnimationFrame(() => {
			if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
		});
	}

	$effect(() => {
		if (messages.length) scrollToBottom();
	});

	async function ensureThread(): Promise<string> {
		if (threadId) return threadId;
		isCreatingThread = true;
		try {
			const result = await createThread({
				agent_id: defaultAgentId,
				title: 'Profile Discovery',
				source: 'discovery'
			});
			if (!result?.id) throw new Error('Failed to create thread');
			threadId = result.id;
			onThreadReady?.(result.id);
			chat = new Chat({
				id: result.id,
				messages: [] as UIMessage[],
				transport: new DefaultChatTransport({
					api: `/api/chat/threads/${result.id}/stream`,
					prepareSendMessagesRequest: ({ messages: msgs }) => {
						const lastMsg = msgs[msgs.length - 1];
						const textPart = lastMsg?.parts?.find(
							(p): p is { type: 'text'; text: string } => p.type === 'text'
						);
						return {
							body: {
								message: textPart?.text ?? '',
								agentId: defaultAgentId,
								attachments: [],
								modelOverrideId: undefined
							}
						};
					}
				}),
				onFinish: () => {
					scrollToBottom();
				},
				onError: (error) => {
					console.error('Discovery chat error:', error);
					chat?.stop();
					toast.error('Something went wrong. Please try again.');
				}
			});
			return result.id;
		} catch {
			toast.error('Failed to start discovery chat');
			throw new Error('Thread creation failed');
		} finally {
			isCreatingThread = false;
		}
	}

	async function handleSend() {
		const text = inputText.trim();
		if (!text || isStreaming) return;
		inputText = '';
		try {
			await ensureThread();
			await chat!.sendMessage({ text });
		} catch {
			/* handled */
		}
	}

	async function handleSectionClick(section: ProfileSection) {
		if (isStreaming || isCreatingThread) return;
		activeSection = section.sectionId;
		mobileSectionsOpen = false;
		const empty = getEmptyFields(section);
		const filled = section.fields.filter((f) => f.isSchema && f.value.trim());

		let prompt: string;
		if (empty.length === 0) {
			prompt = `Let's review my ${section.label.toLowerCase()} information — is everything still accurate?`;
		} else {
			const filledNote =
				filled.length > 0
					? `You already know my ${filled
							.slice(0, 3)
							.map((f) => f.label.toLowerCase())
							.join(', ')}.`
					: '';
			prompt = `Help me fill in my ${section.label.toLowerCase()} section. ${filledNote} I have ${empty.length} fields left.`;
		}
		inputText = '';
		try {
			await ensureThread();
			await chat!.sendMessage({ text: prompt });
		} catch {
			/* handled */
		}
	}

	// Flush pending extraction when navigating away (mirrors chat page behavior)
	beforeNavigate(() => {
		if (!threadId || !defaultAgentId) return;
		fetch(`/api/chat/threads/${threadId}/flush`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agentId: defaultAgentId }),
			keepalive: true
		}).catch(() => {});
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function getMessageText(msg: UIMessage): string {
		return msg.parts
			.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
			.map((p) => p.text)
			.join('');
	}
</script>

{#snippet sectionList()}
	{#each sortedSections as section (section.sectionId)}
		{@const totalFields = section.fields.length}
		{@const filledFields = section.fields.filter((f) => f.value.trim()).length}
		{@const pct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 100}
		<button
			class="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all {activeSection ===
			section.sectionId
				? 'bg-primary/8 text-foreground'
				: 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'}"
			onclick={() => handleSectionClick(section)}
			disabled={isStreaming || isCreatingThread}
		>
			<div class="relative flex size-7 shrink-0 items-center justify-center">
				<svg class="size-full -rotate-90" viewBox="0 0 36 36">
					<circle
						cx="18"
						cy="18"
						r="14"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						class="text-muted/25"
					/>
					<circle
						cx="18"
						cy="18"
						r="14"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-dasharray="87.96"
						stroke-dashoffset={87.96 - (87.96 * pct) / 100}
						stroke-linecap="round"
						class={pct === 100 ? 'text-emerald-500' : pct >= 30 ? 'text-amber-400' : 'text-red-400'}
					/>
				</svg>
				{#if pct === 100}
					<Check class="absolute size-2.5 text-emerald-500" />
				{:else}
					<span class="absolute text-[8px] font-bold tabular-nums">{pct}</span>
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<span class="block truncate text-xs font-medium">{section.label}</span>
				<span class="text-[10px] text-muted-foreground/60">{pct}%</span>
			</div>
		</button>
	{/each}
{/snippet}

<div class="flex flex-col gap-3 md:flex-row md:gap-4" style="height: calc(100vh - 16rem);">
	<!-- Mobile: Collapsible Section Tracker -->
	<div class="md:hidden">
		<button
			class="flex w-full items-center justify-between rounded-lg border border-border/30 bg-card/30 px-3 py-2.5"
			onclick={() => (mobileSectionsOpen = !mobileSectionsOpen)}
		>
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium text-foreground">Sections</span>
				<span class="text-[10px] text-muted-foreground">{profile.overallCompletion}%</span>
			</div>
			{#if mobileSectionsOpen}<ChevronUp
					class="size-3.5 text-muted-foreground"
				/>{:else}<ChevronDown class="size-3.5 text-muted-foreground" />{/if}
		</button>
		{#if mobileSectionsOpen}
			<div class="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border/30 bg-card/30 p-2">
				{@render sectionList()}
			</div>
		{/if}
	</div>

	<!-- Desktop: Sidebar -->
	<div class="hidden w-56 shrink-0 flex-col md:flex">
		<div class="flex-1 overflow-y-auto rounded-xl border border-border/20 bg-card/30 p-3">
			<p class="mb-2 text-[10px] font-medium tracking-widest text-muted-foreground/50 uppercase">
				Sections
			</p>
			<div class="space-y-0.5">
				{@render sectionList()}
			</div>
		</div>

		<div class="mt-3 rounded-xl border border-border/20 bg-card/30 px-3 py-2.5">
			<ProfileCompletionBar
				value={profile.filledFields}
				max={profile.totalFields}
				label="Overall"
				size="md"
			/>
		</div>
	</div>

	<!-- Chat Area -->
	<div
		class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/20 bg-card/30"
	>
		<!-- Messages -->
		<div bind:this={chatContainer} class="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
			{#if messages.length === 0 && !isCreatingThread}
				<div class="flex h-full flex-col items-center justify-center px-4 text-center">
					<div class="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/8">
						<Compass class="size-5 text-primary/70" />
					</div>
					<h3 class="mb-1 text-sm font-medium text-foreground">Profile Discovery</h3>
					<p class="max-w-xs text-[13px] leading-relaxed text-muted-foreground/70">
						{#if sortedSections.length > 0}
							Pick a section to focus on, or just start chatting — the AI will help build your
							financial profile.
						{:else}
							Start a conversation to begin building your profile. The AI will learn about your
							financial goals and preferences.
						{/if}
					</p>
				</div>
			{:else}
				{#each messages as msg (msg.id)}
					{@const text = getMessageText(msg)}
					{#if text}
						<div class="flex gap-2.5 {msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}">
							<!-- Avatar -->
							<div
								class="flex size-7 shrink-0 items-center justify-center rounded-full {msg.role ===
								'user'
									? 'bg-primary text-primary-foreground'
									: 'bg-primary/10 text-primary'}"
							>
								{#if msg.role === 'user'}
									<User class="size-3.5" />
								{:else}
									<QIcon class="size-4" />
								{/if}
							</div>
							<!-- Bubble -->
							<div
								class="max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed sm:max-w-[70%] {msg.role ===
								'user'
									? 'rounded-tr-md bg-primary text-primary-foreground'
									: 'rounded-tl-md border border-border/40 bg-muted/50 text-foreground'}"
							>
								{#if msg.role === 'user'}
									<p class="whitespace-pre-wrap">{text}</p>
								{:else}
									<div
										class="prose prose-sm max-w-none prose-p:m-0 prose-p:leading-relaxed prose-a:font-medium prose-code:rounded prose-code:bg-background/80 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background prose-hr:hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
									>
										{@html marked(text)}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				{/each}

				{#if isStreaming && messages.length > 0}
					{@const lastMsg = messages[messages.length - 1]}
					{#if lastMsg.role !== 'assistant' || !getMessageText(lastMsg)}
						<div class="flex items-start gap-2.5">
							<div
								class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
							>
								<QIcon class="size-4" />
							</div>
							<div class="rounded-2xl rounded-tl-md border border-border/40 bg-muted/50 px-4 py-3">
								<div class="flex items-center gap-1.5">
									<span
										class="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]"
									></span>
									<span
										class="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]"
									></span>
									<span
										class="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]"
									></span>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			{/if}

			{#if isCreatingThread}
				<div class="flex items-center justify-center py-4">
					<Loader2 class="size-4 animate-spin text-muted-foreground" />
					<span class="ml-2 text-xs text-muted-foreground">Starting discovery chat…</span>
				</div>
			{/if}
		</div>

		<!-- Input -->
		<div class="border-t border-border/15 px-3 py-3 sm:px-4">
			<div class="flex items-end gap-2">
				<textarea
					bind:value={inputText}
					onkeydown={handleKeydown}
					placeholder="Share anything about yourself…"
					disabled={isStreaming || isCreatingThread}
					rows={1}
					class="flex-1 resize-none rounded-xl border border-border/20 bg-muted/20 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:bg-background/80 focus:ring-0 focus:outline-none"
				></textarea>
				<Button
					size="icon"
					variant="ghost"
					class="size-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
					onclick={handleSend}
					disabled={isStreaming || isCreatingThread || !inputText.trim()}
				>
					{#if isStreaming}
						<Loader2 class="size-4 animate-spin" />
					{:else}
						<Send class="size-4" />
					{/if}
				</Button>
			</div>
		</div>
	</div>
</div>
