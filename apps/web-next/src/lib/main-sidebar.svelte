<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import AgentAvatar from '$lib/components/AgentAvatar.svelte';
  import ChatModeSidebar from '$lib/components/chat/sidebar/ChatModeSidebar.svelte';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as Tooltip from '$lib/components/shadcn/tooltip/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as DropdownMenu from '$lib/components/shadcn/dropdown-menu/index.js';
  import { CreditCard, LogOut } from '@lucide/svelte';
  import type { Agent } from '$lib/remote/agents.remote';
  import { dashboard } from '$lib/state/dashboard.svelte';

  import { cn } from '$lib/utils';

  import {
    Bot,
    FileSpreadsheet,
    FlaskConical,
    LayoutGrid,
    Loader2,
    PanelLeft,
    Plus,
    Settings
  } from '@lucide/svelte';

  type SidebarUser = {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  } | null;

  let {
    agents = [] as Agent[],
    features = [] as string[],
    user = null as SidebarUser,
    visible = $bindable(true),
    mode = 'default' as 'default' | 'chat'
  } = $props();

  const showFeature = (feature: string) => features.length === 0 || features.includes(feature);

  const navItems = $derived(
    [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: LayoutGrid,
        path: '/',
        show: true
      },
      {
        key: 'knowledge',
        label: 'Knowledge',
        icon: FileSpreadsheet,
        path: '/knowledge',
        show: showFeature('page:knowledge')
      },
      {
        key: 'tools',
        label: 'Tools',
        icon: FlaskConical,
        path: '/tools',
        show: showFeature('page:tools')
      }
    ].filter((item) => item.show)
  );

  const selectedAgents = $derived(agents.filter((agent) => agent.status === 'active').slice(0, 5));

  const userInitials = $derived(
    (user?.name || user?.email || 'QO')
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'QO'
  );

  let createDialogOpen = $state(false);
  let newDashboardName = $state('');
  let creatingDashboard = $state(false);

  async function createDashboard() {
    const name = newDashboardName.trim();
    if (!name || creatingDashboard) return;
    creatingDashboard = true;
    try {
      await dashboard.createProfile({
        name,
        profileType: 'custom',
        profileIcon: 'LayoutGrid',
        profileColor: 'var(--primary)',
        sourceProfileId: dashboard.activeProfileId ?? undefined
      });
      newDashboardName = '';
      createDialogOpen = false;
    } finally {
      creatingDashboard = false;
    }
  }

  function isActive(path: string) {
    if (path === '/') return $page.url.pathname === '/';

    return $page.url.pathname.startsWith(path);
  }

  function navigate(path: string) {
    visible = true;
    goto(path);
  }

  function handleSidebarToggle() {
    visible = !visible;
  }
</script>

<Tooltip.Provider delayDuration={150}>
  {#if mode === 'chat'}
    <ChatModeSidebar bind:visible />
  {:else}
    <main
      class={cn(
        'fixed top-[12.5%] left-4 z-30 flex w-fit flex-col gap-20 transition-all duration-300',
        visible ? 'translate-x-0 opacity-100' : '-translate-x-24 opacity-0 pointer-events-none'
      )}
      aria-hidden={!visible}
    >
      <Card.Root
        class="w-fit rounded-full border-white/80 bg-white/85 p-2 shadow-sm backdrop-blur-xl"
      >
        <Card.Content class="flex flex-col gap-3 p-1">
          {#each navItems as item (item.key)}
            <Tooltip.Root delayDuration={150}>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <button
                    {...props}
                    type="button"
                    onclick={() => navigate(item.path)}
                    class={cn(
                      'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-all',
                      isActive(item.path)
                        ? 'bg-[#904EFF] text-white shadow-md shadow-violet-500/20'
                        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                    )}
                    aria-label={item.label}
                  >
                    <item.icon class="h-5 w-5" />
                  </button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content side="right">{item.label}</Tooltip.Content>
            </Tooltip.Root>
          {/each}

          <!-- New Dashboard -->
          <Tooltip.Root delayDuration={150}>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  type="button"
                  onclick={() => (createDialogOpen = true)}
                  class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                  aria-label="New dashboard"
                >
                  <Plus class="h-5 w-5" />
                </button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content side="right">New dashboard</Tooltip.Content>
          </Tooltip.Root>
        </Card.Content>
      </Card.Root>

      {#if selectedAgents.length > 0}
        <Card.Root
          class="w-fit rounded-full border-white/80 bg-white/85 p-2 shadow-sm backdrop-blur-xl"
        >
          <Card.Content class="flex flex-col gap-3 p-1">
            {#each selectedAgents as agent (agent.id)}
              <Tooltip.Root delayDuration={150}>
                <Tooltip.Trigger>
                  {#snippet child({ props })}
                    <a
                      {...props}
                      href="/chat?agent={agent.id}"
                      class={cn(
                        'inline-flex h-11 w-11 items-center justify-center rounded-full transition-all',
                        $page.url.pathname === '/chat' &&
                          $page.url.searchParams.get('agent') === agent.id
                          ? 'bg-violet-50 ring-2 ring-violet-300'
                          : 'hover:bg-slate-100'
                      )}
                    >
                      <AgentAvatar {agent} size="sm" />
                    </a>
                  {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Content side="right">{agent.name}</Tooltip.Content>
              </Tooltip.Root>
            {/each}
          </Card.Content>
        </Card.Root>
      {:else if showFeature('page:chat')}
        <Card.Root
          class="w-fit rounded-full border-white/80 bg-white/85 p-2 shadow-sm backdrop-blur-xl"
        >
          <Card.Content class="p-1">
            <Tooltip.Root delayDuration={150}>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <a
                    {...props}
                    href="/chat"
                    class="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Bot class="h-5 w-5" />
                  </a>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content side="right">Chat</Tooltip.Content>
            </Tooltip.Root>
          </Card.Content>
        </Card.Root>
      {/if}
      <Card.Root
        class="w-fit rounded-full border-white/80 bg-white/85 p-2 shadow-sm backdrop-blur-xl"
      >
        <Card.Content class="flex flex-col gap-3 p-1">
          <!-- Settings -->
          <Tooltip.Root delayDuration={150}>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  type="button"
                  onclick={() => navigate('/preferences/general')}
                  class={cn(
                    'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-all',
                    isActive('/preferences')
                      ? 'bg-[#904EFF] text-white shadow-md shadow-violet-500/20'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                  )}
                >
                  <Settings class="h-5 w-5" />
                </button>
              {/snippet}
            </Tooltip.Trigger>

            <Tooltip.Content side="right">Preferences</Tooltip.Content>
          </Tooltip.Root>

          <!-- Sidebar Toggle -->
          <Tooltip.Root delayDuration={150}>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  type="button"
                  onclick={handleSidebarToggle}
                  class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                >
                  <PanelLeft class="h-5 w-5" />
                </button>
              {/snippet}
            </Tooltip.Trigger>

            <Tooltip.Content side="right">Sidebar</Tooltip.Content>
          </Tooltip.Root>

          <!-- Account -->
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  type="button"
                  class={cn(
                    'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-all',
                    isActive('/account') ? 'ring-2 ring-[#904EFF]' : 'hover:bg-slate-100'
                  )}
                >
                  <Avatar.Root class="h-10 w-10">
                    {#if user?.avatar}
                      <Avatar.Image
                        src={user.avatar}
                        alt={user.name ?? user.email ?? 'User'}
                      />
                    {/if}
                    <Avatar.Fallback>{userInitials}</Avatar.Fallback>
                  </Avatar.Root>
                </button>
              {/snippet}
            </DropdownMenu.Trigger>

            <DropdownMenu.Content
              class="z-50 min-w-56 rounded-2xl border-white/80 bg-white/95 shadow-xl backdrop-blur-xl"
              side="right"
              align="end"
              sideOffset={18}
              avoidCollisions={true}              portalProps={{ to: 'body' }}            >
              <DropdownMenu.Label class="p-0 font-normal">
                <div class="flex items-center gap-3 px-3 py-3">
                  <Avatar.Root class="h-9 w-9">
                    {#if user?.avatar}
                      <Avatar.Image src={user.avatar} alt={user.name ?? user.email ?? 'User'} />
                    {/if}
                    <Avatar.Fallback>{userInitials}</Avatar.Fallback>
                  </Avatar.Root>
                  <div class="grid flex-1 text-start leading-tight">
                    {#if user?.name}
                      <span class="truncate text-sm font-medium text-slate-800">{user.name}</span>
                    {/if}
                    {#if user?.email}
                      <span class="truncate text-xs text-slate-400">{user.email}</span>
                    {/if}
                  </div>
                </div>
              </DropdownMenu.Label>

              <DropdownMenu.Separator />

              <DropdownMenu.Item
                onclick={() => navigate('/preferences/billing')}
                class="cursor-pointer rounded-xl"
              >
                <CreditCard class="mr-2 h-4 w-4" />
                Billing
              </DropdownMenu.Item>

              <DropdownMenu.Separator />

              <DropdownMenu.Item
                onclick={() => goto('/logout')}
                class="cursor-pointer rounded-xl text-red-500 focus:text-red-500"
              >
                <LogOut class="mr-2 h-4 w-4" />
                Log out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Card.Content>
      </Card.Root>
    </main>
  {/if}
</Tooltip.Provider>

<Dialog.Root bind:open={createDialogOpen}>
  <Dialog.Content
    class="overflow-hidden rounded-[30px] border-white/70 bg-white/95 p-0 shadow-[0_32px_80px_rgba(15,23,42,0.18)] sm:max-w-lg"
  >
    <div
      class="border-b border-[#E7EDF7] bg-linear-to-br from-[#F8FBFF] via-white to-[#F4F0FF] p-6 pr-14"
    >
      <Dialog.Header>
        <Dialog.Title class="text-xl font-semibold tracking-tight text-[#25324B]"
          >Create dashboard</Dialog.Title
        >
        <Dialog.Description class="text-sm leading-6 text-[#7B8794]">
          Start from your current layout, then customize widgets, colors, and data sources for that
          workspace.
        </Dialog.Description>
      </Dialog.Header>
    </div>

    <div class="grid gap-5 p-6">
      <div class="rounded-[24px] border border-[#E7EDF7] bg-[#F8FBFF] p-4">
        <p class="text-xs font-semibold tracking-[0.2em] text-[#98A2B3] uppercase">Source layout</p>
        <p class="mt-2 text-sm font-medium text-[#25324B]">
          {dashboard.activeProfile?.profile_name ?? 'Current dashboard'}
        </p>
        <p class="mt-1 text-xs text-[#7B8794]">
          Widgets, order, and card configuration will be duplicated into the new dashboard.
        </p>
      </div>

      <div class="space-y-2">
        <label for="sidebar-dashboard-name" class="text-sm font-medium text-[#25324B]"
          >Dashboard name</label
        >
        <Input
          id="sidebar-dashboard-name"
          bind:value={newDashboardName}
          placeholder="Family office, Trading, Tasks..."
          class="h-11 rounded-2xl border-[#E7EDF7] bg-white"
        />
      </div>
    </div>

    <Dialog.Footer class="border-t border-[#E7EDF7] bg-[#FBFCFF] p-4">
      <Button
        variant="outline"
        class="rounded-full border-[#D7DCE5]"
        onclick={() => (createDialogOpen = false)}
      >
        Cancel
      </Button>
      <Button
        class="rounded-full bg-[#111A2E] text-white hover:bg-[#0A1120]"
        onclick={createDashboard}
        disabled={!newDashboardName.trim() || creatingDashboard}
      >
        {#if creatingDashboard}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
        {/if}
        Create dashboard
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
