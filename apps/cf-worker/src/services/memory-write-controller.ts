import type { MemoryObservation } from '../types/extraction';

export interface GraphNodeInput {
	id: string;
	type: string;
	data: Record<string, unknown>;
	confidence: number;
	decayScore?: number;
}

export async function generateDeterministicNodeId(
	userId: string,
	nodeType: string,
	text: string
): Promise<string> {
	const input = `${userId}::${nodeType}::${text}`;
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hash = await crypto.subtle.digest('SHA-256', data);
	const bytes = new Uint8Array(hash);
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < 15; i++) {
		id += chars[bytes[i] % chars.length];
	}
	return id;
}

export function buildGraphNode(
	userId: string,
	observation: MemoryObservation,
	extractionLogId: string
): GraphNodeInput {
	return {
		id: '', // placeholder — set by caller after generateDeterministicNodeId
		type: observation.nodeType,
		data: {
			text: observation.text,
			...(observation.title && { title: observation.title, name: observation.title }),
			...(observation.category && { category: observation.category }),
			...(observation.groupKey && { groupKey: observation.groupKey }),
			...observation.data,
			source: `extraction::${extractionLogId}`,
			hidden_from_agent: !observation.visibility.shareWithAgent,
			share_with_manager: observation.visibility.shareWithManager
		},
		confidence: observation.confidence
	};
}

export function shouldSkipDuplicate(
	existing: { confidence: number; data: Record<string, unknown> } | null,
	incomingConfidence: number
): boolean {
	if (!existing) return false;
	return existing.confidence >= incomingConfidence;
}
