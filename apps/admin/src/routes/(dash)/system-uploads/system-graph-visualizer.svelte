<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/shadcn/card';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import { RefreshCw, ZoomIn, ZoomOut, Maximize2 } from '@lucide/svelte';

	// Define node and edge types for graph data
	interface GraphNode {
		id: string;
		type: string;
		data: Record<string, unknown>;
		confidence?: number;
		decayScore?: number;
		createdAt?: string;
		updatedAt?: string;
		// d3 simulation adds these
		x?: number;
		y?: number;
		vx?: number;
		vy?: number;
		fx?: number | null;
		fy?: number | null;
	}

	interface GraphLink {
		source: string | GraphNode;
		target: string | GraphNode;
		relationship: string;
		properties?: Record<string, unknown>;
		createdAt?: string;
	}

	interface GraphData {
		nodes: GraphNode[];
		edges: GraphLink[];
		stats: {
			nodeCount: number;
			edgeCount: number;
			nodesByType: Record<string, number>;
			edgesByRelationship: Record<string, number>;
		};
	}

	// Props using Svelte 5 runes
	let { graphData, loading = false }: { graphData: GraphData | undefined; loading?: boolean } =
		$props();

	// Node type color scheme
	const nodeTypeColors: Record<string, string> = {
		USER: '#3b82f6',
		AGENT: '#f97316',
		SESSION: '#22c55e',
		DOCUMENT: '#a855f7',
		FACT: '#eab308',
		ENTITY: '#06b6d4',
		INTENT: '#ec4899',
		TOPIC: '#6b7280',
		INSIGHT: '#ef4444',
		ACTION_ITEM: '#f59e0b',
		NOTE: '#8b5cf6',
		TODO: '#3b82f6',
		REMINDER: '#10b981',
		FILE_REF: '#94a3b8'
	};

	const getNodeColor = (type: string) => nodeTypeColors[type] || '#6b7280';

	// Simulation state
	let containerElement: HTMLDivElement | undefined = $state();
	let svgElement: SVGSVGElement | undefined = $state();
	let width = $state(800);
	let height = $state(600);
	let simulatedNodes = $state<GraphNode[]>([]);
	let simulatedLinks = $state<
		Array<{ source: GraphNode; target: GraphNode; relationship: string }>
	>([]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let simulation: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let nodesRef: GraphNode[] = [];

	// Controls
	let nodeRadius = $state(8);
	let linkOpacity = $state(0.4);
	let chargeStrength = $state(-100);

	// Transform state for pan/zoom
	let transform = $state({ x: 0, y: 0, k: 1 });

	// Drag state
	let draggedNode = $state<GraphNode | null>(null);
	let isDragging = $state(false);
	let dragStartPos = { x: 0, y: 0 };

	// Pan state
	let isPanning = $state(false);
	let panStart = { x: 0, y: 0 };

	// Tooltip state
	let tooltipNode = $state<GraphNode | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	// Get unique node types for legend
	const nodeTypes = $derived([...new Set((graphData?.nodes ?? []).map((n) => n.type))]);

	// Get node label for display
	function getNodeLabel(node: GraphNode): string {
		if (node.data?.name) return String(node.data.name);
		if (node.data?.title) return String(node.data.title);
		if (node.data?.fileName) return String(node.data.fileName);
		if (node.data?.text) return String(node.data.text).substring(0, 20) + '...';
		return node.id.split(':').pop() || node.id;
	}

	async function initSimulation() {
		if (!graphData?.nodes?.length) return;

		// Dynamically import d3-force
		const d3 = await import('d3-force');

		// Clone nodes to avoid mutating original data
		nodesRef = graphData.nodes.map((n) => ({ ...n, x: width / 2, y: height / 2 }));
		const links = graphData.edges.map((e) => ({
			source: typeof e.source === 'string' ? e.source : e.source.id,
			target: typeof e.target === 'string' ? e.target : e.target.id,
			relationship: e.relationship
		}));

		// Stop previous simulation
		if (simulation) {
			simulation.stop();
		}

		// Create simulation
		simulation = d3
			.forceSimulation(nodesRef)
			.force(
				'link',
				d3
					.forceLink(links)
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					.id((d: any) => d.id)
					.distance(80)
			)
			.force('charge', d3.forceManyBody().strength(chargeStrength))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collide', d3.forceCollide().radius(nodeRadius + 5))
			.on('tick', () => {
				simulatedNodes = [...nodesRef];
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				simulatedLinks = links.map((l: any) => ({
					source: l.source as GraphNode,
					target: l.target as GraphNode,
					relationship: l.relationship
				}));
			});

		// Run simulation
		simulation.alpha(1).restart();

		// Reset transform to center
		transform = { x: 0, y: 0, k: 1 };
	}

	function reheatSimulation() {
		if (simulation) {
			// Unfix all nodes
			nodesRef.forEach((n) => {
				n.fx = null;
				n.fy = null;
			});
			simulation.alpha(1).restart();
		}
	}

	// Convert screen coordinates to graph coordinates
	function screenToGraph(screenX: number, screenY: number): { x: number; y: number } {
		const rect = svgElement?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		const x = (screenX - rect.left - transform.x) / transform.k;
		const y = (screenY - rect.top - transform.y) / transform.k;
		return { x, y };
	}

	// Node drag handlers
	function handleNodeMouseDown(event: MouseEvent, node: GraphNode) {
		event.stopPropagation();
		event.preventDefault();

		isDragging = true;
		draggedNode = node;

		const graphPos = screenToGraph(event.clientX, event.clientY);
		dragStartPos = { x: graphPos.x - (node.x || 0), y: graphPos.y - (node.y || 0) };

		// Reheat simulation
		if (simulation) {
			simulation.alphaTarget(0.3).restart();
		}

		// Fix node position
		node.fx = node.x;
		node.fy = node.y;

		// Add global listeners for drag
		window.addEventListener('mousemove', handleNodeDrag);
		window.addEventListener('mouseup', handleNodeDragEnd);
	}

	function handleNodeDrag(event: MouseEvent) {
		if (!isDragging || !draggedNode) return;

		const graphPos = screenToGraph(event.clientX, event.clientY);
		draggedNode.fx = graphPos.x - dragStartPos.x;
		draggedNode.fy = graphPos.y - dragStartPos.y;

		// Force update
		simulatedNodes = [...nodesRef];
	}

	function handleNodeDragEnd() {
		if (!isDragging) return;

		// Cool down simulation
		if (simulation) {
			simulation.alphaTarget(0);
		}

		// Keep node fixed at new position
		isDragging = false;
		draggedNode = null;

		// Remove global listeners
		window.removeEventListener('mousemove', handleNodeDrag);
		window.removeEventListener('mouseup', handleNodeDragEnd);
	}

	// Pan handlers
	function handlePanStart(event: MouseEvent) {
		// Only pan with left click on background (not on nodes)
		if (event.button !== 0) return;

		isPanning = true;
		panStart = { x: event.clientX - transform.x, y: event.clientY - transform.y };

		window.addEventListener('mousemove', handlePanMove);
		window.addEventListener('mouseup', handlePanEnd);
	}

	function handlePanMove(event: MouseEvent) {
		if (!isPanning) return;

		transform = {
			...transform,
			x: event.clientX - panStart.x,
			y: event.clientY - panStart.y
		};
	}

	function handlePanEnd() {
		isPanning = false;
		window.removeEventListener('mousemove', handlePanMove);
		window.removeEventListener('mouseup', handlePanEnd);
	}

	// Zoom handlers
	function handleWheel(event: WheelEvent) {
		event.preventDefault();

		const rect = svgElement?.getBoundingClientRect();
		if (!rect) return;
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		// Calculate zoom factor
		const delta = -event.deltaY * 0.001;
		const newK = Math.min(Math.max(transform.k * (1 + delta), 0.1), 4);

		// Zoom towards mouse position
		const factor = newK / transform.k;
		const newX = mouseX - (mouseX - transform.x) * factor;
		const newY = mouseY - (mouseY - transform.y) * factor;

		transform = { x: newX, y: newY, k: newK };
	}

	// Zoom controls
	function zoomIn() {
		const factor = 1.2;
		const centerX = width / 2;
		const centerY = height / 2;
		const newK = Math.min(transform.k * factor, 4);
		const newX = centerX - (centerX - transform.x) * (newK / transform.k);
		const newY = centerY - (centerY - transform.y) * (newK / transform.k);
		transform = { x: newX, y: newY, k: newK };
	}

	function zoomOut() {
		const factor = 0.8;
		const centerX = width / 2;
		const centerY = height / 2;
		const newK = Math.max(transform.k * factor, 0.1);
		const newX = centerX - (centerX - transform.x) * (newK / transform.k);
		const newY = centerY - (centerY - transform.y) * (newK / transform.k);
		transform = { x: newX, y: newY, k: newK };
	}

	function fitToView() {
		if (!simulatedNodes.length) return;

		// Calculate bounds
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		simulatedNodes.forEach((n) => {
			if (n.x != null && n.y != null) {
				minX = Math.min(minX, n.x);
				minY = Math.min(minY, n.y);
				maxX = Math.max(maxX, n.x);
				maxY = Math.max(maxY, n.y);
			}
		});

		const padding = 50;
		const graphWidth = maxX - minX + padding * 2;
		const graphHeight = maxY - minY + padding * 2;

		// Calculate scale to fit
		const scaleX = width / graphWidth;
		const scaleY = height / graphHeight;
		const newK = Math.min(scaleX, scaleY, 2) * 0.9;

		// Center the graph
		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;
		const newX = width / 2 - centerX * newK;
		const newY = height / 2 - centerY * newK;

		transform = { x: newX, y: newY, k: newK };
	}

	function handleNodeHover(event: MouseEvent, node: GraphNode) {
		if (isDragging) return;
		tooltipNode = node;
		tooltipX = event.clientX;
		tooltipY = event.clientY;
	}

	function handleNodeLeave() {
		tooltipNode = null;
	}

	// Update simulation when settings change
	$effect(() => {
		if (simulation) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			simulation.force('charge', (simulation.force('charge') as any)?.strength(chargeStrength));
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			simulation.force('collide', (simulation.force('collide') as any)?.radius(nodeRadius + 5));
			simulation.alpha(0.3).restart();
		}
	});

	// Initialize on mount
	onMount(() => {
		if (containerElement) {
			const rect = containerElement.getBoundingClientRect();
			width = rect.width || 800;
			height = rect.height || 600;
		}
		initSimulation();

		// Fit to view after simulation settles
		const timeout = setTimeout(() => {
			fitToView();
		}, 1500);

		return () => {
			clearTimeout(timeout);
			if (simulation) {
				simulation.stop();
			}
			window.removeEventListener('mousemove', handleNodeDrag);
			window.removeEventListener('mouseup', handleNodeDragEnd);
			window.removeEventListener('mousemove', handlePanMove);
			window.removeEventListener('mouseup', handlePanEnd);
		};
	});

	// Re-init when data changes
	$effect(() => {
		if (graphData?.nodes?.length) {
			initSimulation();
		}
	});
</script>

<Card.Root class="h-full">
	<Card.Header class="pb-2">
		<div class="flex items-center justify-between">
			<Card.Title class="text-lg">System Knowledge Graph</Card.Title>
			<div class="flex items-center gap-2">
				{#if graphData?.stats}
					<Badge variant="outline" class="text-xs">
						{graphData.stats.nodeCount} nodes
					</Badge>
					<Badge variant="outline" class="text-xs">
						{graphData.stats.edgeCount} edges
					</Badge>
				{/if}
			</div>
		</div>
		<p class="text-sm text-muted-foreground">
			Visualize the knowledge graph created from system uploads. Documents, facts, and entities are
			interconnected.
		</p>
	</Card.Header>

	<Card.Content class="p-0">
		{#if loading}
			<div class="flex h-150 items-center justify-center">
				<RefreshCw class="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		{:else if !graphData?.nodes?.length}
			<div class="flex h-150 flex-col items-center justify-center gap-2 text-muted-foreground">
				<p class="text-sm">No graph data available</p>
				<p class="text-xs">Upload system files to build the knowledge graph</p>
			</div>
		{:else}
			<!-- Controls -->
			<div class="border-b px-4 py-2">
				<div class="flex flex-wrap items-center gap-4 text-xs">
					<div class="flex items-center gap-2">
						<span class="text-muted-foreground">Node Size:</span>
						<input
							type="range"
							bind:value={nodeRadius}
							min={4}
							max={20}
							step={1}
							class="w-20 accent-primary"
						/>
						<span class="w-6 text-muted-foreground">{nodeRadius}</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-muted-foreground">Link Opacity:</span>
						<input
							type="range"
							value={linkOpacity * 100}
							oninput={(e) => (linkOpacity = Number(e.currentTarget.value) / 100)}
							min={10}
							max={100}
							step={5}
							class="w-20 accent-primary"
						/>
						<span class="w-10 text-muted-foreground">{Math.round(linkOpacity * 100)}%</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-muted-foreground">Repulsion:</span>
						<input
							type="range"
							value={-chargeStrength}
							oninput={(e) => (chargeStrength = -Number(e.currentTarget.value))}
							min={20}
							max={300}
							step={10}
							class="w-20 accent-primary"
						/>
						<span class="w-8 text-muted-foreground">{-chargeStrength}</span>
					</div>
					<div class="flex items-center gap-1 border-l pl-4">
						<Button variant="ghost" size="icon" onclick={zoomOut} class="h-7 w-7" title="Zoom out">
							<ZoomOut class="h-3.5 w-3.5" />
						</Button>
						<span class="w-12 text-center text-muted-foreground">
							{Math.round(transform.k * 100)}%
						</span>
						<Button variant="ghost" size="icon" onclick={zoomIn} class="h-7 w-7" title="Zoom in">
							<ZoomIn class="h-3.5 w-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onclick={fitToView}
							class="h-7 w-7"
							title="Fit to view"
						>
							<Maximize2 class="h-3.5 w-3.5" />
						</Button>
					</div>
					<Button variant="ghost" size="sm" onclick={reheatSimulation} class="h-7 px-2">
						<RefreshCw class="mr-1 h-3 w-3" />
						Reset
					</Button>
				</div>
			</div>

			<!-- Legend -->
			<div class="flex flex-wrap gap-2 border-b px-4 py-2">
				{#each nodeTypes as type}
					<div class="flex items-center gap-1 text-xs">
						<div class="h-3 w-3 rounded-full" style="background-color: {getNodeColor(type)}"></div>
						<span class="text-muted-foreground">{type}</span>
					</div>
				{/each}
			</div>

			<!-- Graph SVG -->
			<div
				bind:this={containerElement}
				class="relative h-150 w-full overflow-hidden"
				class:cursor-grab={!isPanning && !isDragging}
				class:cursor-grabbing={isPanning}
			>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<svg
					bind:this={svgElement}
					class="h-full w-full"
					onmousedown={handlePanStart}
					onwheel={handleWheel}
				>
					<g transform="translate({transform.x}, {transform.y}) scale({transform.k})">
						<!-- Links -->
						{#each simulatedLinks as link}
							{#if link.source?.x != null && link.target?.x != null}
								<line
									x1={link.source.x}
									y1={link.source.y}
									x2={link.target.x}
									y2={link.target.y}
									stroke="currentColor"
									class="text-muted-foreground"
									stroke-width={1 / transform.k}
									opacity={linkOpacity}
								/>
							{/if}
						{/each}

						<!-- Nodes -->
						{#each simulatedNodes as node (node.id)}
							{#if node.x != null && node.y != null}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g
									transform="translate({node.x}, {node.y})"
									class="cursor-pointer"
									onmousedown={(e) => handleNodeMouseDown(e, node)}
									onmouseenter={(e) => handleNodeHover(e, node)}
									onmouseleave={handleNodeLeave}
								>
									<circle
										r={nodeRadius}
										fill={getNodeColor(node.type)}
										stroke={draggedNode?.id === node.id
											? 'hsl(var(--primary))'
											: node.fx != null
												? 'hsl(var(--foreground))'
												: 'hsl(var(--background))'}
										stroke-width={(draggedNode?.id === node.id ? 3 : 2) / transform.k}
										class="transition-colors"
									/>
									{#if transform.k > 0.6}
										<text
											dy={nodeRadius + 12}
											text-anchor="middle"
											class="pointer-events-none fill-current text-muted-foreground"
											font-size={10 / transform.k}
										>
											{getNodeLabel(node).substring(0, 15)}
										</text>
									{/if}
								</g>
							{/if}
						{/each}
					</g>
				</svg>

				<!-- Zoom hint -->
				<div
					class="pointer-events-none absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-[10px] text-muted-foreground"
				>
					Scroll to zoom • Drag background to pan • Drag nodes to move
				</div>

				<!-- Tooltip -->
				{#if tooltipNode}
					<div
						class="pointer-events-none fixed z-50 max-w-sm rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md"
						style="left: {tooltipX + 10}px; top: {tooltipY + 10}px;"
					>
						<div class="space-y-1 text-xs">
							<div class="font-semibold">{getNodeLabel(tooltipNode)}</div>
							<div class="text-muted-foreground">
								Type: <Badge variant="secondary" class="ml-1 px-1 py-0 text-[10px]">
									{tooltipNode.type}
								</Badge>
							</div>
							{#if tooltipNode.confidence}
								<div class="text-muted-foreground">
									Confidence: {(tooltipNode.confidence * 100).toFixed(0)}%
								</div>
							{/if}
							{#if tooltipNode.data?.category}
								<div class="text-muted-foreground">Category: {tooltipNode.data.category}</div>
							{/if}
							{#if tooltipNode.data?.fileName}
								<div class="text-muted-foreground">File: {tooltipNode.data.fileName}</div>
							{/if}
							{#if tooltipNode.data?.summary}
								<div class="line-clamp-3 text-muted-foreground">
									Summary: {tooltipNode.data.summary}
								</div>
							{/if}
							{#if tooltipNode.updatedAt}
								<div class="text-muted-foreground">
									Updated: {new Date(tooltipNode.updatedAt).toLocaleDateString()}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Stats breakdown -->
			{#if graphData.stats.nodesByType && Object.keys(graphData.stats.nodesByType).length > 0}
				<div class="border-t px-4 py-3">
					<p class="mb-2 text-xs font-medium text-muted-foreground">Node Distribution</p>
					<div class="flex flex-wrap gap-2">
						{#each Object.entries(graphData.stats.nodesByType) as [type, count]}
							<Badge variant="outline" class="text-xs">
								<span
									class="mr-1.5 inline-block h-2 w-2 rounded-full"
									style="background-color: {getNodeColor(type)}"
								></span>
								{type}: {count}
							</Badge>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>
