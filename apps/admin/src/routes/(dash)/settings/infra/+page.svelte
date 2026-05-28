<script lang="ts">
	import * as Tabs from '$lib/components/shadcn/tabs';
	import { getInfraAdminData } from './infra.remote';
	import InfraConfigsPanel from './infra-configs-panel.svelte';
	import GlobalPromptsPanel from './global-prompts-panel.svelte';

	const admin = await getInfraAdminData();

	let configs = $derived(admin?.configs ?? []);
	let prompts = $derived(admin?.prompts ?? []);
	let providers = $derived(admin?.providers ?? []);
</script>

<div class="space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div class="space-y-1">
			<h1 class="text-3xl font-bold tracking-tight">Internal Infrastructure</h1>
			<p class="text-sm text-muted-foreground">
				Manage internal model configs and global prompt templates. Each config key and prompt key
				can have multiple versioned records — only the active version is used at runtime.
			</p>
		</div>
	</div>

	<Tabs.Root value="configs" class="space-y-6">
		<Tabs.List>
			<Tabs.Trigger value="configs">Infra Configs</Tabs.Trigger>
			<Tabs.Trigger value="prompts">Global Prompts</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="configs" class="space-y-6">
			<InfraConfigsPanel {configs} {providers} />
		</Tabs.Content>

		<Tabs.Content value="prompts" class="space-y-6">
			<GlobalPromptsPanel {prompts} />
		</Tabs.Content>
	</Tabs.Root>
</div>
