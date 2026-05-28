import { SOURCE_HIERARCHY, type SourceType, type WriteDecision } from '../types/extraction';

const MIN_CONFIDENCE_THRESHOLD = 0.3;

export interface ExistingFieldMeta {
	value: string | number | boolean | string[];
	confidence: number;
	source: SourceType;
	extractionLogId: string;
	updatedAt: string;
}

export interface IncomingFieldUpdate {
	fieldKey: string;
	sectionId: string;
	value: string | number | boolean | string[];
	confidence: number;
	source: SourceType;
	extractionLogId: string;
}

function valuesMatch(
	a: string | number | boolean | string[],
	b: string | number | boolean | string[]
): boolean {
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((v, i) => v === b[i]);
	}
	return a === b;
}

export function evaluateWrite(
	incoming: IncomingFieldUpdate,
	existing: ExistingFieldMeta | null
): WriteDecision {
	const base = { fieldKey: incoming.fieldKey, sectionId: incoming.sectionId };

	// Rule 5: confidence below threshold = noise
	if (incoming.confidence < MIN_CONFIDENCE_THRESHOLD) {
		return {
			...base,
			action: 'skip',
			reason: `Confidence ${incoming.confidence} below threshold ${MIN_CONFIDENCE_THRESHOLD}`
		};
	}

	// Rule 4: first write always accepted
	if (!existing) {
		return { ...base, action: 'write', reason: 'First write to empty field' };
	}

	const incomingRank = SOURCE_HIERARCHY[incoming.source];
	const existingRank = SOURCE_HIERARCHY[existing.source];

	// Rule 1: same or higher source → overwrite allowed
	if (incomingRank >= existingRank) {
		return { ...base, action: 'write', reason: `Source ${incoming.source} >= ${existing.source}` };
	}

	// Rule 2: lower source but value agrees → update timestamp
	if (valuesMatch(incoming.value, existing.value)) {
		return {
			...base,
			action: 'update_timestamp',
			reason: `Value agrees; keeping higher source ${existing.source}`
		};
	}

	// Rule 3: lower source and value conflicts → skip
	return {
		...base,
		action: 'skip',
		reason: `Skipped: lower source ${incoming.source} conflicts with ${existing.source}`
	};
}
