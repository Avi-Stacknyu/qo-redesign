<script lang="ts">
	import { FileText, Network, Search, User } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import FilesList from '$lib/components/memory/FilesList.svelte';
	import MemoryGraph from '$lib/components/memory/MemoryGraph.svelte';
	import ProfileDiscoverTab from '$lib/components/profile/ProfileDiscoverTab.svelte';
	import ProfileDocumentTab from '$lib/components/profile/ProfileDocumentTab.svelte';
	import { shouldLogProfilerStreamDisconnect } from '$lib/data/profile-ui';
	import type { ProfileData } from '$lib/data/profile-types';
	import { loadStructuredProfile } from '$lib/remote/profile-data.remote';
	import { loadGraphMemory, type FilesData, type GraphData } from '$lib/remote/memory.remote';
	import { cn } from '$lib/utils';
	import DiscoverTab from './DiscoverTab.svelte';
	import MemorySurfaceCard from './MemorySurfaceCard.svelte';
	import ProfileTab from './ProfileTab.svelte';

	let {
		profile,
		defaultAgentId,
		graph,
		files
	}: {
		profile: ProfileData;
		defaultAgentId: string;
		graph: GraphData;
		files: FilesData;
	} = $props();

	const memoryTabs = [
		{ value: 'discover', label: 'Discover', icon: Search },
		{ value: 'profile', label: 'Profile', icon: User },
		{ value: 'document', label: 'Document', icon: FileText },
		{ value: 'memory', label: 'Memory', icon: Network }
	] as const;

	type MemoryTabValue = (typeof memoryTabs)[number]['value'];

	let activeTab = $state<MemoryTabValue>('discover');
	let discoveryThreadId = $state<string | null>(null);
	let profileQuery = loadStructuredProfile();
	let graphQuery = loadGraphMemory();
	let currentProfile = $derived(profileQuery.current ?? profile);
	let currentGraph = $derived(graphQuery.current ?? graph);
	let profilerEvents: EventSource | null = null;
	let subscribedThreadId: string | null = null;
	let intentionalProfilerDisconnect = false;
	let previousTab: MemoryTabValue = 'discover';

	function disconnectProfilerEvents() {
		if (profilerEvents) {
			intentionalProfilerDisconnect = true;
			profilerEvents.close();
		}
		profilerEvents = null;
		subscribedThreadId = null;
	}

	function connectProfilerEvents(threadId: string) {
		if (profilerEvents && subscribedThreadId === threadId) return;
		disconnectProfilerEvents();

		const source = new EventSource(`/api/chat/threads/${threadId}/profiler-events`);
		source.onopen = () => {
			intentionalProfilerDisconnect = false;
		};
		source.addEventListener('profiler-complete', () => {
			void profileQuery.refresh();
			void graphQuery.refresh();
		});
		source.addEventListener('profiler-failed', () => {
			console.error('Profiler update failed for discovery thread', threadId);
		});
		source.onerror = () => {
			if (
				!shouldLogProfilerStreamDisconnect({
					intentionalClose: intentionalProfilerDisconnect,
					readyState: source.readyState
				})
			) {
				return;
			}
			console.error('Profiler event stream disconnected', threadId);
		};

		profilerEvents = source;
		subscribedThreadId = threadId;
	}

	async function flushPendingDiscovery(threadId: string) {
		try {
			await fetch(`/api/chat/threads/${threadId}/flush`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ agentId: defaultAgentId })
			});
		} catch (error) {
			console.error('Failed to flush discovery thread', error);
		}
	}

	$effect(() => {
		if (!discoveryThreadId) return;
		connectProfilerEvents(discoveryThreadId);

		return () => {
			disconnectProfilerEvents();
		};
	});

	$effect(() => {
		const nextTab = activeTab;
		if (previousTab === 'discover' && nextTab !== 'discover' && discoveryThreadId) {
			void flushPendingDiscovery(discoveryThreadId);
		}
		previousTab = nextTab;
	});
</script>

<div class="w-full px-4 py-2">
	<div class="w-full">
		<div class="flex w-full items-center gap-4 overflow-x-auto" role="tablist" aria-label="Memory sections">
			{#each memoryTabs as tab}
				<Button
					variant="ghost"
					type="button"
					role="tab"
					aria-selected={activeTab === tab.value}
					tabindex={activeTab === tab.value ? 0 : -1}
					onclick={() => (activeTab = tab.value)}
					class={cn(
						'relative h-auto rounded-none px-0 pb-2 text-[11px] font-medium tracking-[0.01em] text-[#73819A] hover:bg-transparent md:text-sm',
						activeTab === tab.value && 'text-[#2F3C4F]'
					)}
				>
					<tab.icon class="mr-2 size-3.5" />
					<span>{tab.label}</span>
					<span
						aria-hidden="true"
						class="absolute inset-x-0 -bottom-px h-0.5 origin-center rounded-full bg-[#2F3C4F] transition-transform duration-300 ease-out"
						class:scale-x-100={activeTab === tab.value}
						class:scale-x-0={activeTab !== tab.value}
					></span>
				</Button>
			{/each}
		</div>
		<Separator class="bg-[#D7DCE5]" />
	</div>

	{#if activeTab === 'discover'}
		<DiscoverTab
			profile={currentProfile}
			{defaultAgentId}
			onThreadReady={(threadId) => {
				discoveryThreadId = threadId;
			}}
			onOpenProfile={() => (activeTab = 'profile')}
		/>
	{:else if activeTab === 'profile'}
		<ProfileTab
			profile={currentProfile}
			onOpenDiscover={() => (activeTab = 'discover')}
			onOpenDocument={() => (activeTab = 'document')}
			onOpenMemory={() => (activeTab = 'memory')}
		/>
	{:else if activeTab === 'document'}
		<div class="mt-6">
			<MemorySurfaceCard class="border-white/80 bg-white/78 p-6 backdrop-blur-sm">
				<ProfileDocumentTab profile={currentProfile} isActive={activeTab === 'document'} />
			</MemorySurfaceCard>
		</div>
	{:else}
		<div class="mt-6 flex flex-col gap-4">
			<MemorySurfaceCard class="border-white/80 bg-white/78 p-6 backdrop-blur-sm">
				<MemoryGraph nodes={currentGraph.nodes} edges={currentGraph.edges} stats={currentGraph.stats} />
			</MemorySurfaceCard>
			<MemorySurfaceCard class="border-white/80 bg-white/78 p-6 backdrop-blur-sm">
				<FilesList files={files.files} totalItems={files.totalItems} />
			</MemorySurfaceCard>
		</div>
	{/if}
</div>