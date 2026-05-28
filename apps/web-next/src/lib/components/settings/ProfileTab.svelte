<script lang="ts">
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { cn } from '$lib/utils';
	import { Compass, User, FileText, Network } from '@lucide/svelte';
	import ProfileStats from '$lib/components/profile/ProfileStats.svelte';
	import ProfileSectionCard from '$lib/components/profile/ProfileSectionCard.svelte';
	import ProfileDiscoverTab from '$lib/components/profile/ProfileDiscoverTab.svelte';
	import ProfileDocumentTab from '$lib/components/profile/ProfileDocumentTab.svelte';
	import ProfileCompletionBar from '$lib/components/profile/ProfileCompletionBar.svelte';
	import MemoryGraph from '$lib/components/memory/MemoryGraph.svelte';
	import FilesList from '$lib/components/memory/FilesList.svelte';
	import type { ProfileData } from '$lib/data/profile-types';
	import { shouldLogProfilerStreamDisconnect } from '$lib/data/profile-ui';
	import { loadStructuredProfile } from '$lib/remote/profile-data.remote';
	import { loadGraphMemory, type GraphData, type FilesData } from '$lib/remote/memory.remote';

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

	let activeTab = $state('discover');
	let discoveryThreadId = $state<string | null>(null);
	let profileQuery = loadStructuredProfile();
	let graphQuery = loadGraphMemory();
	let currentProfile = $derived(profileQuery.current ?? profile);
	let currentGraph = $derived(graphQuery.current ?? graph);
	let profilerEvents: EventSource | null = null;
	let subscribedThreadId: string | null = null;
	let intentionalProfilerDisconnect = false;
	let previousTab = 'discover';

	const memoryTabs = [
		{ value: 'discover', label: 'Discover', icon: Compass },
		{ value: 'profile', label: 'Profile', icon: User },
		{ value: 'document', label: 'Document', icon: FileText },
		{ value: 'memory', label: 'Memory', icon: Network }
	] as const;

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
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex w-full items-center gap-4 overflow-x-auto" role="tablist" aria-label="Memory sections">
				{#each memoryTabs as tab (tab.value)}
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === tab.value}
						tabindex={activeTab === tab.value ? 0 : -1}
						onclick={() => (activeTab = tab.value)}
						class={cn(
							'relative flex h-auto items-center gap-2 rounded-none px-0 pb-2 text-[11px] font-medium tracking-[0.01em] text-[#73819A] hover:bg-transparent md:text-sm',
							activeTab === tab.value && 'text-[#2F3C4F]'
						)}
					>
						<tab.icon class="size-3.5" />
						<span>{tab.label}</span>
						<span
							aria-hidden="true"
							class="absolute inset-x-0 -bottom-px h-0.5 origin-center rounded-full bg-[#2F3C4F] transition-transform duration-300 ease-out"
							class:scale-x-100={activeTab === tab.value}
							class:scale-x-0={activeTab !== tab.value}
						></span>
					</button>
				{/each}
			</div>

			{#if currentProfile.sections.length > 0}
				<div class="hidden items-center gap-3 sm:flex">
					<div class="w-24">
						<ProfileCompletionBar value={currentProfile.filledFields} max={currentProfile.totalFields} />
					</div>
				</div>
			{/if}
		</div>
		<Separator class="bg-[#D7DCE5]" />
	</div>

	{#if activeTab === 'discover'}
		<div class="mt-6">
			<ProfileDiscoverTab
				profile={currentProfile}
				{defaultAgentId}
				onThreadReady={(threadId) => {
					discoveryThreadId = threadId;
				}}
			/>
		</div>
	{:else if activeTab === 'profile'}
		<div class="mt-6">
			{#if currentProfile.sections.length === 0}
				<div class="rounded-[28px] border border-white/80 bg-white/78 p-6 text-center shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
					<User class="mx-auto mb-3 size-8 text-muted-foreground/30" />
					<h3 class="mb-1 text-sm font-medium text-foreground">No profile data yet</h3>
					<p class="mx-auto max-w-xs text-xs text-muted-foreground">
						Head over to the Discover tab and chat with the AI to start building your profile.
					</p>
				</div>
			{:else}
				<ProfileStats profile={currentProfile} />
				<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
					{#each currentProfile.sections as section (section.sectionId)}
						<ProfileSectionCard {section} />
					{/each}
				</div>
			{/if}
		</div>
	{:else if activeTab === 'document'}
		<div class="mt-6 rounded-[28px] border border-white/80 bg-white/78 p-6 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
			<ProfileDocumentTab profile={currentProfile} isActive={activeTab === 'document'} />
		</div>
	{:else}
		<div class="mt-6 space-y-6 rounded-[28px] border border-white/80 bg-white/78 p-6 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
			<MemoryGraph nodes={currentGraph.nodes} edges={currentGraph.edges} stats={currentGraph.stats} />
			<div>
				<FilesList files={files.files} totalItems={files.totalItems} />
			</div>
		</div>
	{/if}
</div>
