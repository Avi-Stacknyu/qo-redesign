<script lang="ts">
	import { X, Eye, EyeOff, Trash2 } from '@lucide/svelte';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Switch } from '$lib/components/shadcn/switch/index.js';
	import { Label } from '$lib/components/shadcn/label/index.js';
	import { ScrollArea } from '$lib/components/shadcn/scroll-area/index.js';
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog/index.js';
	import { toast } from 'svelte-sonner';
	import {
		toggleNodeHidden,
		toggleShareWithManager,
		deleteMemoryNode
	} from '$lib/remote/memory.remote';
	import type { GraphNode } from '$lib/remote/memory.remote';

	let {
		node,
		links,
		onClose,
		onNodeDeleted,
		getNodeColor,
		getNodeLabel
	}: {
		node: GraphNode & { x?: number; y?: number };
		links: Array<{ source: { id: string }; target: { id: string }; relationship: string }>;
		onClose: () => void;
		onNodeDeleted: (id: string) => void;
		getNodeColor: (type: string) => string;
		getNodeLabel: (node: { data: Record<string, unknown>; type: string }) => string;
	} = $props();

	let isTogglingHidden = $state(false);
	let isTogglingShare = $state(false);
	let isDeletingNode = $state(false);
	let deleteDialogOpen = $state(false);

	// Derived from node prop so they update when node changes
	let hiddenFromAgent = $derived(!!node.data?.hidden_from_agent);
	let shareWithMgr = $derived(!!node.data?.share_with_manager);

	function getFullText(n: GraphNode): string {
		return String(n.data.text || n.data.summary || n.data.name || n.data.title || '');
	}

	function formatDate(dateStr?: string): string {
		if (!dateStr) return 'N/A';
		return new Date(dateStr).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function handleToggleHidden(hidden: boolean) {
		isTogglingHidden = true;
		try {
			await toggleNodeHidden({ nodeId: node.id, hidden });
			node.data = { ...node.data, hidden_from_agent: hidden };
			toast.success(hidden ? 'Node hidden from agent' : 'Node visible to agent');
		} catch {
			toast.error('Failed to update node visibility');
		} finally {
			isTogglingHidden = false;
		}
	}

	async function handleToggleShare(share: boolean) {
		isTogglingShare = true;
		try {
			await toggleShareWithManager({ nodeId: node.id, shareWithManager: share });
			node.data = { ...node.data, share_with_manager: share };
			toast.success(share ? 'Memory shared with manager' : 'Memory hidden from manager');
		} catch {
			toast.error('Failed to update sharing settings');
		} finally {
			isTogglingShare = false;
		}
	}

	async function handleDelete() {
		isDeletingNode = true;
		try {
			await deleteMemoryNode({ nodeId: node.id });
			deleteDialogOpen = false;
			toast.success('Memory deleted successfully');
			onNodeDeleted(node.id);
		} catch {
			toast.error('Failed to delete memory');
		} finally {
			isDeletingNode = false;
		}
	}

	let incomingEdges = $derived(links.filter((l) => l.target.id === node.id));
	let outgoingEdges = $derived(links.filter((l) => l.source.id === node.id));
</script>

<div class="absolute inset-0 z-20 border-l bg-card sm:static sm:inset-auto sm:z-auto sm:w-72">
	<div class="flex items-center justify-between border-b p-3">
		<div class="flex items-center gap-2">
			<div class="size-3 rounded-full" style="background-color: {getNodeColor(node.type)}"></div>
			<span class="text-sm font-medium">{node.type}</span>
			{#if hiddenFromAgent}
				<Badge variant="secondary" class="text-[10px]">Hidden</Badge>
			{/if}
		</div>
		<Button variant="ghost" size="icon" class="size-6" onclick={onClose}>
			<X class="size-4" />
		</Button>
	</div>
	<ScrollArea class="h-148">
		<div class="space-y-3 p-3 text-sm">
			<div>
				<div class="text-xs font-medium text-muted-foreground">Label</div>
				<div class="font-medium">{getNodeLabel(node)}</div>
			</div>

			{#if getFullText(node)}
				<div>
					<div class="text-xs font-medium text-muted-foreground">Content</div>
					<div class="rounded bg-muted p-2 text-xs whitespace-pre-wrap">{getFullText(node)}</div>
				</div>
			{/if}

			{#if node.confidence != null}
				<div>
					<div class="text-xs font-medium text-muted-foreground">Confidence</div>
					<div class="flex items-center gap-2">
						<div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
							<div
								class="h-full bg-primary transition-all"
								style="width: {node.confidence * 100}%"
							></div>
						</div>
						<span class="text-xs">{(node.confidence * 100).toFixed(0)}%</span>
					</div>
				</div>
			{/if}

			{#if node.data?.category}
				<div>
					<div class="text-xs font-medium text-muted-foreground">Category</div>
					<Badge variant="outline">{node.data.category}</Badge>
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-2 border-t pt-2">
				<div>
					<div class="text-xs font-medium text-muted-foreground">Created</div>
					<div class="text-xs">{formatDate(node.createdAt)}</div>
				</div>
				<div>
					<div class="text-xs font-medium text-muted-foreground">Updated</div>
					<div class="text-xs">{formatDate(node.updatedAt)}</div>
				</div>
			</div>

			<!-- Agent Visibility Control -->
			<div class="border-t pt-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						{#if hiddenFromAgent}<EyeOff class="size-4 text-muted-foreground" />{:else}<Eye
								class="size-4 text-primary"
							/>{/if}
						<Label for="hide-from-agent" class="text-xs font-medium">Hide from Agent</Label>
					</div>
					<Switch
						id="hide-from-agent"
						checked={hiddenFromAgent}
						disabled={isTogglingHidden}
						onCheckedChange={(checked) => handleToggleHidden(checked)}
					/>
				</div>
				<p class="mt-1 text-[10px] text-muted-foreground">
					Hidden memories won't be used by the AI
				</p>
			</div>

			<!-- Share with Manager Control -->
			<div class="border-t pt-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						{#if shareWithMgr}<Eye class="size-4 text-primary" />{:else}<EyeOff
								class="size-4 text-muted-foreground"
							/>{/if}
						<Label for="share-with-manager" class="text-xs font-medium">Share with Manager</Label>
					</div>
					<Switch
						id="share-with-manager"
						checked={shareWithMgr}
						disabled={isTogglingShare}
						onCheckedChange={(checked) => handleToggleShare(checked)}
					/>
				</div>
				<p class="mt-1 text-[10px] text-muted-foreground">Allow your advisor to see this memory</p>
			</div>

			<!-- Delete -->
			<div class="border-t pt-2">
				<Button
					variant="destructive"
					size="sm"
					class="w-full"
					onclick={() => (deleteDialogOpen = true)}
				>
					<Trash2 class="mr-2 size-3" /> Delete Memory
				</Button>
			</div>

			<!-- Connections -->
			{#if incomingEdges.length > 0 || outgoingEdges.length > 0}
				<div class="border-t pt-2">
					<div class="mb-2 text-xs font-medium text-muted-foreground">Connections</div>
					{#if incomingEdges.length > 0}
						<div class="mb-2">
							<div class="mb-1 text-[10px] text-muted-foreground">
								Incoming ({incomingEdges.length})
							</div>
							{#each incomingEdges.slice(0, 3) as edge}
								<div class="mb-0.5 flex items-center gap-1 text-xs">
									<span class="text-muted-foreground">&larr;</span>
									<Badge variant="outline" class="px-1 py-0 text-[10px]">{edge.relationship}</Badge>
									<span
										>{getNodeLabel(
											edge.source as unknown as { data: Record<string, unknown>; type: string }
										)}</span
									>
								</div>
							{/each}
							{#if incomingEdges.length > 3}
								<div class="text-[10px] text-muted-foreground">
									+{incomingEdges.length - 3} more
								</div>
							{/if}
						</div>
					{/if}
					{#if outgoingEdges.length > 0}
						<div>
							<div class="mb-1 text-[10px] text-muted-foreground">
								Outgoing ({outgoingEdges.length})
							</div>
							{#each outgoingEdges.slice(0, 3) as edge}
								<div class="mb-0.5 flex items-center gap-1 text-xs">
									<span class="text-muted-foreground">&rarr;</span>
									<Badge variant="outline" class="px-1 py-0 text-[10px]">{edge.relationship}</Badge>
									<span
										>{getNodeLabel(
											edge.target as unknown as { data: Record<string, unknown>; type: string }
										)}</span
									>
								</div>
							{/each}
							{#if outgoingEdges.length > 3}
								<div class="text-[10px] text-muted-foreground">
									+{outgoingEdges.length - 3} more
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</ScrollArea>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Memory?</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this memory? This action cannot be undone and will also
				remove all connections to this memory.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)} disabled={isDeletingNode}
				>Cancel</Button
			>
			<Button variant="destructive" onclick={handleDelete} disabled={isDeletingNode}>
				{isDeletingNode ? 'Deleting...' : 'Delete'}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
