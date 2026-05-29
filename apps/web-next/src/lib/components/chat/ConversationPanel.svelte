<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { tick } from 'svelte';
  import { MoreVertical, Sparkles, User } from '@lucide/svelte';
  import { marked } from 'marked';

  import ChatInput from '$lib/components/ChatInput.svelte';
  import ChatNavActions from './sidebar/ChatNavActions.svelte';
  import * as Tooltip from '$lib/components/shadcn/tooltip/index.js';
  import { cn } from '$lib/utils';

  marked.setOptions({ breaks: true, gfm: true });

  export type ConversationRole = 'assistant' | 'user';

  export type ConversationMessage = {
    id: string | number;
    role: ConversationRole;
    text: string;
    timestamp?: string;
  };

  let {
    class: className = '',
    title = 'Assistant',
    status = 'Active now',
    threadTitle = '',
    icon: Icon = Sparkles,
    messages = [],
    isTyping = false,
    inputPlaceholder = 'Reply to Assistant...',
    emptyStateTitle = 'Start a conversation',
    emptyStateDescription = 'Ask a question or pick a section to continue.',
    noShadow = true,
    showStar = false,
    showMenu = true,
    threadId = null,
    favorite = false,
    onFavoriteChange,
    disabled = false,
    onSend,
    headerIcon,
    headerTrailing,
    content,
    footer,
    emptyStateIcon
  }: {
    class?: string;
    title?: string;
    status?: string;
    threadTitle?: string;
    icon?: Component<{ class?: string }>;
    messages?: ConversationMessage[];
    isTyping?: boolean;
    inputPlaceholder?: string;
    emptyStateTitle?: string;
    emptyStateDescription?: string;
    noShadow?: boolean;
    showStar?: boolean;
    showMenu?: boolean;
    threadId?: string | null;
    favorite?: boolean;
    onFavoriteChange?: (favorite: boolean) => void;
    disabled?: boolean;
    onSend?: (text: string) => Promise<void> | void;
    headerIcon?: Snippet;
    headerTrailing?: Snippet;
    content?: Snippet;
    footer?: Snippet;
    emptyStateIcon?: Snippet;
  } = $props();

  let bottomEl = $state<HTMLDivElement | null>(null);

  async function scrollToBottom() {
    await tick();
    bottomEl?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  $effect(() => {
    void messages.length;
    void isTyping;
    void scrollToBottom();
  });

  async function handleSend(text: string) {
    if (!text.trim() || disabled) return;
    await onSend?.(text);
  }

  function renderAssistantMessage(text: string) {
    return marked.parse(text) as string;
  }
</script>

<Tooltip.Provider delayDuration={150}>
  <div
    class={cn(
      'relative flex h-full flex-col overflow-hidden rounded-[30px] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm',
      className
    )}
  >
    <header
      class="relative flex items-center justify-between border-b border-[#EEF2F6] px-5 py-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#7C4DFF] text-white shadow-[0_10px_30px_rgba(124,77,255,0.32)]"
        >
          {#if headerIcon}
            {@render headerIcon()}
          {:else}
            <Icon class="size-4" />
          {/if}
        </div>

        <div class="leading-tight">
          <p class="text-[15px] font-semibold text-[#25324B]">{title}</p>
          <p
            class="flex items-center gap-1.5 font-Inter text-[11px] font-medium text-muted-foreground"
          >
            {threadTitle}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-1">
        {#if showStar}
          <ChatNavActions {threadId} {favorite} {onFavoriteChange} />
        {/if}

        {#if showMenu}
          <button
            type="button"
            aria-label="Conversation options"
            class="flex size-9 items-center justify-center rounded-xl text-[#98A2B3] transition-colors hover:bg-[#F6F7FB] hover:text-[#25324B]"
          >
            <MoreVertical class="size-4" />
          </button>
        {/if}
      </div>
    </header>

    {#if content}
      <div class="flex-1 min-h-0">
        {@render content()}
      </div>
    {:else}
      <div class="flex-1 overflow-y-auto px-5 py-4">
        <div class="flex min-h-full flex-col gap-4">
          {#if messages.length === 0 && !isTyping}
            <div class="flex h-full flex-col items-center justify-center px-4 text-center">
              <div class="mb-3 flex size-11 items-center justify-center rounded-full bg-[#F1E9FF]">
                {#if emptyStateIcon}
                  {@render emptyStateIcon()}
                {:else}
                  <Icon class="size-5 text-[#7C4DFF]" />
                {/if}
              </div>
              <h3 class="mb-1 text-sm font-medium text-[#25324B]">{emptyStateTitle}</h3>
              <p class="max-w-xs text-[13px] leading-relaxed text-[#667085]">
                {emptyStateDescription}
              </p>
            </div>
          {:else}
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
                    'max-w-[78%] overflow-hidden border px-4 py-3 text-[14px] leading-relaxed shadow-sm md:text-[15px]',
                    isUser
                      ? 'rounded-[22px_6px_22px_22px] border-[#7C4DFF] bg-[#7C4DFF] text-white shadow-none'
                      : 'rounded-[6px_22px_22px_22px] border-[#EEF2F6] bg-white text-[#344054]'
                  )}
                >
                  {#if isUser}
                    <div class="whitespace-pre-wrap">{message.text}</div>
                  {:else}
                    <div
                      class="prose prose-sm max-w-none prose-p:m-0 prose-p:leading-relaxed prose-a:font-medium prose-code:rounded prose-code:bg-[#F8FAFC] prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#F8FAFC] prose-hr:hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                    >
                      {@html renderAssistantMessage(message.text)}
                    </div>
                  {/if}
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
          {/if}
        </div>
      </div>
    {/if}

    {#if footer}
      {@render footer()}
    {:else}
      <div class="border-t border-[#F5F7FA] px-4 pt-2 pb-4">
        <ChatInput
          placeholder={inputPlaceholder}
          onSend={handleSend}
          {noShadow}
          showAction={false}
        />
      </div>
    {/if}
  </div>
</Tooltip.Provider>

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
