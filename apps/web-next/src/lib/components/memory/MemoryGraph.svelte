<script lang="ts">
	import { onMount } from 'svelte';
	import { ZoomIn, ZoomOut, Maximize2, Eye, EyeOff } from '@lucide/svelte';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import type { GraphNode, GraphEdge, GraphStats } from '$lib/remote/memory.remote';
	import { getNodeColor, getEdgeColor, getNodeLabel } from '$lib/data/graph-colors';
	import MemoryGraphDetail from './MemoryGraphDetail.svelte';
	let {
		nodes: rawNodes,
		edges,
		stats
	}: { nodes: GraphNode[]; edges: GraphEdge[]; stats: GraphStats } = $props();

	// Filter out INTENT nodes — intent is an edge type (HAS_INTENT), not a node type
	const nodes = $derived(rawNodes.filter((n) => n.type !== 'INTENT'));

	type SimNode = GraphNode & {
		x?: number;
		y?: number;
		vx?: number;
		vy?: number;
		fx?: number | null;
		fy?: number | null;
	};
	type SimLink = { source: SimNode; target: SimNode; relationship: string };

	let containerEl: HTMLDivElement | undefined = $state();
	let svgEl: SVGSVGElement | undefined = $state();
	let width = $state(800),
		height = $state(400);
	let simulatedNodes = $state<SimNode[]>([]);
	let simulatedLinks = $state<SimLink[]>([]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let simulation: any = null;
	let nodesRef: SimNode[] = [];
	const nodeRadius = 8;

	let transform = $state({ x: 0, y: 0, k: 1 });
	let draggedNode = $state<SimNode | null>(null);
	let isDragging = $state(false);
	let dragStartPos = { x: 0, y: 0 };
	let isPanning = $state(false);
	let panStart = { x: 0, y: 0 };
	let tooltipNode = $state<SimNode | null>(null);
	let tooltipX = $state(0),
		tooltipY = $state(0);
	let selectedNode = $state<SimNode | null>(null);
	let hoveredEdge = $state<SimLink | null>(null);
	let edgeTooltipX = $state(0),
		edgeTooltipY = $state(0);
	let showEdgeLabels = $state(true),
		showNodeLabels = $state(true),
		highlightConnections = $state(true);
	const nodeTypes = $derived([...new Set(nodes.map((n) => n.type))]);

	const connectedNodeIds = $derived.by(() => {
		if (!selectedNode || !highlightConnections) return new Set<string>();
		const ids = new Set<string>([selectedNode.id]);
		for (const l of simulatedLinks) {
			if (l.source.id === selectedNode.id) ids.add(l.target.id);
			if (l.target.id === selectedNode.id) ids.add(l.source.id);
		}
		return ids;
	});
	const connectedEdges = $derived.by(() => {
		if (!selectedNode || !highlightConnections) return new Set<string>();
		const keys = new Set<string>();
		for (const l of simulatedLinks) {
			if (l.source.id === selectedNode.id || l.target.id === selectedNode.id)
				keys.add(`${l.source.id}-${l.relationship}-${l.target.id}`);
		}
		return keys;
	});

	async function initSimulation() {
		if (!nodes.length) return;
		// @ts-ignore d3 types hoisted to monorepo root
		const d3 = await import('d3');
		nodesRef = nodes.map((n) => ({ ...n, x: Math.random() * width, y: Math.random() * height }));
		const nodeMap = new Map(nodesRef.map((n) => [n.id, n]));
		const links = edges
			.map((e) => ({
				source: nodeMap.get(
					typeof e.source === 'string' ? e.source : (e.source as unknown as SimNode).id
				),
				target: nodeMap.get(
					typeof e.target === 'string' ? e.target : (e.target as unknown as SimNode).id
				),
				relationship: e.relationship
			}))
			.filter((l): l is SimLink => !!l.source && !!l.target);
		if (simulation) simulation.stop();
		simulation = d3
			.forceSimulation(nodesRef)
			.force(
				'link',
				d3
					.forceLink(links)
					.id((d: any) => d.id)
					.distance(80)
			)
			.force('charge', d3.forceManyBody().strength(-100))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collision', d3.forceCollide().radius(nodeRadius + 5))
			.on('tick', () => {
				simulatedNodes = [...nodesRef];
				simulatedLinks = [...links];
			});
	}

	function zoomIn() {
		transform = { ...transform, k: Math.min(transform.k * 1.2, 4) };
	}
	function zoomOut() {
		transform = { ...transform, k: Math.max(transform.k / 1.2, 0.25) };
	}
	function resetZoom() {
		transform = { x: 0, y: 0, k: 1 };
	}

	function handleNodeMouseDown(e: MouseEvent, node: SimNode) {
		e.preventDefault();
		e.stopPropagation();
		draggedNode = node;
		isDragging = true;
		dragStartPos = { x: e.clientX, y: e.clientY };
		node.fx = node.x;
		node.fy = node.y;
	}

	function handleMouseMove(e: MouseEvent) {
		if (isDragging && draggedNode) {
			const dx = (e.clientX - dragStartPos.x) / transform.k;
			const dy = (e.clientY - dragStartPos.y) / transform.k;
			draggedNode.fx = (draggedNode.fx || 0) + dx;
			draggedNode.fy = (draggedNode.fy || 0) + dy;
			dragStartPos = { x: e.clientX, y: e.clientY };
			simulation?.alpha(0.3).restart();
		} else if (isPanning) {
			transform = {
				...transform,
				x: transform.x + (e.clientX - panStart.x),
				y: transform.y + (e.clientY - panStart.y)
			};
			panStart = { x: e.clientX, y: e.clientY };
		}
	}

	function handleMouseUp() {
		if (draggedNode) {
			draggedNode.fx = null;
			draggedNode.fy = null;
		}
		draggedNode = null;
		isDragging = false;
		isPanning = false;
	}

	function handleBgMouseDown(e: MouseEvent) {
		if (e.target === svgEl || (e.target as Element).tagName === 'rect') {
			isPanning = true;
			panStart = { x: e.clientX, y: e.clientY };
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		transform = {
			...transform,
			k: Math.max(0.25, Math.min(4, transform.k * (e.deltaY > 0 ? 0.9 : 1.1)))
		};
	}

	function handleNodeClick(e: MouseEvent, node: SimNode) {
		e.stopPropagation();
		selectedNode = selectedNode?.id === node.id ? null : node;
	}

	function handleNodeDeleted(id: string) {
		simulatedNodes = simulatedNodes.filter((n) => n.id !== id);
		simulatedLinks = simulatedLinks.filter((l) => l.source.id !== id && l.target.id !== id);
		selectedNode = null;
	}

	onMount(() => {
		if (containerEl) {
			const rect = containerEl.getBoundingClientRect();
			width = rect.width || 800;
			height = Math.max(rect.height, 640);
			const ro = new ResizeObserver(() => {
				const r = containerEl!.getBoundingClientRect();
				width = r.width || 800;
				height = Math.max(r.height, 640);
			});
			ro.observe(containerEl);
			return () => {
				ro.disconnect();
				simulation?.stop();
			};
		}
	});
	$effect(() => {
		if (nodes.length) initSimulation();
	});
</script>

<Card.Root class="overflow-hidden">
	<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
		<div class="space-y-1">
			<Card.Title class="text-base font-semibold">Memory Graph</Card.Title>
			<Card.Description class="text-xs">Visualize how your memories are connected</Card.Description>
		</div>
		<div class="flex items-center gap-1">
			<Badge variant="secondary" class="text-xs">{stats.nodeCount} nodes</Badge>
			<Badge variant="outline" class="text-xs">{stats.edgeCount} edges</Badge>
		</div>
	</Card.Header>
	<Card.Content class="p-0">
		{#if !nodes.length}
			<div class="flex h-160 flex-col items-center justify-center p-8 text-center">
				<div class="mb-4 rounded-full bg-muted p-4">
					<Eye class="size-8 text-muted-foreground" />
				</div>
				<h3 class="mb-1 font-medium text-foreground">No graph data yet</h3>
				<p class="max-w-sm text-sm text-muted-foreground">
					Start chatting with the AI to build your memory graph.
				</p>
			</div>
		{:else}
			<div class="flex flex-col gap-2 border-b bg-muted/30 px-3 py-2 sm:px-4">
				<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
					<Button variant="outline" size="icon" class="size-7 sm:size-8" onclick={zoomIn}
						><ZoomIn class="size-3.5 sm:size-4" /></Button
					>
					<Button variant="outline" size="icon" class="size-7 sm:size-8" onclick={zoomOut}
						><ZoomOut class="size-3.5 sm:size-4" /></Button
					>
					<Button variant="outline" size="icon" class="size-7 sm:size-8" onclick={resetZoom}
						><Maximize2 class="size-3.5 sm:size-4" /></Button
					>
					<div class="h-5 w-px bg-border/40 max-sm:hidden"></div>
					<div class="flex flex-wrap items-center gap-1">
						<Button
							variant={showNodeLabels ? 'secondary' : 'ghost'}
							size="sm"
							class="h-6 px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs"
							onclick={() => (showNodeLabels = !showNodeLabels)}
						>
							{#if showNodeLabels}<Eye class="mr-0.5 size-3" />{:else}<EyeOff
									class="mr-0.5 size-3"
								/>{/if}Labels
						</Button>
						<Button
							variant={showEdgeLabels ? 'secondary' : 'ghost'}
							size="sm"
							class="h-6 px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs"
							onclick={() => (showEdgeLabels = !showEdgeLabels)}
						>
							{#if showEdgeLabels}<Eye class="mr-0.5 size-3" />{:else}<EyeOff
									class="mr-0.5 size-3"
								/>{/if}Edges
						</Button>
						<Button
							variant={highlightConnections ? 'secondary' : 'ghost'}
							size="sm"
							class="h-6 px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs"
							onclick={() => (highlightConnections = !highlightConnections)}>Highlight</Button
						>
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
					{#each nodeTypes.slice(0, 5) as type (type)}
						<div class="flex items-center gap-1">
							<div
								class="size-2.5 rounded-full sm:size-3"
								style="background-color: {getNodeColor(type)}"
							></div>
							<span class="text-[9px] text-muted-foreground sm:text-[10px]">{type}</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="relative flex">
				<div bind:this={containerEl} class="relative h-160 flex-1 overflow-hidden bg-background">
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<svg
						bind:this={svgEl}
						{width}
						{height}
						class="cursor-grab active:cursor-grabbing"
						onmousedown={handleBgMouseDown}
						onmousemove={handleMouseMove}
						onmouseup={handleMouseUp}
						onmouseleave={handleMouseUp}
						onwheel={handleWheel}
					>
						<defs
							><pattern id="dots" width="15" height="15" patternUnits="userSpaceOnUse"
								><circle
									cx="1"
									cy="1"
									r="1"
									fill="currentColor"
									class="text-muted-foreground/20"
								/></pattern
							></defs
						>
						<rect width="100%" height="100%" fill="url(#dots)" />

						<g transform="translate({transform.x}, {transform.y}) scale({transform.k})">
							{#each simulatedLinks as link}
								{@const sx = link.source.x ?? 0}{@const sy = link.source.y ?? 0}
								{@const tx = link.target.x ?? 0}{@const ty = link.target.y ?? 0}
								{@const edgeKey = `${link.source.id}-${link.relationship}-${link.target.id}`}
								{@const isHl = connectedEdges.has(edgeKey)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g
									class="cursor-pointer"
									onmouseenter={(e) => {
										hoveredEdge = link;
										edgeTooltipX = e.clientX;
										edgeTooltipY = e.clientY;
									}}
									onmouseleave={() => (hoveredEdge = null)}
								>
									<line
										x1={sx}
										y1={sy}
										x2={tx}
										y2={ty}
										stroke={getEdgeColor(link.relationship)}
										stroke-width={isHl ? 2 : 1}
										stroke-opacity={selectedNode ? (isHl ? 0.8 : 0.1) : 0.4}
									/>
									{#if showEdgeLabels}
										<text
											x={(sx + tx) / 2}
											y={(sy + ty) / 2}
											text-anchor="middle"
											dominant-baseline="middle"
											class="pointer-events-none fill-muted-foreground text-[8px]"
											opacity={selectedNode ? (isHl ? 1 : 0.2) : 0.6}>{link.relationship}</text
										>
									{/if}
								</g>
							{/each}

							{#each simulatedNodes as node (node.id)}
								{@const isSel = selectedNode?.id === node.id}{@const isCon = connectedNodeIds.has(
									node.id
								)}{@const isHidden = !!node.data?.hidden_from_agent}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<g
									class="cursor-pointer"
									onmousedown={(e) => handleNodeMouseDown(e, node)}
									onclick={(e) => handleNodeClick(e, node)}
									onmouseenter={(e) => {
										if (!isDragging) {
											tooltipNode = node;
											tooltipX = e.clientX;
											tooltipY = e.clientY;
										}
									}}
									onmouseleave={() => (tooltipNode = null)}
								>
									<circle
										cx={node.x}
										cy={node.y}
										r={isSel ? nodeRadius + 2 : nodeRadius}
										fill={getNodeColor(node.type)}
										stroke={isSel
											? 'hsl(var(--primary))'
											: isHidden
												? 'hsl(var(--muted-foreground))'
												: 'white'}
										stroke-width={isSel ? 3 : 2}
										opacity={selectedNode ? (isCon ? 1 : 0.3) : isHidden ? 0.5 : 1}
										stroke-dasharray={isHidden ? '3,3' : 'none'}
									/>
									{#if isHidden}
										<text
											x={node.x}
											y={node.y}
											text-anchor="middle"
											dominant-baseline="middle"
											class="pointer-events-none fill-white text-[8px] font-bold">H</text
										>
									{/if}
									{#if showNodeLabels}
										<text
											x={node.x}
											y={(node.y ?? 0) + nodeRadius + 12}
											text-anchor="middle"
											class="pointer-events-none fill-foreground text-[10px]"
											opacity={selectedNode ? (isCon ? 1 : 0.3) : 1}>{getNodeLabel(node)}</text
										>
									{/if}
								</g>
							{/each}
						</g>
					</svg>

					{#if tooltipNode && !isDragging}
						<div
							class="pointer-events-none absolute z-50 rounded-lg border bg-popover p-2 shadow-lg"
							style="left: {tooltipX + 15}px; top: {tooltipY - 10}px; transform: translateY(-100%);"
						>
							<div class="flex items-center gap-2">
								<div
									class="size-3 rounded-full"
									style="background-color: {getNodeColor(tooltipNode.type)}"
								></div>
								<span class="text-sm font-medium">{tooltipNode.type}</span>
								{#if tooltipNode.data?.hidden_from_agent}<Badge
										variant="secondary"
										class="text-[10px]">Hidden</Badge
									>{/if}
							</div>
							<p class="mt-1 line-clamp-2 max-w-xs text-xs text-muted-foreground">
								{String(
									tooltipNode.data.text || tooltipNode.data.summary || tooltipNode.data.name || ''
								)}
							</p>
						</div>
					{/if}
					{#if hoveredEdge}
						<div
							class="pointer-events-none absolute z-50 rounded-lg border bg-popover p-2 shadow-lg"
							style="left: {edgeTooltipX + 15}px; top: {edgeTooltipY -
								10}px; transform: translateY(-100%);"
						>
							<div class="flex items-center gap-2 text-xs">
								<span class="text-muted-foreground">{getNodeLabel(hoveredEdge.source)}</span>
								<Badge variant="outline" class="text-[10px]">{hoveredEdge.relationship}</Badge>
								<span class="text-muted-foreground">{getNodeLabel(hoveredEdge.target)}</span>
							</div>
						</div>
					{/if}
				</div>

				{#if selectedNode}
					<MemoryGraphDetail
						node={selectedNode}
						links={simulatedLinks}
						onClose={() => (selectedNode = null)}
						onNodeDeleted={handleNodeDeleted}
						{getNodeColor}
						{getNodeLabel}
					/>
				{/if}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
