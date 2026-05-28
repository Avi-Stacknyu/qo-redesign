<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  import AgentAvatar from '$lib/components/AgentAvatar.svelte';

  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Tooltip from '$lib/components/shadcn/tooltip/index.js';

  import type { Agent } from '$lib/remote/agents.remote';

  import { cn } from '$lib/utils';

  import {
    Bot,
    FileSpreadsheet,
    FlaskConical,
    LayoutGrid,
    PanelLeft,
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
    visible = $bindable(true)
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
        <Tooltip.Root delayDuration={150}>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <button
                {...props}
                type="button"
                onclick={() => navigate('/preferences')}
                class={cn(
                  'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-all',
                  isActive('/account') ? 'ring-2 ring-[#904EFF]' : 'hover:bg-slate-100'
                )}
              >
                <Avatar.Root class="h-10 w-10">
                  {#if user?.avatar}
                    <Avatar.Image src={user.avatar} alt={user.name ?? user.email ?? 'User'} />
                  {/if}

                  <Avatar.Fallback>
                    {userInitials}
                  </Avatar.Fallback>
                </Avatar.Root>
              </button>
            {/snippet}
          </Tooltip.Trigger>

          <Tooltip.Content side="right">
            {user?.name ?? user?.email ?? 'Account'}
          </Tooltip.Content>
        </Tooltip.Root>
      </Card.Content>
    </Card.Root>
  </main>
</Tooltip.Provider>
