/** Color maps and helpers shared by MemoryGraph and MemoryGraphDetail. */

export const nodeTypeColors: Record<string, string> = {
	USER: '#3b82f6',
	AGENT: '#f97316',
	SESSION: '#22c55e',
	DOCUMENT: '#a855f7',
	FACT: '#eab308',
	ENTITY: '#06b6d4',
	TOPIC: '#6b7280',
	INSIGHT: '#ef4444',
	ACTION_ITEM: '#f59e0b',
	NOTE: '#8b5cf6',
	TODO: '#3b82f6',
	REMINDER: '#10b981',
	FILE_REF: '#94a3b8'
};

export const edgeTypeColors: Record<string, string> = {
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

export function getNodeColor(type: string): string {
	return nodeTypeColors[type] || '#6b7280';
}

export function getEdgeColor(rel: string): string {
	return edgeTypeColors[rel] || '#6b7280';
}

export function getNodeLabel(node: { data: Record<string, unknown>; type: string }): string {
	const label = String(
		node.data.name || node.data.text || node.data.summary || node.data.title || node.type
	);
	return label.length > 20 ? label.slice(0, 20) + '...' : label;
}
