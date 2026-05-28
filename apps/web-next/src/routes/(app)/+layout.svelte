<script lang="ts">
  import * as Avatar from '$lib/components/ui/avatar/index.js';
	import MainSidebar from '$lib/main-sidebar.svelte';
  import { dashboard } from '$lib/state/dashboard.svelte';

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
  <div class="fixed top-3 left-4 z-30 h-fit w-fit rounded-full bg-white p-3 shadow-md">
    <Avatar.Root class="relative h-10 w-10">
      {#if data.user?.avatar}
        <Avatar.Image src={data.user.avatar} alt={data.user.name ?? data.user.email ?? 'Account'} />
      {/if}
      <Avatar.Fallback>{userInitials}</Avatar.Fallback>
    </Avatar.Root>
  </div>

  <MainSidebar agents={data.agents} features={data.features} user={data.user} />

 <div class="flex flex-1 flex-col gap-4 pl-24 sm:pl-28 p-4 sm:p-6">
    {@render children()}
  </div>
</main>
