<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/shadcn/card';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import { RefreshCw, ZoomIn, ZoomOut, Maximize2, X, Eye, EyeOff, Trash2 } from '@lucide/svelte';
	import { ScrollArea } from '$lib/components/shadcn/scroll-area';
	import { toggleNodeHidden, deleteMemoryNode } from './user-details.remote';
	import { toast } from 'svelte-sonner';
	import * as AlertDialog from '$lib/components/shadcn/alert-dialog';
	import { Switch } from '$lib/components/shadcn/switch';
	import { Label } from '$lib/components/shadcn/label';

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

	// Edge relationship color scheme
	const edgeTypeColors: Record<string, string> = {
		HAS_FACT: '#eab308',
		HAS_INTENT: '#ec4899',
		HAS_SESSION: '#22c55e',
		WITH_AGENT: '#f97316',
		MENTIONED: '#06b6d4',
		RELATED_TO: '#8b5cf6',
		DERIVED_FROM: '#ef4444',
		OWNS: '#3b82f6',
		ATTACHED_TO: '#a855f7',
		REFERENCES: '#10b981'
	};

	const getEdgeColor = (relationship: string) => edgeTypeColors[relationship] || '#6b7280';

	// Simulation state
	let containerElement: HTMLDivElement | undefined = $state();
	let svgElement: SVGSVGElement | undefined = $state();
	let width = $state(800);
	let height = $state(500);
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

	// Selected node state (for detail panel)
	let selectedNode = $state<GraphNode | null>(null);

	// Node action states
	let isTogglingHidden = $state(false);
	let isDeletingNode = $state(false);
	let deleteDialogOpen = $state(false);

	// Hovered edge state
	let hoveredEdge = $state<{ source: GraphNode; target: GraphNode; relationship: string } | null>(
		null
	);
	let edgeTooltipX = $state(0);
	let edgeTooltipY = $state(0);

	// Visibility toggles
	let showEdgeLabels = $state(true);
	let showNodeLabels = $state(true);
	let highlightConnections = $state(true);

	// Handler to toggle node hidden status
	async function handleToggleHidden(node: GraphNode, hidden: boolean) {
		isTogglingHidden = true;
		try {
			const result = await toggleNodeHidden({ nodeId: node.id, hidden });
			if (result.success) {
				// Update local node data
				node.data = { ...node.data, hidden_from_agent: hidden };
				selectedNode = { ...node };
				toast.success(hidden ? 'Node hidden from agent' : 'Node visible to agent');
			}
		} catch (err) {
			console.error('Failed to toggle node visibility:', err);
			toast.error('Failed to update node visibility');
		} finally {
			isTogglingHidden = false;
		}
	}

	// Handler to delete a node
	async function handleDeleteNode(node: GraphNode) {
		isDeletingNode = true;
		try {
			const result = await deleteMemoryNode({ nodeId: node.id });
			if (result.success) {
				// Remove from local graph
				simulatedNodes = simulatedNodes.filter((n) => n.id !== node.id);
				simulatedLinks = simulatedLinks.filter(
					(l) => l.source.id !== node.id && l.target.id !== node.id
				);
				selectedNode = null;
				deleteDialogOpen = false;
				toast.success('Node deleted successfully');
			}
		} catch (err) {
			console.error('Failed to delete node:', err);
			toast.error('Failed to delete node');
		} finally {
			isDeletingNode = false;
		}
	}

	// Get unique node types for legend
	const nodeTypes = $derived([...new Set((graphData?.nodes ?? []).map((n) => n.type))]);

	// Get unique edge types for legend
	const edgeTypes = $derived([...new Set((graphData?.edges ?? []).map((e) => e.relationship))]);

	// Get connected nodes and edges for highlighting
	const connectedNodeIds = $derived.by(() => {
		if (!selectedNode || !highlightConnections) return new Set<string>();
		const connected = new Set<string>([selectedNode.id]);
		for (const link of simulatedLinks) {
			const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
			const targetId = typeof link.target === 'string' ? link.target : link.target.id;
			if (sourceId === selectedNode.id) connected.add(targetId);
			if (targetId === selectedNode.id) connected.add(sourceId);
		}
		return connected;
	});

	const connectedEdges = $derived.by(() => {
		if (!selectedNode || !highlightConnections) return new Set<string>();
		const edges = new Set<string>();
		for (const link of simulatedLinks) {
			const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
			const targetId = typeof link.target === 'string' ? link.target : link.target.id;
			if (sourceId === selectedNode.id || targetId === selectedNode.id) {
				edges.add(`${sourceId}-${link.relationship}-${targetId}`);
			}
		}
		return edges;
	});

	// Get node label for display
	function getNodeLabel(node: GraphNode): string {
		if (node.data?.name) return String(node.data.name);
		if (node.data?.title) return String(node.data.title);
		if (node.data?.text) return String(node.data.text).substring(0, 20) + '...';
		return node.id.split(':').pop() || node.id;
	}

	// Get full node text for detail panel
	function getNodeFullText(node: GraphNode): string {
		if (node.data?.text) return String(node.data.text);
		if (node.data?.description) return String(node.data.description);
		if (node.data?.summary) return String(node.data.summary);
		return '';
	}

	// Get edge midpoint for label positioning
	function getEdgeMidpoint(source: GraphNode, target: GraphNode): { x: number; y: number } {
		return {
			x: ((source.x || 0) + (target.x || 0)) / 2,
			y: ((source.y || 0) + (target.y || 0)) / 2
		};
	}

	// Handle node click for selection
	function handleNodeClick(event: Event, node: GraphNode) {
		event.stopPropagation();
		// Toggle selection
		if (selectedNode?.id === node.id) {
			selectedNode = null;
		} else {
			selectedNode = node;
		}
	}

	// Handle edge hover
	function handleEdgeHover(
		event: MouseEvent,
		link: { source: GraphNode; target: GraphNode; relationship: string }
	) {
		hoveredEdge = link;
		edgeTooltipX = event.clientX;
		edgeTooltipY = event.clientY;
	}

	function handleEdgeLeave() {
		hoveredEdge = null;
	}

	// Close detail panel
	function closeDetailPanel() {
		selectedNode = null;
	}

	// Format date helper
	function formatDate(dateStr?: string): string {
		if (!dateStr) return 'N/A';
		return new Date(dateStr).toLocaleString();
	}

	async function initSimulation() {
		if (!graphData?.nodes?.length) return;

		// Dynamically import d3-force
		const d3 = await import('d3-force');

		// Clone nodes to avoid mutating original data
		nodesRef = graphData.nodes.map((n) => ({
			...n,
			x: Math.random() * width,
			y: Math.random() * height
		}));

		// Create node map for resolving edges
		const nodeMap = new Map(nodesRef.map((n) => [n.id, n]));

		// Map edges and filter out any with missing nodes
		const links = graphData.edges
			.map((e) => ({
				source: nodeMap.get(typeof e.source === 'string' ? e.source : e.source.id),
				target: nodeMap.get(typeof e.target === 'string' ? e.target : e.target.id),
				relationship: e.relationship
			}))
			.filter((l) => l.source && l.target) as Array<{
			source: GraphNode;
			target: GraphNode;
			relationship: string;
		}>;

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
				simulatedLinks = [...links];
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
			height = rect.height || 500;
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
			<Card.Title class="text-lg">Memory Graph</Card.Title>
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
	</Card.Header>

	<Card.Content class="p-0">
		{#if loading}
			<div class="flex h-125 items-center justify-center">
				<RefreshCw class="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		{:else if !graphData?.nodes?.length}
			<div class="flex h-125 flex-col items-center justify-center gap-2 text-muted-foreground">
				<p class="text-sm">No graph data available</p>
				<p class="text-xs">This user's memory graph is empty</p>
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
					<!-- Toggle buttons -->
					<div class="flex items-center gap-1 border-l pl-4">
						<Button
							variant={showNodeLabels ? 'secondary' : 'ghost'}
							size="sm"
							onclick={() => (showNodeLabels = !showNodeLabels)}
							class="h-7 px-2"
							title="Toggle node labels"
						>
							{#if showNodeLabels}
								<Eye class="mr-1 h-3 w-3" />
							{:else}
								<EyeOff class="mr-1 h-3 w-3" />
							{/if}
							Labels
						</Button>
						<Button
							variant={showEdgeLabels ? 'secondary' : 'ghost'}
							size="sm"
							onclick={() => (showEdgeLabels = !showEdgeLabels)}
							class="h-7 px-2"
							title="Toggle edge labels"
						>
							{#if showEdgeLabels}
								<Eye class="mr-1 h-3 w-3" />
							{:else}
								<EyeOff class="mr-1 h-3 w-3" />
							{/if}
							Edges
						</Button>
						<Button
							variant={highlightConnections ? 'secondary' : 'ghost'}
							size="sm"
							onclick={() => (highlightConnections = !highlightConnections)}
							class="h-7 px-2"
							title="Highlight connections on select"
						>
							Highlight
						</Button>
					</div>
				</div>
			</div>

			<!-- Node Type Legend -->
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2">
				<span class="text-xs font-medium text-muted-foreground">Nodes:</span>
				{#each nodeTypes as type}
					<div class="flex items-center gap-1 text-xs">
						<div class="h-3 w-3 rounded-full" style="background-color: {getNodeColor(type)}"></div>
						<span class="text-muted-foreground">{type}</span>
					</div>
				{/each}
			</div>

			<!-- Edge Type Legend -->
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2">
				<span class="text-xs font-medium text-muted-foreground">Edges:</span>
				{#each edgeTypes as type}
					<div class="flex items-center gap-1 text-xs">
						<div class="h-0.5 w-4" style="background-color: {getEdgeColor(type)}"></div>
						<span class="text-muted-foreground">{type.replace(/_/g, ' ')}</span>
					</div>
				{/each}
			</div>

			<!-- Graph SVG -->
			<div
				bind:this={containerElement}
				class="relative h-125 w-full overflow-hidden"
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
					<defs>
						<!-- Arrow markers for directed edges -->
						{#each edgeTypes as edgeType}
							<marker
								id="arrow-{edgeType}"
								viewBox="0 0 10 10"
								refX="20"
								refY="5"
								markerWidth="6"
								markerHeight="6"
								orient="auto-start-reverse"
							>
								<path d="M 0 0 L 10 5 L 0 10 z" fill={getEdgeColor(edgeType)} />
							</marker>
						{/each}
					</defs>

					<g transform="translate({transform.x}, {transform.y}) scale({transform.k})">
						<!-- Links with colored lines and labels -->
						{#each simulatedLinks as link}
							{@const sourceId = typeof link.source === 'string' ? link.source : link.source.id}
							{@const targetId = typeof link.target === 'string' ? link.target : link.target.id}
							{@const edgeKey = `${sourceId}-${link.relationship}-${targetId}`}
							{@const isConnected = connectedEdges.has(edgeKey)}
							{@const dimmed = selectedNode && highlightConnections && !isConnected}
							{#if link.source?.x != null && link.target?.x != null}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g
									class="cursor-pointer"
									onmouseenter={(e) => handleEdgeHover(e, link)}
									onmouseleave={handleEdgeLeave}
								>
									<line
										x1={link.source.x}
										y1={link.source.y}
										x2={link.target.x}
										y2={link.target.y}
										stroke={getEdgeColor(link.relationship)}
										stroke-width={(isConnected && selectedNode ? 2.5 : 1.5) / transform.k}
										opacity={dimmed ? 0.15 : linkOpacity}
										marker-end="url(#arrow-{link.relationship})"
									/>
									<!-- Edge label -->
									{#if showEdgeLabels && transform.k > 0.5}
										{@const mid = getEdgeMidpoint(link.source, link.target)}
										<text
											x={mid.x}
											y={mid.y - 4 / transform.k}
											text-anchor="middle"
											font-size={8 / transform.k}
											fill={getEdgeColor(link.relationship)}
											opacity={dimmed ? 0.2 : 0.8}
											class="pointer-events-none"
										>
											{link.relationship.replace(/_/g, ' ')}
										</text>
									{/if}
								</g>
							{/if}
						{/each}

						<!-- Nodes -->
						{#each simulatedNodes as node (node.id)}
							{@const isSelected = selectedNode?.id === node.id}
							{@const isConnectedNode = connectedNodeIds.has(node.id)}
							{@const dimmed = selectedNode && highlightConnections && !isConnectedNode}
							{#if node.x != null && node.y != null}
								<g
									transform="translate({node.x}, {node.y})"
									class="cursor-pointer"
									role="button"
									tabindex="0"
									onmousedown={(e) => handleNodeMouseDown(e, node)}
									onclick={(e) => handleNodeClick(e, node)}
									onkeydown={(e) => e.key === 'Enter' && handleNodeClick(e, node)}
									onmouseenter={(e) => handleNodeHover(e, node)}
									onmouseleave={handleNodeLeave}
									opacity={dimmed ? 0.3 : 1}
								>
									<!-- Selection ring -->
									{#if isSelected}
										<circle
											r={nodeRadius + 4}
											fill="none"
											stroke="hsl(var(--primary))"
											stroke-width={2 / transform.k}
											stroke-dasharray="4 2"
											class="animate-pulse"
										/>
									{/if}
									<circle
										r={nodeRadius}
										fill={getNodeColor(node.type)}
										stroke={isSelected
											? 'hsl(var(--primary))'
											: draggedNode?.id === node.id
												? 'hsl(var(--primary))'
												: node.fx != null
													? 'hsl(var(--foreground))'
													: 'hsl(var(--background))'}
										stroke-width={(isSelected || draggedNode?.id === node.id ? 3 : 2) / transform.k}
										class="transition-colors"
									/>
									<!-- Node type badge -->
									{#if transform.k > 0.8}
										<text
											dy={-nodeRadius - 4}
											text-anchor="middle"
											font-size={7 / transform.k}
											fill={getNodeColor(node.type)}
											class="pointer-events-none font-medium"
										>
											{node.type}
										</text>
									{/if}
									<!-- Node label -->
									{#if showNodeLabels && transform.k > 0.5}
										<text
											dy={nodeRadius + 12}
											text-anchor="middle"
											class="pointer-events-none fill-current text-foreground"
											font-size={10 / transform.k}
											font-weight={isSelected ? '600' : '400'}
										>
											{getNodeLabel(node).substring(0, 20)}
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
					Scroll to zoom • Drag to pan • Click node to inspect • Drag node to move
				</div>

				<!-- Edge Tooltip -->
				{#if hoveredEdge}
					<div
						class="pointer-events-none fixed z-50 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md"
						style="left: {edgeTooltipX + 10}px; top: {edgeTooltipY + 10}px;"
					>
						<div class="space-y-1 text-xs">
							<div class="font-semibold" style="color: {getEdgeColor(hoveredEdge.relationship)}">
								{hoveredEdge.relationship.replace(/_/g, ' ')}
							</div>
							<div class="text-muted-foreground">
								{getNodeLabel(hoveredEdge.source)} → {getNodeLabel(hoveredEdge.target)}
							</div>
						</div>
					</div>
				{/if}

				<!-- Node Tooltip -->
				{#if tooltipNode && !selectedNode}
					<div
						class="pointer-events-none fixed z-50 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md"
						style="left: {tooltipX + 10}px; top: {tooltipY + 10}px;"
					>
						<div class="max-w-xs space-y-1 text-xs">
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
							<div class="pt-1 text-[10px] text-muted-foreground italic">Click for details</div>
						</div>
					</div>
				{/if}

				<!-- Selected Node Detail Panel -->
				{#if selectedNode}
					<div class="absolute top-2 right-2 z-50 w-80 rounded-lg border bg-card shadow-lg">
						<div class="flex items-center justify-between border-b p-3">
							<div class="flex items-center gap-2">
								<div
									class="h-3 w-3 rounded-full"
									style="background-color: {getNodeColor(selectedNode.type)}"
								></div>
								<span class="text-sm font-semibold">{selectedNode.type}</span>
							</div>
							<Button variant="ghost" size="icon" class="h-6 w-6" onclick={closeDetailPanel}>
								<X class="h-4 w-4" />
							</Button>
						</div>
						<ScrollArea class="h-64">
							<div class="space-y-3 p-3 text-sm">
								<!-- Node ID -->
								<div>
									<div class="text-xs font-medium text-muted-foreground">ID</div>
									<div class="font-mono text-xs break-all">{selectedNode.id}</div>
								</div>

								<!-- Node Label/Name -->
								<div>
									<div class="text-xs font-medium text-muted-foreground">Label</div>
									<div class="font-medium">{getNodeLabel(selectedNode)}</div>
								</div>

								<!-- Full Text Content -->
								{#if getNodeFullText(selectedNode)}
									<div>
										<div class="text-xs font-medium text-muted-foreground">Content</div>
										<div class="rounded bg-muted p-2 text-xs whitespace-pre-wrap">
											{getNodeFullText(selectedNode)}
										</div>
									</div>
								{/if}

								<!-- Confidence -->
								{#if selectedNode.confidence != null}
									<div>
										<div class="text-xs font-medium text-muted-foreground">Confidence</div>
										<div class="flex items-center gap-2">
											<div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
												<div
													class="h-full bg-primary transition-all"
													style="width: {selectedNode.confidence * 100}%"
												></div>
											</div>
											<span class="text-xs">{(selectedNode.confidence * 100).toFixed(0)}%</span>
										</div>
									</div>
								{/if}

								<!-- Category -->
								{#if selectedNode.data?.category}
									<div>
										<div class="text-xs font-medium text-muted-foreground">Category</div>
										<Badge variant="outline">{selectedNode.data.category}</Badge>
									</div>
								{/if}

								<!-- Source -->
								{#if selectedNode.data?.source}
									<div>
										<div class="text-xs font-medium text-muted-foreground">Source</div>
										<div class="font-mono text-xs">{selectedNode.data.source}</div>
									</div>
								{/if}

								<!-- All Data Fields -->
								{#if Object.keys(selectedNode.data || {}).length > 0}
									<div>
										<div class="mb-1 text-xs font-medium text-muted-foreground">All Properties</div>
										<div class="space-y-1 rounded bg-muted p-2 text-xs">
											{#each Object.entries(selectedNode.data || {}) as [key, value]}
												<div class="flex gap-2">
													<span class="font-medium text-muted-foreground">{key}:</span>
													<span class="break-all">
														{typeof value === 'object' ? JSON.stringify(value) : String(value)}
													</span>
												</div>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Timestamps -->
								<div class="grid grid-cols-2 gap-2 border-t pt-2">
									<div>
										<div class="text-xs font-medium text-muted-foreground">Created</div>
										<div class="text-xs">{formatDate(selectedNode.createdAt)}</div>
									</div>
									<div>
										<div class="text-xs font-medium text-muted-foreground">Updated</div>
										<div class="text-xs">{formatDate(selectedNode.updatedAt)}</div>
									</div>
								</div>

								<!-- Agent Visibility Control -->
								<div class="border-t pt-2">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											{#if selectedNode.data?.hidden_from_agent}
												<EyeOff class="h-4 w-4 text-muted-foreground" />
											{:else}
												<Eye class="h-4 w-4 text-primary" />
											{/if}
											<Label for="hide-from-agent" class="text-xs font-medium">
												Hide from Agent
											</Label>
										</div>
										<Switch
											id="hide-from-agent"
											checked={!!selectedNode.data?.hidden_from_agent}
											disabled={isTogglingHidden}
											onCheckedChange={(checked) => handleToggleHidden(selectedNode!, checked)}
										/>
									</div>
									<p class="mt-1 text-[10px] text-muted-foreground">
										Hidden nodes won't be used for agent context retrieval
									</p>
								</div>

								<!-- Delete Node Action -->
								<div class="border-t pt-2">
									<Button
										variant="destructive"
										size="sm"
										class="w-full"
										onclick={() => (deleteDialogOpen = true)}
									>
										<Trash2 class="mr-2 h-3 w-3" />
										Delete Node
									</Button>
								</div>

								<!-- Connected Nodes -->
								{#if selectedNode}
									{@const nodeId = selectedNode.id}
									{@const incomingEdges = simulatedLinks.filter(
										(l) => (typeof l.target === 'string' ? l.target : l.target.id) === nodeId
									)}
									{@const outgoingEdges = simulatedLinks.filter(
										(l) => (typeof l.source === 'string' ? l.source : l.source.id) === nodeId
									)}
									{#if incomingEdges.length > 0 || outgoingEdges.length > 0}
										<div class="border-t pt-2">
											<div class="mb-2 text-xs font-medium text-muted-foreground">Connections</div>
											{#if incomingEdges.length > 0}
												<div class="mb-2">
													<div class="mb-1 text-[10px] text-muted-foreground">
														Incoming ({incomingEdges.length})
													</div>
													{#each incomingEdges.slice(0, 5) as edge}
														<div class="mb-0.5 flex items-center gap-1 text-xs">
															<span class="text-muted-foreground">←</span>
															<Badge variant="outline" class="px-1 py-0 text-[10px]">
																{edge.relationship}
															</Badge>
															<span>{getNodeLabel(edge.source)}</span>
														</div>
													{/each}
													{#if incomingEdges.length > 5}
														<div class="text-[10px] text-muted-foreground">
															+{incomingEdges.length - 5} more
														</div>
													{/if}
												</div>
											{/if}
											{#if outgoingEdges.length > 0}
												<div>
													<div class="mb-1 text-[10px] text-muted-foreground">
														Outgoing ({outgoingEdges.length})
													</div>
													{#each outgoingEdges.slice(0, 5) as edge}
														<div class="mb-0.5 flex items-center gap-1 text-xs">
															<span class="text-muted-foreground">→</span>
															<Badge variant="outline" class="px-1 py-0 text-[10px]">
																{edge.relationship}
															</Badge>
															<span>{getNodeLabel(edge.target)}</span>
														</div>
													{/each}
													{#if outgoingEdges.length > 5}
														<div class="text-[10px] text-muted-foreground">
															+{outgoingEdges.length - 5} more
														</div>
													{/if}
												</div>
											{/if}
										</div>
									{/if}
								{/if}
							</div>
						</ScrollArea>
					</div>
				{/if}
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Memory Node</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this node? This action cannot be undone and will also remove
				all connections to this node.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<Button
				variant="outline"
				onclick={() => (deleteDialogOpen = false)}
				disabled={isDeletingNode}
			>
				Cancel
			</Button>
			<Button
				variant="destructive"
				onclick={() => selectedNode && handleDeleteNode(selectedNode)}
				disabled={isDeletingNode}
			>
				{isDeletingNode ? 'Deleting...' : 'Delete'}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
