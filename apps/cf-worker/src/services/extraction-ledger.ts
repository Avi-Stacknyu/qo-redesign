import { generateId } from '@repo/db/id';
import type {
	ExtractionAttempt,
	ExtractionLogEntry,
	WriteDecision,
	SchemaProposal
} from '../types/extraction';

export interface ExtractionLogInput {
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
	schemaProposals: SchemaProposal[];
	attempts: ExtractionAttempt[];
	extractionDurationMs: number;
	tokenCountInput: number;
	tokenCountOutput: number;
	costUsd: number;
}

export interface AttemptSummary {
	totalDurationMs: number;
	totalTokensInput: number;
	totalTokensOutput: number;
	totalCostUsd: number;
	successModel: string | null;
	successProvider: string | null;
}

export function buildLogEntry(input: ExtractionLogInput): ExtractionLogEntry {
	return {
		id: generateId(),
		userId: input.userId,
		profilerAgentId: input.profilerAgentId,
		sourceType: input.sourceType,
		sourceMessageIds: input.sourceMessageIds,
		modelUsed: input.modelUsed,
		providerUsed: input.providerUsed,
		rawOutput: input.rawOutput,
		profileFieldsWritten: input.profileFieldsWritten,
		profileFieldsSkipped: input.profileFieldsSkipped,
		memoryNodesWritten: input.memoryNodesWritten,
		memoryNodesSkipped: input.memoryNodesSkipped,
		schemaProposals: input.schemaProposals,
		attempts: input.attempts,
		extractionDurationMs: input.extractionDurationMs,
		tokenCountInput: input.tokenCountInput,
		tokenCountOutput: input.tokenCountOutput,
		costUsd: input.costUsd
	};
}

export function summarizeAttempts(attempts: ExtractionAttempt[]): AttemptSummary {
	let totalDurationMs = 0;
	let totalTokensInput = 0;
	let totalTokensOutput = 0;
	let totalCostUsd = 0;
	let successModel: string | null = null;
	let successProvider: string | null = null;

	for (const a of attempts) {
		totalDurationMs += a.durationMs;
		totalTokensInput += a.tokenCountInput;
		totalTokensOutput += a.tokenCountOutput;
		totalCostUsd += a.costUsd;
		if (a.status === 'success') {
			successModel = a.modelId;
			successProvider = a.provider;
		}
	}

	return {
		totalDurationMs,
		totalTokensInput,
		totalTokensOutput,
		totalCostUsd,
		successModel,
		successProvider
	};
}
