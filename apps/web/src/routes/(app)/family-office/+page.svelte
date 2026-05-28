<script lang="ts">
	import {
		SvelteFlow,
		Controls,
		Background,
		MiniMap,
		addEdge,
		type Node,
		type Edge,
		type NodeTypes,
		type Connection
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import {
		getFamilyMembers,
		addFamilyMember,
		updateFamilyMember,
		updateMemberPosition,
		deleteFamilyMember
	} from '$lib/remote/family-office.remote';
	import { Users, UserPlus, LayoutGrid } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { browser } from '$app/environment';
	import FamilyFlowNode from './FamilyFlowNode.svelte';
	import AddMemberForm from './AddMemberForm.svelte';
	import MemberEditDialog from './MemberEditDialog.svelte';
	import { layoutHierarchical } from './layout-utils';

	const nodeTypes: NodeTypes = { family: FamilyFlowNode } as unknown as NodeTypes;

	const membersQuery = getFamilyMembers();
	const members = $derived(membersQuery.current ?? []);

	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);
	let isInitialized = $state(false);

	let showAddForm = $state(false);
	let isAdding = $state(false);

	let editMemberId = $state<string | null>(null);
	let editDialogOpen = $state(false);

	let deleteTarget = $state<{ id: string; name: string } | null>(null);
	let deleteDialogOpen = $state(false);
	let isDeleting = $state(false);

	function openAddForm() {
		showAddForm = true;
	}

	function openEditDialog(id: string) {
		editMemberId = id;
		editDialogOpen = true;
	}

	function promptDelete(id: string, name: string) {
		deleteTarget = { id, name };
		deleteDialogOpen = true;
	}

	/** Build nodes + edges from member data using hierarchical layout */
	function buildGraph(memberList: typeof members) {
		if (!memberList.length) {
			nodes = [];
			edges = [];
			return;
		}

		const hasPositions = memberList.some(
			(m) => Number(m.positionX) !== 0 || Number(m.positionY) !== 0
		);

		let positions: Map<string, { x: number; y: number }>;

		if (hasPositions) {
			positions = new Map(
				memberList.map((m) => [m.id, { x: Number(m.positionX) || 0, y: Number(m.positionY) || 0 }])
			);
		} else {
			positions = layoutHierarchical(memberList);
		}

		nodes = memberList.map((m) => ({
			id: m.id,
			type: 'family',
			position: positions.get(m.id) ?? { x: 0, y: 0 },
			data: {
				...m,
				onEdit: openEditDialog,
				onDelete: promptDelete
			},
			dragHandle: '.drag-handle'
		}));

		edges = memberList
			.filter((m) => m.parentId && memberList.some((p) => p.id === m.parentId))
			.map((m) => ({
				id: `e-${m.parentId}-${m.id}`,
				source: m.parentId!,
				target: m.id,
				type: 'smoothstep',
				animated: false,
				style: 'stroke: oklch(var(--primary)); stroke-width: 2;'
			}));
	}

	$effect(() => {
		if (browser && members) {
			buildGraph(members);
			if (!isInitialized) isInitialized = true;
		}
	});

	async function handleNodeDragStop(event: {
		targetNode: Node | null;
		nodes: Node[];
		event: MouseEvent | TouchEvent;
	}) {
		const node = event.targetNode;
		if (!node?.id || !node.position) return;

		try {
			await updateMemberPosition({
				id: node.id,
				position_x: Math.round(node.position.x),
				position_y: Math.round(node.position.y)
			});
		} catch {
			toast.error('Failed to save position');
		}
	}

	async function handleAdd(data: {
		name: string;
		role?: string;
		email?: string;
		responsibilities: string[];
	}) {
		isAdding = true;
		try {
			await addFamilyMember(data).updates(getFamilyMembers());
			toast.success('Member added');
			showAddForm = false;
		} catch {
			toast.error('Failed to add member');
		} finally {
			isAdding = false;
		}
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		isDeleting = true;
		try {
			await deleteFamilyMember({ id: deleteTarget.id }).updates(getFamilyMembers());
			toast.success('Member removed');
			deleteDialogOpen = false;
			deleteTarget = null;
		} catch {
			toast.error('Failed to remove member');
		} finally {
			isDeleting = false;
		}
	}

	/** Handle new connections drawn between nodes — update parentId */
	async function handleConnect(connection: Connection) {
		if (!connection.source || !connection.target) return;
		// Prevent self-connections
		if (connection.source === connection.target) return;

		try {
			await updateFamilyMember({
				id: connection.target,
				parent_id: connection.source
			}).updates(getFamilyMembers());

			edges = addEdge(
				{
					...connection,
					id: `e-${connection.source}-${connection.target}`,
					type: 'smoothstep',
					style: 'stroke: oklch(var(--primary)); stroke-width: 2;'
				},
				edges
			);
			toast.success('Connection created');
		} catch {
			toast.error('Failed to connect members');
		}
	}

	function autoLayout() {
		const positions = layoutHierarchical(members);
		nodes = nodes.map((n) => ({
			...n,
			position: positions.get(n.id) ?? n.position
		}));
		for (const m of members) {
			const pos = positions.get(m.id);
			if (pos) {
				updateMemberPosition({
					id: m.id,
					position_x: Math.round(pos.x),
					position_y: Math.round(pos.y)
				}).catch(() => {});
			}
		}
		toast.success('Layout reorganized');
	}
</script>

<svelte:head>
	<title>Family Office — Quant Orion</title>
</svelte:head>

<div class="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
	<!-- Header -->
	<div class="flex items-end justify-between">
		<div class="space-y-1">
			<h1 class="text-3xl font-light tracking-tight text-foreground lg:text-4xl">Family Office</h1>
			<p class="text-sm text-muted-foreground">
				Drag nodes to rearrange. Hover cards to edit or connect members.
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if members.length > 0}
				<Button size="sm" variant="outline" class="gap-1.5 text-xs" onclick={autoLayout}>
					<LayoutGrid class="size-3.5" />
					Auto Layout
				</Button>
			{/if}
			<Button size="sm" class="gap-1.5 text-xs" onclick={() => openAddForm()}>
				<UserPlus class="size-3.5" />
				Add Member
			</Button>
		</div>
	</div>

	<!-- Add Form (collapsible above canvas) -->
	{#if showAddForm}
		<AddMemberForm
			onsubmit={handleAdd}
			onclose={() => (showAddForm = false)}
			isSubmitting={isAdding}
		/>
	{/if}

	<!-- Flow Canvas -->
	{#if members.length === 0 && !showAddForm}
		<div class="rounded-xl border border-border/30 bg-card/40 backdrop-blur">
			<div class="flex flex-col items-center justify-center py-24 text-center">
				<div class="flex size-14 items-center justify-center rounded-full bg-primary/10">
					<Users class="size-7 text-primary" />
				</div>
				<h3 class="mt-4 text-base font-medium text-foreground">No family members yet</h3>
				<p class="mt-1 max-w-sm text-sm text-muted-foreground">
					Start building your family office structure by adding the first member.
				</p>
				<Button size="sm" class="mt-5 gap-1.5" onclick={() => openAddForm()}>
					<UserPlus class="size-3.5" />
					Add First Member
				</Button>
			</div>
		</div>
	{:else if browser && isInitialized}
		<div
			class="h-[calc(100vh-16rem)] min-h-125 overflow-hidden rounded-xl border border-border/30 bg-card/20"
		>
			<SvelteFlow
				bind:nodes
				bind:edges
				{nodeTypes}
				fitView
				minZoom={0.2}
				maxZoom={2}
				onnodedragstop={handleNodeDragStop}
				onconnect={handleConnect}
				connectionLineStyle="stroke: oklch(var(--primary)); stroke-width: 2;"
			>
				<Controls class="rounded-lg! border-border/40! bg-card/90! shadow-sm! backdrop-blur!" />
				<Background class="opacity-30!" />
				<MiniMap
					nodeStrokeWidth={3}
					pannable
					zoomable
					class="rounded-lg! border-border/40! bg-card/80!"
				/>
			</SvelteFlow>
		</div>
	{:else}
		<div
			class="flex h-96 items-center justify-center rounded-xl border border-border/30 bg-card/40"
		>
			<p class="text-sm text-muted-foreground">Loading graph…</p>
		</div>
	{/if}
</div>

<!-- Edit Dialog -->
{#if editMemberId}
	<MemberEditDialog
		bind:open={editDialogOpen}
		memberId={editMemberId}
		{members}
		onclose={() => {
			editDialogOpen = false;
			editMemberId = null;
		}}
	/>
{/if}

<!-- Delete Confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Remove Member?</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to remove <strong>{deleteTarget?.name}</strong>? Any sub-members will
				become unlinked. This cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)} disabled={isDeleting}>
				Cancel
			</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={isDeleting}>
				{isDeleting ? 'Removing…' : 'Remove'}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<style>
	:global(.svelte-flow) {
		background-color: oklch(var(--card) / 0.2);
	}
	:global(.svelte-flow__background pattern) {
		color: oklch(var(--border) / 0.4);
	}
	/* Handles — always visible, interactive, themed */
	:global(.svelte-flow__handle) {
		width: 14px !important;
		height: 14px !important;
		background: oklch(var(--background)) !important;
		border: 2px solid oklch(var(--primary)) !important;
		border-radius: 50% !important;
		pointer-events: all !important;
		cursor: crosshair !important;
		z-index: 10 !important;
		opacity: 1 !important;
		transition:
			box-shadow 0.15s ease,
			border-color 0.15s ease;
	}
	:global(.svelte-flow__handle:hover) {
		background: oklch(var(--primary) / 0.15) !important;
		border-color: oklch(var(--primary)) !important;
		box-shadow: 0 0 0 4px oklch(var(--primary) / 0.2);
	}
	:global(.svelte-flow__minimap) {
		background: oklch(var(--card));
		border: 1px solid oklch(var(--border) / 0.4);
		border-radius: 0.5rem;
	}
	:global(.svelte-flow__controls) {
		background: oklch(var(--card));
		border: 1px solid oklch(var(--border) / 0.4);
		border-radius: 0.5rem;
	}
	:global(.svelte-flow__controls button) {
		background: transparent;
		border-bottom-color: oklch(var(--border) / 0.2);
		color: oklch(var(--foreground));
	}
	:global(.svelte-flow__controls button:hover) {
		background: oklch(var(--muted));
	}
	:global(.svelte-flow__controls button svg) {
		fill: oklch(var(--foreground));
	}
</style>
