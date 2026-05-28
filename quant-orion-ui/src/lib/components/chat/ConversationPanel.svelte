<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { MoreVertical, Sparkles, Star, User } from '@lucide/svelte';

	import ChatInput from '$lib/components/ChatInput.svelte';
	import { cn } from '$lib/utils';

	type ConversationRole = 'assistant' | 'user';

	type ConversationMessage = {
		id: number;
		role: ConversationRole;
		text: string;
		timestamp?: string;
	};

	let {
		class: className = '',
		title = 'Assistant',
		status = 'Active now',
		icon: Icon = Sparkles,
		initialMessages = [],
		replyText = 'I can help with that. Let me suggest the next best step for this workflow.',
		inputPlaceholder = 'Reply to Assistant...',
		noShadow = true,
		showStar = false,
		showMenu = true,
		children
	}: {
		class?: string;
		title?: string;
		status?: string;
		icon?: Component<{ class?: string }>;
		initialMessages?: ConversationMessage[];
		replyText?: string;
		inputPlaceholder?: string;
		noShadow?: boolean;
		showStar?: boolean;
		showMenu?: boolean;
		children?: Snippet;
	} = $props();

	let messages = $state<ConversationMessage[]>([]);
	let isTyping = $state(false);
	let bottomEl = $state<HTMLDivElement | null>(null);
	let seededMessages = false;

	$effect(() => {
		if (!seededMessages) {
			messages = initialMessages.map((message) => ({ ...message }));
			seededMessages = true;
		}
	});

	async function scrollToBottom() {
		await tick();
		bottomEl?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}

	async function handleSend(text: string) {
		messages = [...messages, { id: Date.now(), role: 'user', text }];
		await scrollToBottom();

		isTyping = true;
		await scrollToBottom();

		await new Promise((resolve) => setTimeout(resolve, 1200));

		isTyping = false;
		messages = [
			...messages,
			{ id: Date.now() + 1, role: 'assistant', text: replyText, timestamp: 'Just now' }
		];
		await scrollToBottom();
	}
</script>

<div
	class={cn(
		'flex h-full flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/88 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm',
		className
	)}
>
	<header class="flex items-center justify-between border-b border-[#EEF2F6] px-5 py-4">
		<div class="flex items-center gap-3">
			<div
				class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#7C4DFF] text-white shadow-[0_10px_30px_rgba(124,77,255,0.32)]"
			>
				<Icon class="size-4" />
			</div>

			<div class="leading-tight">
				<p class="text-[15px] font-semibold text-[#25324B]">{title}</p>
				<p class="flex items-center gap-1.5 text-[11px] font-medium text-[#67B95F]">
					<span class="inline-block size-1.5 rounded-full bg-current"></span>
					{status}
				</p>
			</div>
		</div>

		<div class="flex items-center gap-1">
			{#if showStar}
				<button
					type="button"
					class="flex size-9 items-center justify-center rounded-xl text-[#98A2B3] transition-colors hover:bg-[#F6F7FB] hover:text-[#25324B]"
				>
					<Star class="size-4" />
				</button>
			{/if}

			{#if showMenu}
				<button
					type="button"
					class="flex size-9 items-center justify-center rounded-xl text-[#98A2B3] transition-colors hover:bg-[#F6F7FB] hover:text-[#25324B]"
				>
					<MoreVertical class="size-4" />
				</button>
			{/if}
		</div>
	</header>

	<div class="flex-1 overflow-y-auto px-5 py-6">
		<div class="flex min-h-full flex-col gap-5">
			{#each messages as message (message.id)}
				{@const isUser = message.role === 'user'}

				<div class={cn('flex items-end gap-3', isUser && 'flex-row-reverse')}>
					<div
						class={cn(
							'flex size-9 shrink-0 items-center justify-center rounded-full',
							isUser ? 'bg-[#7C4DFF] text-white' : 'bg-[#7C4DFF] text-white'
						)}
					>
						{#if isUser}
							<User class="size-4" />
						{:else}
							<Icon class="size-4" />
						{/if}
					</div>

					<div
						class={cn(
							'max-w-[78%] whitespace-pre-line border px-4 py-3 text-[14px] leading-relaxed shadow-sm md:text-[15px]',
							isUser
								? 'rounded-[22px_6px_22px_22px] border-[#7C4DFF] bg-[#7C4DFF] text-white shadow-none'
								: 'rounded-[6px_22px_22px_22px] border-[#EEF2F6] bg-white text-[#344054]'
						)}
					>
						<div>{message.text}</div>
						{#if message.timestamp}
							<p
								class={cn(
									'mt-2 text-[10px] font-medium',
									isUser ? 'text-white/50' : 'text-[#98A2B3]'
								)}
							>
								{message.timestamp}
							</p>
						{/if}
					</div>
				</div>
			{/each}

			{#if children}
				<div class="pl-12">{@render children()}</div>
			{/if}

			{#if isTyping}
				<div class="flex items-end gap-3">
					<div
						class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#7C4DFF] text-white"
					>
						<Icon class="size-4" />
					</div>
					<div
						class="flex items-center gap-1.5 rounded-[6px_22px_22px_22px] border border-[#EEF2F6] bg-white px-4 py-3 shadow-sm"
					>
						{#each [0, 1, 2] as step}
							<span
								class="inline-block size-2 rounded-full bg-[#9B8AFB]"
								style="animation: conversation-bounce 1.1s {step * 0.18}s infinite"
							></span>
						{/each}
					</div>
				</div>
			{/if}

			<div bind:this={bottomEl}></div>
		</div>
	</div>

	<div class="border-t border-[#F5F7FA] px-4 pb-4 pt-3">
		<ChatInput placeholder={inputPlaceholder} onSend={handleSend} {noShadow} />
	</div>
</div>

<style>
	@keyframes conversation-bounce {
		0%,
		80%,
		100% {
			opacity: 0.28;
			transform: scale(0.82);
		}

		40% {
			opacity: 1;
			transform: scale(1.1);
		}
	}
</style>