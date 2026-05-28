import { describe, it, expect } from 'vitest';
import {
	buildLogEntry,
	summarizeAttempts,
	type ExtractionLogInput
} from '../services/extraction-ledger';

describe('ExtractionLedgerService', () => {
	describe('buildLogEntry', () => {
		it('creates a valid log entry from extraction input', () => {
			const input: ExtractionLogInput = {
				userId: 'user_1',
				profilerAgentId: 'profiler_1',
				sourceType: 'chat',
				sourceMessageIds: ['msg_1', 'msg_2'],
				modelUsed: 'claude-sonnet-4-20250514',
				providerUsed: 'anthropic',
				rawOutput: { profileUpdates: [], memoryObservations: [] },
				profileFieldsWritten: [],
				profileFieldsSkipped: [],
				memoryNodesWritten: [],
				memoryNodesSkipped: [],
				schemaProposals: [],
				attempts: [
					{
						modelId: 'claude-sonnet-4-20250514',
						provider: 'anthropic',
						priority: 0,
						attempt: 1,
						durationMs: 1200,
						tokenCountInput: 500,
						tokenCountOutput: 200,
						costUsd: 0.003,
						status: 'success'
					}
				],
				extractionDurationMs: 1200,
				tokenCountInput: 500,
				tokenCountOutput: 200,
				costUsd: 0.003
			};

			const entry = buildLogEntry(input);

			expect(entry.id).toHaveLength(15);
			expect(entry.userId).toBe('user_1');
			expect(entry.sourceType).toBe('chat');
			expect(entry.attempts).toHaveLength(1);
			expect(entry.costUsd).toBe(0.003);
		});
	});

	describe('summarizeAttempts', () => {
		it('aggregates tokens and cost across multiple attempts', () => {
			const attempts = [
				{
					modelId: 'm1',
					provider: 'anthropic',
					priority: 0,
					attempt: 1,
					durationMs: 500,
					tokenCountInput: 100,
					tokenCountOutput: 50,
					costUsd: 0.001,
					status: 'failed' as const,
					errorCategory: 'timeout' as const
				},
				{
					modelId: 'm2',
					provider: 'openai',
					priority: 1,
					attempt: 1,
					durationMs: 800,
					tokenCountInput: 100,
					tokenCountOutput: 60,
					costUsd: 0.002,
					status: 'success' as const
				}
			];

			const summary = summarizeAttempts(attempts);

			expect(summary.totalDurationMs).toBe(1300);
			expect(summary.totalTokensInput).toBe(200);
			expect(summary.totalTokensOutput).toBe(110);
			expect(summary.totalCostUsd).toBeCloseTo(0.003);
			expect(summary.successModel).toBe('m2');
			expect(summary.successProvider).toBe('openai');
		});

		it('returns null model when all attempts fail', () => {
			const attempts = [
				{
					modelId: 'm1',
					provider: 'anthropic',
					priority: 0,
					attempt: 1,
					durationMs: 500,
					tokenCountInput: 100,
					tokenCountOutput: 0,
					costUsd: 0,
					status: 'failed' as const,
					errorCategory: 'auth' as const
				}
			];

			const summary = summarizeAttempts(attempts);
			expect(summary.successModel).toBeNull();
		});
	});
});
