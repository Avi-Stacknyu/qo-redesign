<script lang="ts">
	import {
		SvelteFlow,
		SvelteFlowProvider,
		Controls,
		Background,
		MiniMap,
		type Node,
		type Edge,
		type Connection,
		type IsValidConnection,
		BackgroundVariant
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import { setDnDContext } from './dnd-provider.svelte';
	import NodePalette from './node-palette.svelte';
	import PropertyPanel from './property-panel.svelte';
	import { nodeTypes } from './nodes';
	import type { AllNodeData } from './nodes';
	import { toast } from 'svelte-sonner';
	import {
		saveFlowVersion,
		activateFlowVersion,
		type FlowVersion,
		type FlowData,
		type ValidationError
	} from '$lib/remote/agent.remote';
	import { Button } from '$lib/components/shadcn/button';
	import { Badge } from '$lib/components/shadcn/badge';
	import * as Select from '$lib/components/shadcn/select';
	import * as Alert from '$lib/components/shadcn/alert';
	import Save from '@lucide/svelte/icons/save';
	import History from '@lucide/svelte/icons/history';
	import Check from '@lucide/svelte/icons/check';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import X from '@lucide/svelte/icons/x';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type {
		ModelWithProvider,
		Tool,
		SystemUpload,
		Prompt,
		InjectableAttribute
	} from '$lib/remote/agent.remote';

	interface Props {
		agentId: string;
		versions: FlowVersion[];
		activeFlow: FlowVersion | null;
		availableModels: ModelWithProvider[];
		availableTools: Tool[];
		systemUploads: SystemUpload[];
		availablePrompts: Prompt[];
		injectableAttributes: InjectableAttribute[];
		onVersionSaved?: () => void;
	}

	let {
		agentId,
		versions,
		activeFlow,
		availableModels,
		availableTools,
		systemUploads,
		availablePrompts,
		injectableAttributes,
		onVersionSaved
	}: Props = $props();

	// Initialize DnD context and get reference for use in event handlers
	const dndContext = setDnDContext();

	// Selected version for viewing history
	let selectedVersionId = $state<string | null>(null);

	// Derived selected version
	let selectedVersion = $derived.by(() => {
		if (selectedVersionId) {
			return versions.find((v) => v.id === selectedVersionId) ?? null;
		}
		return activeFlow;
	});

	let isViewingHistory = $derived(
		selectedVersionId !== null && selectedVersionId !== activeFlow?.id
	);

	// Parse flow data from the active version
	function parseFlowData(version: FlowVersion | null | undefined): {
		nodes: Node<AllNodeData>[];
		edges: Edge[];
	} {
		const defaultData = {
			nodes: [
				{
					id: 'start-1',
					type: 'start',
					position: { x: 250, y: 50 },
					data: { label: 'Start' }
				}
			] as Node<AllNodeData>[],
			edges: [] as Edge[]
		};

		if (!version?.flowData) {
			return defaultData;
		}

		try {
			const data =
				typeof version.flowData === 'string' ? JSON.parse(version.flowData) : version.flowData;
			return {
				nodes: (data.nodes ?? []) as Node<AllNodeData>[],
				edges: (data.edges ?? []) as Edge[]
			};
		} catch {
			return defaultData;
		}
	}

	// State for nodes and edges - initialize once
	let nodes = $state<Node<AllNodeData>[]>([]);
	let edges = $state<Edge[]>([]);

	// Initialize on mount and sync when version changes
	$effect(() => {
		const data = parseFlowData(selectedVersion);
		nodes = data.nodes;
		edges = data.edges;
		hasUnsavedChanges = false;
	});

	// Selected node for property panel
	let selectedNodeId = $state<string | null>(null);
	let selectedNode = $derived(nodes.find((n) => n.id === selectedNodeId) ?? null);

	// Track if there are unsaved changes
	let hasUnsavedChanges = $state(false);
	let isSaving = $state(false);

	// Validation errors state
	let validationErrors = $state<ValidationError[]>([]);
	let validationStatus = $state<'valid' | 'invalid' | 'warning'>('valid');
	let showValidationPanel = $state(false);

	// Generate unique node ID
	function generateNodeId(type: string): string {
		const existingIds = nodes.filter((n) => n.id.startsWith(type)).map((n) => n.id);
		let counter = 1;
		while (existingIds.includes(`${type}-${counter}`)) {
			counter++;
		}
		return `${type}-${counter}`;
	}

	// Get default data for each node type
	function getDefaultNodeData(type: string): AllNodeData {
		switch (type) {
			case 'start':
				return { label: 'Start', system_prompt: '', knowledge_base: [] };
			case 'end':
				return { label: 'End', end_type: 'success', response_template: '' };
			case 'llm':
				return { label: 'LLM Call', model_id: '', tools: [], parameters: { temperature: 0.7 } };
			case 'classifier':
				return {
					label: 'Classifier',
					classifier_type: 'llm',
					categories: [
						{ id: 'cat-1', label: 'Category 1', description: '' },
						{ id: 'cat-2', label: 'Category 2', description: '' }
					]
				};
			default:
				return { label: type };
		}
	}

	// Handle drop from palette
	function handleDrop(event: DragEvent) {
		event.preventDefault();
		if (isViewingHistory) return;

		if (!dndContext.current) return;

		const type = dndContext.current;
		const flowContainer = event.currentTarget as HTMLElement;
		const bounds = flowContainer.getBoundingClientRect();

		const position = {
			x: event.clientX - bounds.left - 100,
			y: event.clientY - bounds.top - 40
		};

		const newNode: Node<AllNodeData> = {
			id: generateNodeId(type),
			type,
			position,
			data: getDefaultNodeData(type)
		};

		nodes = [...nodes, newNode];
		hasUnsavedChanges = true;
		dndContext.current = null;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	// Handle connection between nodes
	function handleConnect(connection: Connection) {
		if (isViewingHistory) return;

		const newEdge: Edge = {
			id: `e-${connection.source}-${connection.sourceHandle ?? 'default'}-${connection.target}-${connection.targetHandle ?? 'default'}`,
			source: connection.source!,
			target: connection.target!,
			sourceHandle: connection.sourceHandle ?? null,
			targetHandle: connection.targetHandle ?? null,
			animated: true
		};

		edges = [...edges, newEdge];
		hasUnsavedChanges = true;
	}

	// Validate connection
	const isValidConnection: IsValidConnection = (edgeOrConnection) => {
		const source = edgeOrConnection.source;
		const target = edgeOrConnection.target;
		const sourceHandle = edgeOrConnection.sourceHandle ?? null;
		const targetHandle = edgeOrConnection.targetHandle ?? null;

		// Get source and target nodes
		const sourceNode = nodes.find((n) => n.id === source);
		const targetNode = nodes.find((n) => n.id === target);

		// Prevent self-connections
		if (source === target) return false;

		// End node can only receive connections from start, llm, or classifier nodes
		if (targetNode?.type === 'end') {
			const allowedSources = ['start', 'llm', 'classifier'];
			if (!allowedSources.includes(sourceNode?.type ?? '')) return false;

			// End node can only have ONE incoming connection
			const existingEndConnections = edges.filter((e) => e.target === target);
			if (existingEndConnections.length > 0) return false;
		}

		// Classifier category handles can only have ONE outgoing connection each
		if (sourceNode?.type === 'classifier' && sourceHandle) {
			const existingFromHandle = edges.filter(
				(e) => e.source === source && (e.sourceHandle ?? null) === sourceHandle
			);
			if (existingFromHandle.length > 0) return false;
		}

		// Classifier node can only have ONE incoming connection
		if (targetNode?.type === 'classifier') {
			const existingClassifierConnections = edges.filter((e) => e.target === target);
			if (existingClassifierConnections.length > 0) return false;
		}

		// Prevent duplicate connections
		const exists = edges.some(
			(e) =>
				e.source === source &&
				e.target === target &&
				(e.sourceHandle ?? null) === sourceHandle &&
				(e.targetHandle ?? null) === targetHandle
		);
		return !exists;
	};

	// Handle node click
	function handleNodeClick({ node }: { node: Node; event: MouseEvent | TouchEvent }) {
		selectedNodeId = node.id;
	}

	// Handle pane click (deselect)
	function handlePaneClick() {
		selectedNodeId = null;
	}

	// Update node data from property panel
	function updateNodeData(nodeId: string, data: Partial<AllNodeData>) {
		if (isViewingHistory) return;
		nodes = nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
		hasUnsavedChanges = true;
	}

	// Delete selected node
	function deleteNode(nodeId: string) {
		if (isViewingHistory) return;
		nodes = nodes.filter((n) => n.id !== nodeId);
		edges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
		selectedNodeId = null;
		hasUnsavedChanges = true;
	}

	// Save as new version
	async function handleSave() {
		if (isSaving || isViewingHistory) return;

		isSaving = true;
		try {
			const flowData: FlowData = {
				nodes: nodes.map((n) => ({
					id: n.id,
					type: n.type!,
					position: n.position,
					data: n.data
				})) as Node[],
				edges: edges.map((e) => ({
					id: e.id,
					source: e.source,
					target: e.target,
					sourceHandle: e.sourceHandle,
					targetHandle: e.targetHandle
				})) as Edge[]
			};

			const newVersion = await saveFlowVersion({
				agentId,
				flowData,
				changeLog: `Updated flow with ${nodes.length} nodes and ${edges.length} edges`
			});

			// Update validation state
			validationStatus = newVersion.validationStatus;
			validationErrors = newVersion.validationErrors ?? [];

			if (newVersion.validationStatus === 'invalid') {
				// Show validation errors panel
				showValidationPanel = true;
				toast.error(
					`Flow has ${validationErrors.filter((e) => e.severity === 'error').length} validation error(s)`
				);
				hasUnsavedChanges = false;
				onVersionSaved?.();
				return;
			}

			// Auto-activate the new version only if valid
			await activateFlowVersion({ agentId, flowId: newVersion.id });

			hasUnsavedChanges = false;

			if (newVersion.validationStatus === 'warning') {
				showValidationPanel = true;
				toast.warning(
					`Flow saved with ${validationErrors.filter((e) => e.severity === 'warning').length} warning(s)`
				);
			} else {
				showValidationPanel = false;
				toast.success('Flow saved and activated');
			}

			onVersionSaved?.();
		} catch (error) {
			console.error('Failed to save flow:', error);
			toast.error('Failed to save flow');
		} finally {
			isSaving = false;
		}
	}

	// Activate a version
	async function handleActivate(versionId: string) {
		try {
			await activateFlowVersion({ agentId, flowId: versionId });
			toast.success('Version activated');
			selectedVersionId = null;
			onVersionSaved?.();
		} catch (error) {
			console.error('Failed to activate version:', error);
			toast.error('Failed to activate version');
		}
	}

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (isViewingHistory) return;

		if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId) {
			const target = event.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
				return;
			}
			deleteNode(selectedNodeId);
		}

		if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
			handleSave();
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<SvelteFlowProvider>
	<div class="flex h-full w-full">
		<!-- Node Palette (Left Sidebar) -->
		{#if !isViewingHistory}
			<div class="w-64 shrink-0 border-r bg-background">
				<NodePalette {agentId} />
			</div>
		{/if}

		<!-- Flow Canvas -->
		<div class="relative flex-1">
			<!-- Version History Bar -->
			{#if isViewingHistory && selectedVersion}
				<div
					class="absolute top-4 right-4 left-4 z-10 flex items-center justify-between rounded-lg border bg-yellow-500/10 p-3"
				>
					<div class="flex items-center gap-3">
						<History class="h-5 w-5 text-yellow-500" />
						<div>
							<p class="font-medium">Viewing version {selectedVersion.version}</p>
							<p class="text-xs text-muted-foreground">
								{formatDate(selectedVersion.created)} • {selectedVersion.changeLog ||
									'No description'}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" onclick={() => handleActivate(selectedVersion!.id)}>
							<Check class="mr-1 h-4 w-4" />
							Activate This Version
						</Button>
						<Button variant="ghost" size="sm" onclick={() => (selectedVersionId = null)}>
							Back to Current
						</Button>
					</div>
				</div>
			{/if}

			<SvelteFlow
				bind:nodes
				bind:edges
				{nodeTypes}
				onconnect={handleConnect}
				{isValidConnection}
				onnodeclick={handleNodeClick}
				onpaneclick={handlePaneClick}
				ondrop={handleDrop}
				ondragover={handleDragOver}
				fitView
				snapGrid={[15, 15]}
				nodesDraggable={!isViewingHistory}
				nodesConnectable={!isViewingHistory}
				elementsSelectable={!isViewingHistory}
				proOptions={{ hideAttribution: true }}
				class="bg-background"
			>
				<Controls class="border-border! bg-background!" />
				<Background variant={BackgroundVariant.Dots} gap={15} size={1} class="bg-background!" />
				<MiniMap class="border-border! bg-background!" nodeStrokeWidth={3} pannable zoomable />
			</SvelteFlow>

			<!-- Toolbar -->
			{#if !isViewingHistory}
				<div class="absolute top-4 right-4 z-10 flex items-center gap-2">
					<!-- Version Selector -->
					{#if versions.length > 0}
						<Select.Root
							type="single"
							value={selectedVersionId ?? activeFlow?.id ?? ''}
							onValueChange={(v) => {
								if (v === activeFlow?.id) {
									selectedVersionId = null;
								} else {
									selectedVersionId = v;
								}
							}}
						>
							<Select.Trigger class="w-48">
								<div class="flex items-center gap-2">
									<History class="h-4 w-4" />
									<span>
										{activeFlow ? `v${activeFlow.version} (active)` : 'No versions'}
									</span>
								</div>
							</Select.Trigger>
							<Select.Content>
								{#each versions as version}
									<Select.Item value={version.id}>
										<div class="flex items-center gap-2">
											<span>v{version.version}</span>
											{#if version.isActive}
												<Badge variant="default" class="px-1 py-0 text-[10px]">active</Badge>
											{/if}
										</div>
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{/if}

					{#if hasUnsavedChanges}
						<Badge variant="outline" class="border-yellow-500/30 bg-yellow-500/20 text-yellow-500">
							Unsaved
						</Badge>
					{/if}

					{#if validationStatus === 'invalid'}
						<Button
							variant="outline"
							size="sm"
							class="border-destructive/30 text-destructive hover:bg-destructive/10"
							onclick={() => (showValidationPanel = !showValidationPanel)}
						>
							<CircleAlert class="mr-1 h-4 w-4" />
							{validationErrors.filter((e) => e.severity === 'error').length} Errors
						</Button>
					{:else if validationStatus === 'warning'}
						<Button
							variant="outline"
							size="sm"
							class="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
							onclick={() => (showValidationPanel = !showValidationPanel)}
						>
							<AlertTriangle class="mr-1 h-4 w-4" />
							{validationErrors.filter((e) => e.severity === 'warning').length} Warnings
						</Button>
					{/if}

					<Button onclick={handleSave} disabled={!hasUnsavedChanges || isSaving} size="sm">
						<Save class="mr-2 h-4 w-4" />
						{isSaving ? 'Saving...' : 'Save Version'}
					</Button>
				</div>
			{/if}

			<!-- Validation Errors Panel -->
			{#if showValidationPanel && validationErrors.length > 0}
				<div
					class="absolute right-4 bottom-4 left-4 z-10 max-h-48 overflow-y-auto rounded-lg border bg-background shadow-lg"
				>
					<div class="flex items-center justify-between border-b p-3">
						<div class="flex items-center gap-2">
							{#if validationStatus === 'invalid'}
								<CircleAlert class="h-5 w-5 text-destructive" />
								<span class="font-medium text-destructive">Validation Errors</span>
							{:else}
								<AlertTriangle class="h-5 w-5 text-yellow-500" />
								<span class="font-medium text-yellow-500">Warnings</span>
							{/if}
							<Badge variant="secondary" class="text-xs">
								{validationErrors.length} issue{validationErrors.length !== 1 ? 's' : ''}
							</Badge>
						</div>
						<Button
							variant="ghost"
							size="icon"
							class="h-6 w-6"
							onclick={() => (showValidationPanel = false)}
						>
							<X class="h-4 w-4" />
						</Button>
					</div>
					<div class="divide-y">
						{#each validationErrors as error}
							<button
								type="button"
								class="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50"
								onclick={() => {
									if (error.nodeId) {
										selectedNodeId = error.nodeId;
									}
								}}
							>
								{#if error.severity === 'error'}
									<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
								{:else}
									<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
								{/if}
								<div class="min-w-0 flex-1">
									<p class="text-sm">{error.message}</p>
									{#if error.nodeId || error.field}
										<p class="mt-0.5 text-xs text-muted-foreground">
											{#if error.nodeId}
												<span class="font-mono">Node: {error.nodeId}</span>
											{/if}
											{#if error.nodeId && error.field}
												<span class="mx-1">•</span>
											{/if}
											{#if error.field}
												<span class="font-mono">Field: {error.field}</span>
											{/if}
										</p>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Property Panel (Right Sidebar) -->
		{#if selectedNode && !isViewingHistory}
			<div class="h-full w-[28rem] shrink-0 overflow-hidden border-l bg-background">
				<PropertyPanel
					node={selectedNode}
					{availableModels}
					{availableTools}
					{systemUploads}
					{availablePrompts}
					{injectableAttributes}
					onUpdate={(data) => updateNodeData(selectedNode!.id, data)}
					onDelete={() => deleteNode(selectedNode!.id)}
				/>
			</div>
		{/if}
	</div>
</SvelteFlowProvider>
