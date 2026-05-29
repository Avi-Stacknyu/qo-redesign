<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Bell, LogOut, Menu, Palette, SlidersHorizontal, X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import Button from './ui/button/button.svelte';
  import * as Avatar from './ui/avatar';
  import ThemeSelector from './ThemeSelector.svelte';
    import { fly } from 'svelte/transition';

  let {
    pageTitle,
    header,
    headerVerticalAlign = 'end',
    headerTabs,
    headerUtilities,
    profileHref = '/preferences/profile',
    onSettingsClick,
    children
  }: {
    pageTitle: string;
    header?: Snippet;
    headerVerticalAlign?: 'end' | 'center';
    headerTabs?: Snippet;
    headerUtilities?: Snippet;
    profileHref?: string;
    onSettingsClick?: () => void;
    children?: Snippet;
  } = $props();

  let mobileMenuOpen = $state(false);

  let currentUser = $derived($page.data.user ?? null);
  let avatarSrc = $derived(currentUser?.avatar ?? '');
  let avatarAlt = $derived(currentUser?.name ?? currentUser?.email ?? 'User avatar');
  let avatarFallback = $derived(
    (currentUser?.name ?? currentUser?.email ?? 'User')
      .split(/\s+/)
      .map((part: string) => part[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  );
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<div class="relative min-h-[calc(100vh-4rem)] w-full">

  <!-- ─── MOBILE HEADER ──────────────────────────────────────── -->
  <div class="mb-4 md:hidden">

    <!-- Top bar: menu toggle (left) + Bell + Avatar (right) -->
    <div class="mb-4 flex h-12 items-center gap-2">
      {#if onSettingsClick || $page.url.pathname === '/'}
        <Button
          class="size-10 rounded-full bg-white/90 shadow-sm ring-1 ring-border/20 backdrop-blur-sm"
          variant="secondary"
          onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {#if mobileMenuOpen}
            <X class="size-4" />
          {:else}
            <Menu class="size-4" />
          {/if}
        </Button>
      {/if}

      <div class="flex-1"></div>

      <Button
        class="size-10 rounded-full bg-white/90 shadow-sm ring-1 ring-border/20 backdrop-blur-sm"
        variant="secondary"
      >
        <Bell class="size-4" />
      </Button>

      <Button
        class="size-10 rounded-full bg-white/90 shadow-sm ring-1 ring-border/20 backdrop-blur-sm text-red-500 hover:bg-red-50"
        variant="secondary"
        onclick={() => goto('/logout')}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut class="size-4" />
      </Button>

      <Button
        class="size-10 cursor-pointer rounded-full bg-white/90 p-0 shadow-sm ring-1 ring-border/20 backdrop-blur-sm"
        variant="secondary"
        onclick={() => goto(profileHref)}
      >
        <Avatar.Root class="size-10">
          {#if avatarSrc}
            <Avatar.Image class="size-10 rounded-full object-cover" src={avatarSrc} alt={avatarAlt} />
          {/if}
          <Avatar.Fallback class="size-10 rounded-full">{avatarFallback}</Avatar.Fallback>
        </Avatar.Root>
      </Button>
    </div>

    <!-- Expandable extra-actions panel -->
    {#if mobileMenuOpen}
      <div 
	  in:fly={{
		y : -4,
		duration : 400
	  }}
	  out:fly={{
		y : 0,
		duration : 400
	  }}
	  class="mb-4 flex items-center gap-2 rounded-2xl border border-border/30 bg-white/80 p-2 shadow-sm backdrop-blur-sm">
        {#if onSettingsClick}
          <Button
            class="h-9 flex-1 rounded-xl bg-white text-xs font-medium shadow-sm ring-1 ring-border/20"
            variant="secondary"
            onclick={() => { onSettingsClick?.(); mobileMenuOpen = false; }}
          >
            <SlidersHorizontal class="mr-1.5 size-3.5" />
            Edit Layout
          </Button>
        {/if}
        <ThemeSelector>
          {#snippet trigger()}
            <button class="flex h-9 p-3 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-medium shadow-sm ring-1 ring-border/20 transition-colors hover:bg-slate-50">
              <Palette class="size-3.5" />
              Theme
            </button>
          {/snippet}
        </ThemeSelector>
      </div>
    {/if}

    <!-- Header content -->
    {#if header}
      <div class="mb-4 min-w-0">{@render header()}</div>
    {/if}

    <!-- Tabs -->
    {#if headerTabs}
      <div class="mb-3">{@render headerTabs()}</div>
    {/if}

    <!-- Utilities -->
    {#if headerUtilities}
      <div>{@render headerUtilities()}</div>
    {/if}
  </div>

  <!-- ─── DESKTOP HEADER ──────────────────────────────────────── -->
  <div
    class={`mb-10 hidden md:flex md:flex-row md:justify-between md:gap-6 ${headerVerticalAlign === 'center' ? 'md:items-center' : 'md:items-end'}`}
  >
    {#if header}
      <div class="min-w-0 flex-1">
        {@render header()}
      </div>
    {/if}

    {#if headerTabs}
      {@render headerTabs()}
    {/if}

    {#if headerUtilities}
      {@render headerUtilities()}
    {/if}

    <div class="flex items-center gap-2.5 ml-6">
      {#if $page.url.pathname === '/'}

        <Button
          class="size-12 rounded-full bg-white/90 shadow-sm ring-1 ring-border/20 backdrop-blur-sm"
          variant="secondary"
          onclick={onSettingsClick}
        >
          <SlidersHorizontal class="size-5" />
        </Button>

        <ThemeSelector>
          {#snippet trigger()}
            <button
              class="flex size-12 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-border/20 backdrop-blur-sm hover:bg-white transition-colors"
            >
              <Palette class="size-5" />
            </button>
          {/snippet}
        </ThemeSelector>
      {/if}

      <Button
        class="size-12 rounded-full bg-white/90 shadow-sm ring-1 ring-border/20 backdrop-blur-sm"
        variant="secondary"
      >
        <Bell class="size-5" />
      </Button>

      <Button
        class="size-12 cursor-pointer rounded-full bg-white/90 p-0 shadow-sm ring-1 ring-border/20 backdrop-blur-sm"
        variant="secondary"
        onclick={() => goto(profileHref)}
      >
        <Avatar.Root class="size-12">
          {#if avatarSrc}
            <Avatar.Image
              class="size-12 rounded-full object-cover"
              src={avatarSrc}
              alt={avatarAlt}
            />
          {/if}
          <Avatar.Fallback class="size-12 rounded-full">{avatarFallback}</Avatar.Fallback>
        </Avatar.Root>
      </Button>
    </div>
  </div>

  {#if children}
    {@render children()}
  {/if}
</div>
