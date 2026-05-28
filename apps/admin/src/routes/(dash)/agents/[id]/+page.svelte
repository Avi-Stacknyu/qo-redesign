<script lang="ts">
	import { page } from '$app/state';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import { Skeleton } from '$lib/components/shadcn/skeleton';
	import {
		getAgent,
		getFlowVersions,
		getActiveFlow,
		getAvailableModels,
		getAvailableTools,
		getSystemUploads,
		getAvailablePrompts,
		getInjectableAttributes,
		type FlowVersion,
		type AgentWithFlow,
		type ModelWithProvider,
		type Tool,
		type SystemUpload,
		type Prompt,
		type InjectableAttribute
	} from '$lib/remote/agent.remote';
	import type { TagRule } from '@repo/shared/types';
	import { FlowEditor } from './flow-editor';
	import { Playground } from './playground';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import GitBranch from '@lucide/svelte/icons/git-branch';
	import Play from '@lucide/svelte/icons/play';
	import Workflow from '@lucide/svelte/icons/workflow';

	const agentId = $derived(page.params.id ?? '');

	// Queries - these use params.id from getRequestEvent() internally
	const agentQuery = $derived(getAgent());
	const versionsQuery = $derived(getFlowVersions());
	const activeFlowQuery = $derived(getActiveFlow());
	const modelsQuery = $derived(getAvailableModels());
	const toolsQuery = $derived(getAvailableTools());
	const systemUploadsQuery = $derived(getSystemUploads());
	const promptsQuery = $derived(getAvailablePrompts());
	const injectableAttributesQuery = $derived(getInjectableAttributes());

	// Resolved state
	let agent = $state<AgentWithFlow | null>(null);
	let isDiscovery = $derived(agent?.purpose === 'discovery');
	let versions = $state<FlowVersion[]>([]);
	let activeFlow = $state<FlowVersion | null>(null);
	let availableModels = $state<ModelWithProvider[]>([]);
	let availableTools = $state<Tool[]>([]);
	let systemUploads = $state<SystemUpload[]>([]);
	let availablePrompts = $state<Prompt[]>([]);
	let injectableAttributes = $state<InjectableAttribute[]>([]);

	// View state: 'editor' | 'playground'
	let activeView = $state<'editor' | 'playground'>('editor');

	$effect(() => {
		const result = agentQuery.current;
		if (result) agent = result as AgentWithFlow;
	});

	$effect(() => {
		const result = versionsQuery.current;
		if (Array.isArray(result)) versions = result as FlowVersion[];
	});

	$effect(() => {
		const result = activeFlowQuery.current;
		if (result) activeFlow = result as FlowVersion;
	});

	$effect(() => {
		const result = modelsQuery.current;
		if (Array.isArray(result)) availableModels = result as ModelWithProvider[];
	});

	$effect(() => {
		const result = toolsQuery.current;
		if (Array.isArray(result)) availableTools = result as Tool[];
	});

	$effect(() => {
		const result = systemUploadsQuery.current;
		if (Array.isArray(result)) systemUploads = result as SystemUpload[];
	});

	$effect(() => {
		const result = promptsQuery.current;
		if (Array.isArray(result)) availablePrompts = result as Prompt[];
	});

	$effect(() => {
		const result = injectableAttributesQuery.current;
		if (Array.isArray(result)) injectableAttributes = result as InjectableAttribute[];
	});

	function refreshVersions() {
		versionsQuery.refresh();
		activeFlowQuery.refresh();
	}

	function getStatusColor(status: string | null | undefined) {
		switch (status) {
			case 'active':
				return 'bg-green-500/10 text-green-500 border-green-500/20';
			case 'development':
				return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}
</script>

<div class="flex h-[calc(100vh-4rem)] flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b bg-background px-4 py-2">
		<div class="flex items-center gap-3">
			<Button variant="ghost" size="icon" href="/agents" class="h-8 w-8">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			{#if agent}
				<div class="flex items-center gap-3">
					<div>
						<h1 class="text-lg leading-none font-semibold">{agent.name}</h1>
						<p class="mt-0.5 text-xs text-muted-foreground">
							{agent.description || 'No description'}
						</p>
					</div>
					<Badge variant="outline" class={getStatusColor(agent.status)}>
						{agent.status}
					</Badge>
					{#if isDiscovery}
						<Badge variant="outline" class="border-purple-500/20 bg-purple-500/10 text-purple-500">
							Discovery
						</Badge>
					{/if}
					{#if activeFlow}
						<Badge variant="outline" class="flex items-center gap-1 font-mono text-xs">
							<GitBranch class="h-3 w-3" />
							v{activeFlow.version}
						</Badge>
					{/if}
				</div>
			{:else}
				<div class="flex items-center gap-3">
					<Skeleton class="h-6 w-32" />
					<Skeleton class="h-5 w-16" />
				</div>
			{/if}
		</div>

		<!-- View Toggle -->
		<div class="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
			<Button
				variant={activeView === 'editor' ? 'secondary' : 'ghost'}
				size="sm"
				class="h-7 gap-1.5 px-3 text-xs"
				onclick={() => (activeView = 'editor')}
			>
				<Workflow class="h-3.5 w-3.5" />
				Flow Editor
			</Button>
			<Button
				variant={activeView === 'playground' ? 'secondary' : 'ghost'}
				size="sm"
				class="h-7 gap-1.5 px-3 text-xs"
				onclick={() => (activeView = 'playground')}
			>
				<Play class="h-3.5 w-3.5" />
				Playground
			</Button>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 overflow-hidden">
		{#if activeView === 'editor'}
			{#if agent}
				<FlowEditor
					{agentId}
					{versions}
					{activeFlow}
					{availableModels}
					{availableTools}
					{systemUploads}
					{availablePrompts}
					{injectableAttributes}
					onVersionSaved={refreshVersions}
				/>
			{:else}
				<div class="flex h-full items-center justify-center">
					<div class="text-center">
						<Skeleton class="mx-auto h-8 w-8 rounded-full" />
						<Skeleton class="mx-auto mt-4 h-4 w-32" />
					</div>
				</div>
			{/if}
		{:else if activeView === 'playground'}
			{#if agent}
				<Playground {agentId} agentName={agent.name ?? 'Agent'} />
			{:else}
				<div class="flex h-full items-center justify-center">
					<div class="text-center">
						<Skeleton class="mx-auto h-8 w-8 rounded-full" />
						<Skeleton class="mx-auto mt-4 h-4 w-32" />
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
