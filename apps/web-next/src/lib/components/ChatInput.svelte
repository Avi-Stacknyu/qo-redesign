<script lang="ts">
  import type { Snippet } from 'svelte';
  import StackButton from '$lib/components/StackButton.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import { ListFilter, Mic, Paperclip, Search, SendHorizonal } from '@lucide/svelte';

  let {
    placeholder = 'Search',
    onSubmit,
    onSend,
    noShadow = false,
    value = $bindable(''),
    submitDisabled = false,
    isSubmitting = false,
    children,
    showAction = true
  }: {
    placeholder?: string;
    onSubmit?: (value: string) => boolean | void | Promise<boolean | void>;
    onSend?: (value: string) => void;
    noShadow?: boolean;
    value?: string;
    submitDisabled?: boolean;
    isSubmitting?: boolean;
    children?: Snippet;
    showAction?: boolean;
  } = $props();

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || submitDisabled || isSubmitting) return;

    onSend?.(trimmed);
    const result = await onSubmit?.(trimmed);
    if (result !== false) value = '';
  }
</script>

<div
  class="rounded-2xl p-px"
  style="
		background: linear-gradient(90deg, rgba(162, 89, 255, 0.5) 0%, rgba(104, 117, 253, 0.5) 50%, rgba(255, 89, 180, 0.5) 100%);
		{noShadow
    ? ''
    : 'box-shadow: 0px 4px 40px 0px #DDC2FF, 0px 4px 40px 0px #E3F0FF, 0px 4px 40px 0px #FF59B43B;'}
	"
>
  <div class="flex w-full flex-col gap-3 rounded-2xl bg-white p-4 md:p-6">
    <div class="flex items-center gap-2 md:gap-2.5">
      <Search class="size-5 text-muted-foreground md:size-6" />

      <Input
        bind:value
        class="border-0 px-1 text-sm font-normal shadow-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none md:text-base"
        {placeholder}
        onkeydown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
      />

      <Button
        variant="secondary"
        class="group bg-transparent p-1 shadow-none hover:cursor-pointer hover:bg-transparent focus:bg-transparent focus:ring-0 active:bg-transparent disabled:cursor-not-allowed md:p-2"
        disabled={submitDisabled || isSubmitting || !value.trim()}
        onclick={handleSubmit}
      >
        <SendHorizonal
          class="size-5 text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:scale-110 md:size-6"
          fill="text-primary"
        />
      </Button>
    </div>

    {#if children}
      {@render children()}
    {:else if showAction}
      <div class="flex flex-wrap items-center gap-2">
        <StackButton
          label="Attach"
          icon={Paperclip}
          variant="secondary"
          class="text-sm font-normal text-muted-foreground md:text-base"
          iconClass="w-4 h-4 md:w-5 md:h-5 text-muted-foreground rotate-45"
        />

        <StackButton
          label="Agent"
          icon={ListFilter}
          variant="secondary"
          class="text-sm font-normal text-muted-foreground md:text-base"
          iconClass="w-4 h-4 md:w-5 md:h-5 text-muted-foreground"
        />

        <Button variant="ghost" class="cursor-pointer">
          <Mic class="w-5 h-5" />
        </Button>
      </div>
    {/if}
  </div>
</div>
