<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { Chat } from '@ai-sdk/svelte';
	import type { UIMessage } from 'ai';
	import { DefaultChatTransport } from 'ai';
	import { ArrowRight, CheckCircle2, Sparkles } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	import ConversationPanel, {
		type ConversationMessage
	} from '$lib/components/chat/ConversationPanel.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ProfileData, ProfileSection } from '$lib/data/profile-types';
	import { createThread } from '$lib/remote/chat-threads.remote';
	import { cn } from '$lib/utils';
	import MemorySurfaceCard from './MemorySurfaceCard.svelte';
	import {
		buildDiscoveryPrompt,
		buildOnboardingSections,
		sendDiscoveryPrompt,
		type SectionAccent,
		type SectionProgress
	} from './discover-tab';

	let {
		profile,
		defaultAgentId,
		onThreadReady,
		onOpenProfile
	}: {
		profile: ProfileData;
		defaultAgentId: string;
		onThreadReady?: (threadId: string) => void;
		onOpenProfile?: () => void;
	} = $props();

	let threadId = $state<string | null>(null);
	let isCreatingThread = $state(false);
	let chat = $state<Chat | null>(null);
	let activeSectionId = $state<string | null>(null);

	let sortedSections = $derived<ProfileSection[]>([...profile.sections].sort((a, b) => a.order - b.order));
	let onboardingSections = $derived<SectionProgress[]>(buildOnboardingSections(profile.sections));
	let messages = $derived(chat?.messages ?? []);
	let isStreaming = $derived(chat?.status === 'streaming' || chat?.status === 'submitted');
	let conversationMessages = $derived<ConversationMessage[]>(
		messages.reduce<ConversationMessage[]>((allMessages, message) => {
			if (message.role !== 'assistant' && message.role !== 'user') return allMessages;

			const text = getMessageText(message);
			if (!text.trim()) return allMessages;

			allMessages.push({
				id: message.id,
				role: message.role,
				text
			});
			return allMessages;
		}, [])
	);

	$effect(() => {
		if (activeSectionId || onboardingSections.length === 0) return;
		activeSectionId =
			onboardingSections.find((section) => section.progress < 100)?.sectionId ??
			onboardingSections[0]?.sectionId ??
			null;
	});

	function getActiveSection() {
		return sortedSections.find((section) => section.sectionId === activeSectionId) ?? null;
	}

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
					prepareSendMessagesRequest: ({ messages: nextMessages }) => {
						const lastMessage = nextMessages[nextMessages.length - 1];
						const textPart = lastMessage?.parts?.find(
							(part): part is { type: 'text'; text: string } => part.type === 'text'
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

	async function sendPrompt(text: string) {
		const trimmedText = text.trim();
		if (!trimmedText || isStreaming) return;
		try {
			await sendDiscoveryPrompt({
				text: trimmedText,
				currentChat: chat,
				ensureChat: async () => {
					await ensureThread();
					if (!chat) throw new Error('Discovery chat was not initialized');
					return chat;
				}
			});
		} catch {
			// toast handled by ensureThread/onError
		}
	}

	async function handleSectionClick(section: ProfileSection) {
		if (isStreaming || isCreatingThread) return;
		activeSectionId = section.sectionId;
		await sendPrompt(buildDiscoveryPrompt(section));
	}

	beforeNavigate(() => {
		if (!threadId || !defaultAgentId) return;
		fetch(`/api/chat/threads/${threadId}/flush`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agentId: defaultAgentId }),
			keepalive: true
		}).catch(() => {});
	});

	function getMessageText(message: UIMessage): string {
		return message.parts
			.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
			.map((part) => part.text)
			.join('');
	}

	function progressTrackClass(accent: SectionAccent) {
		if (accent === 'emerald') return 'bg-[#E9FBF2]';
		if (accent === 'violet') return 'bg-[#F0EAFE]';
		return 'bg-[#EEF2F7]';
	}

	function progressFillClass(accent: SectionAccent) {
		if (accent === 'emerald') return 'bg-[#1BB76E]';
		if (accent === 'violet') return 'bg-[#7C4DFF]';
		return 'bg-[#CBD5E1]';
	}

	function panelClass(accent: SectionAccent) {
		if (accent === 'emerald') return 'border-[#CBEFD8] bg-[#F3FFF8]';
		if (accent === 'violet') return 'border-[#E8DFFD] bg-[#F7F3FF]';
		return 'border-[#EEF2F6] bg-[#F8FAFC]';
	}
</script>

<div class="mt-6 flex flex-col gap-4">
	<div class="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
		<MemorySurfaceCard class="min-h-180  bg-white/78 px-5 py-5 backdrop-blur-sm">
			<div>
				<h2 class="text-lg font-semibold text-[#25324B]">Onboarding Sections</h2>
			</div>

			<div class="mt-5 flex flex-col gap-4">
				{#each onboardingSections as section}
					<button
						type="button"
						onclick={() => {
							const profileSection = sortedSections.find(
								candidate => candidate.sectionId === section.sectionId
							);
							if (profileSection) void handleSectionClick(profileSection);
						}}
						disabled={isStreaming || isCreatingThread}
						class={cn(
							'w-full rounded-2xl border p-4 text-left transition duration-200',
							panelClass(section.accent),
							activeSectionId === section.sectionId
								? 'ring-2 ring-[#7C4DFF]/20 shadow-[0_12px_28px_rgba(124,77,255,0.12)]'
								: 'hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.06)]',
							(isStreaming || isCreatingThread) && 'cursor-not-allowed opacity-80'
						)}
					>
						<div class="mb-3 flex items-center justify-between gap-3">
							<p class="text-[13px] font-semibold text-[#4A5568]">{section.label}</p>
							<div class="flex items-center gap-2 text-[12px] font-semibold text-[#7B8794]">
								{#if section.progress === 100}
									<CheckCircle2 class="size-3.5 text-[#1BB76E]" />
								{/if}
								<span>{section.progress}%</span>
							</div>
						</div>

						<div class={cn('h-2 rounded-full', progressTrackClass(section.accent))}>
							<div
								class={cn(
									'h-full rounded-full transition-[width] duration-500',
									progressFillClass(section.accent)
								)}
								style={`width: ${section.progress}%`}
							></div>
						</div>
					</button>
				{/each}
			</div>
		</MemorySurfaceCard>

		<div class="flex min-w-0 flex-col gap-4">
			<ConversationPanel
				class="h-180 border-none bg-white shadow py-2"
				title="Onboarding Assistant"
				status={isCreatingThread ? 'Starting chat...' : isStreaming ? 'Updating profile...' : 'Active now'}
				icon={Sparkles}
				messages={conversationMessages}
				isTyping={isStreaming}
				inputPlaceholder="Share anything about yourself..."
				emptyStateTitle={getActiveSection()?.label
					? `${getActiveSection()?.label} Discovery`
					: 'Profile Discovery'}
				emptyStateDescription={getActiveSection()
					? `Select ${getActiveSection()?.label.toLowerCase()} to guide the assistant, or send your own message to continue onboarding.`
					: 'Pick a section to guide the assistant, or start chatting to continue onboarding.'}
				onSend={sendPrompt}
			/>

			<div class="rounded-[20px] border border-white/80 bg-white/78 px-4 py-3 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
				<div class="flex items-center justify-between gap-3">
					<div class="min-w-0 flex-1">
						<p class="text-[13px] font-semibold text-[#25324B]">Overall Progress</p>
						<div class="mt-2 h-2 rounded-full bg-[#E8EEF7]">
							<div
								class="h-full rounded-full bg-[#7C4DFF] transition-[width]"
								style={`width: ${profile.overallCompletion}%`}
							></div>
						</div>
					</div>

					<p class="shrink-0 text-sm font-semibold text-[#7C4DFF]">
						{profile.overallCompletion}%
					</p>
				</div>
			</div>
		</div>
	</div>

</div>