<script lang="ts">
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import MainSidebar from '$lib/main-sidebar.svelte';
  import { dashboard } from '$lib/state/dashboard.svelte';
  import { setContext } from 'svelte';
  import type { AppLayoutState } from '$lib/constants/data.js';
  import { cn } from '$lib/utils.js';
  import { PanelLeft } from '@lucide/svelte';

  let { children, data } = $props();

  let userInitials = $derived(
    (data.user?.name || data.user?.email || 'QO')
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join('') || 'QO'
  );

  $effect(() => {
    dashboard.hydrateProfiles(data.profiles, data.activeProfile);
  });

  const appLayoutState = $state<AppLayoutState>({
    sidebarVisible: true
  });

  const expandedContentPadding = 'pl-24 sm:pl-28 lg:pl-32';
  const collapsedContentPadding = 'pl-20 sm:pl-24 lg:pl-28';

  setContext('app-layout', appLayoutState);
</script>

<!-- Global Background -->

<!-- Global Background -->
<div class="fixed inset-0 z-[-1] bg-background transition-colors duration-500">
  <!-- Gradient Overlay -->
  <div
    class="absolute inset-0 opacity-50"
    style="
    background:
      radial-gradient(
        circle at top right,
        rgba(162, 89, 255, 0.35) 0%,
        rgba(225, 201, 255, 0.18) 45%,
        transparent 78%
      );
  "
  ></div>
</div>

<main class="relative min-h-screen bg-transparent px-4 text-foreground">
  <button
    type="button"
    class="group fixed top-3 left-5 z-40 h-fit w-fit rounded-full p-3 shadow-md transition-shadow hover:shadow-lg"
    onclick={() => {
      appLayoutState.sidebarVisible = !appLayoutState.sidebarVisible;
    }}
    aria-label="Show sidebar"
  >
    <Avatar.Root class="relative h-10 w-10 overflow-hidden rounded-full">
      {#if data.user?.avatar}
        <Avatar.Image
          src={data.user.avatar}
          alt={data.user.name ?? data.user.email ?? 'Account'}
          class="transition-opacity duration-200 group-hover:opacity-0"
        />
      {/if}
      <Avatar.Fallback class="transition-opacity duration-200 group-hover:opacity-0"
        >{userInitials}</Avatar.Fallback
      >
      <div
        class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-white/90 text-[#7d8597] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        <PanelLeft class="size-5" />
      </div>
    </Avatar.Root>
  </button>

  <MainSidebar
    agents={data.agents}
    features={data.features}
    user={data.user}
    bind:visible={appLayoutState.sidebarVisible}
  />

  <div
    class={cn(
      'flex flex-1 flex-col gap-4 p-4 transition-[padding-left] duration-300 sm:p-6',
      appLayoutState.sidebarVisible ? expandedContentPadding : collapsedContentPadding
    )}
  >
    {@render children()}
  </div>
</main>
