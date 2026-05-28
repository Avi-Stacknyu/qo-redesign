// apps/cf-worker/src/types/extraction.ts
import type { z } from 'zod/v4';

// ── Error Classification ─────────────────────────────────────────────────

export type ErrorCategory =
	| 'rate_limit'
	| 'auth'
	| 'provider_down'
	| 'context_length'
	| 'content_filter'
	| 'timeout'
	| 'structured_output_unsupported'
	| 'unknown';

// ── Model Chain ──────────────────────────────────────────────────────────

export interface ModelChainEntry {
	id: string;
	profilerAgentId: string;
	modelId: string;
	provider: string;
	displayName: string;
	priority: number;
	temperature: number;
	maxTokens: number;
	timeoutMs: number;
	retryCount: number;
	isActive: boolean;
	pricingRateId: string | null;
}

// ── Extraction Attempt ───────────────────────────────────────────────────

export interface ExtractionAttempt {
	modelId: string;
	provider: string;
	priority: number;
	attempt: number;
	durationMs: number;
	tokenCountInput: number;
	tokenCountOutput: number;
	costUsd: number;
	status: 'success' | 'retry' | 'skipped' | 'failed';
	errorCategory?: ErrorCategory;
	errorMessage?: string;
}

// ── Write Controller Types ───────────────────────────────────────────────

export type SourceType = 'user_edit' | 'onboarding' | 'chat_confirmed' | 'chat';

export const SOURCE_HIERARCHY: Record<SourceType, number> = {
	user_edit: 1.0,
	onboarding: 0.95,
	chat_confirmed: 0.9,
	chat: 0.5
};

export interface ProfileFieldMeta {
	value: string | number | boolean | string[];
	label: string;
	confidence: number;
	source: SourceType;
	extractionLogId: string;
	isSchema: boolean;
	updatedAt: string;
}

export interface WriteDecision {
	action: 'write' | 'skip' | 'update_timestamp';
	reason: string;
	fieldKey: string;
	sectionId: string;
}

// ── Extraction Log ───────────────────────────────────────────────────────

export interface ExtractionLogEntry {
	id: string;
	userId: string;
	profilerAgentId: string | null;
	sourceType: 'chat' | 'onboarding' | 'document';
	sourceMessageIds: string[];
	modelUsed: string;
	providerUsed: string;
	rawOutput: unknown;
	profileFieldsWritten: WriteDecision[];
	profileFieldsSkipped: WriteDecision[];
	memoryNodesWritten: string[];
	memoryNodesSkipped: string[];
	schemaProposals: unknown[];
	attempts: ExtractionAttempt[];
	extractionDurationMs: number;
	tokenCountInput: number;
	tokenCountOutput: number;
	costUsd: number;
}

// ── Structured Extraction Output (matches Zod schema shape) ─────────────

export interface ProfileUpdateField {
	value: string | number | boolean | string[];
	label?: string;
	confidence: number;
	reasoning: string;
}

export interface ProfileUpdate {
	sectionId: string;
	sectionLabel?: string;
	icon?: string;
	order?: number;
	fields: Record<string, ProfileUpdateField>;
}

export interface MemoryObservation {
	nodeType: 'FACT' | 'ENTITY' | 'TOPIC' | 'INSIGHT' | 'ACTION_ITEM';
	groupKey?: string;
	title?: string;
	text: string;
	category?: string;
	data: Record<string, unknown>;
	confidence: number;
	visibility: {
		shareWithAgent: boolean;
		shareWithManager: boolean;
		shareWithAdmin: boolean;
	};
}

export interface SchemaProposal {
	suggestedKey: string;
	suggestedSection: string;
	label: string;
	reason: string;
	confidence: number;
}

export interface StructuredExtractionOutput {
	profileUpdates: ProfileUpdate[];
	memoryObservations: MemoryObservation[];
	schemaProposals: SchemaProposal[];
}
