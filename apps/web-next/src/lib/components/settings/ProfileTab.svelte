<script lang="ts">
	import { Compass, User, FileText, Network } from '@lucide/svelte';
	import * as Tabs from '$lib/components/shadcn/tabs/index.js';
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

<div class="space-y-4">
	<Tabs.Root bind:value={activeTab}>
		<div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
			<div class="w-full overflow-x-auto sm:w-auto">
				<Tabs.List>
					<Tabs.Trigger value="discover" class="gap-1.5">
						<Compass class="size-3.5" />
						Discover
					</Tabs.Trigger>
					<Tabs.Trigger value="profile" class="gap-1.5">
						<User class="size-3.5" />
						Profile
					</Tabs.Trigger>
					<Tabs.Trigger value="document" class="gap-1.5">
						<FileText class="size-3.5" />
						Document
					</Tabs.Trigger>
					<Tabs.Trigger value="memory" class="gap-1.5">
						<Network class="size-3.5" />
						Memory
					</Tabs.Trigger>
				</Tabs.List>
			</div>

			{#if currentProfile.sections.length > 0}
				<div class="hidden items-center gap-3 sm:flex">
					<!-- <span class="text-xs text-muted-foreground">
						{currentProfile.filledFields}/{currentProfile.totalFields} fields
					</span> -->
					<div class="w-24">
						<ProfileCompletionBar
							value={currentProfile.filledFields}
							max={currentProfile.totalFields}
						/>
					</div>
				</div>
			{/if}
		</div>

		<Tabs.Content value="discover">
			<ProfileDiscoverTab
				profile={currentProfile}
				{defaultAgentId}
				onThreadReady={(threadId) => {
					discoveryThreadId = threadId;
				}}
			/>
		</Tabs.Content>

		<Tabs.Content value="profile">
			{#if currentProfile.sections.length === 0}
				<div class="rounded-lg border border-border/30 bg-card/40 backdrop-blur">
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<User class="mb-3 size-8 text-muted-foreground/30" />
						<h3 class="mb-1 text-sm font-medium text-foreground">No profile data yet</h3>
						<p class="max-w-xs text-xs text-muted-foreground">
							Head over to the Discover tab and chat with the AI to start building your profile.
						</p>
					</div>
				</div>
			{:else}
				<ProfileStats profile={currentProfile} />
				<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
					{#each currentProfile.sections as section (section.sectionId)}
						<ProfileSectionCard {section} />
					{/each}
				</div>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="document">
			<ProfileDocumentTab profile={currentProfile} isActive={activeTab === 'document'} />
		</Tabs.Content>

		<Tabs.Content value="memory">
			<MemoryGraph
				nodes={currentGraph.nodes}
				edges={currentGraph.edges}
				stats={currentGraph.stats}
			/>
			<div class="mt-6">
				<FilesList files={files.files} totalItems={files.totalItems} />
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>
