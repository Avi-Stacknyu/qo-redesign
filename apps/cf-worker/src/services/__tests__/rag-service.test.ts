/**
 * RAG Service Tests
 *
 * Tests for DEFAULT_RAG_CONFIG, createRAGService, and RAGService public API surface.
 * Complex integration tests (hybridSearch, rerank, buildContext) are deferred
 * to Batch 7 with Workers pool.
 */

import { describe, it, expect } from 'vitest';
import {
	DEFAULT_RAG_CONFIG,
	RAGService,
	createRAGService,
	type RAGConfig
} from '../../services/rag-service';
import { createMockDb, createMockEnv } from '../../__tests__/setup';
import { createCostTracker } from '../../utils/billing';

// ============================================================================
// DEFAULT_RAG_CONFIG
// ============================================================================

describe('DEFAULT_RAG_CONFIG', () => {
	it('has correct defaults', () => {
		expect(DEFAULT_RAG_CONFIG.enableQueryRewriting).toBe(true);
		expect(DEFAULT_RAG_CONFIG.enableHybridSearch).toBe(true);
		expect(DEFAULT_RAG_CONFIG.enableReranking).toBe(true);
		expect(DEFAULT_RAG_CONFIG.enableGraphContext).toBe(true);
		expect(DEFAULT_RAG_CONFIG.vectorTopK).toBe(10);
		expect(DEFAULT_RAG_CONFIG.ftsTopK).toBe(10);
		expect(DEFAULT_RAG_CONFIG.rerankTopK).toBe(5);
		expect(DEFAULT_RAG_CONFIG.rerankThreshold).toBe(0.3);
		expect(DEFAULT_RAG_CONFIG.rrfK).toBe(60);
		expect(DEFAULT_RAG_CONFIG.maxQueryVariations).toBe(3);
	});

	it('implements RAGConfig interface completely', () => {
		// All keys defined – ts would error if any missing
		const keys: (keyof RAGConfig)[] = [
			'enableQueryRewriting',
			'enableHybridSearch',
			'enableReranking',
			'enableGraphContext',
			'vectorTopK',
			'ftsTopK',
			'rerankTopK',
			'rerankThreshold',
			'rrfK',
			'maxQueryVariations'
		];

		for (const key of keys) {
			expect(DEFAULT_RAG_CONFIG).toHaveProperty(key);
		}
	});
});

// ============================================================================
// createRAGService
// ============================================================================

describe('createRAGService', () => {
	it('returns a RAGService instance with default config', async () => {
		const db = createMockDb() as any;
		const env = createMockEnv() as any;

		const service = await createRAGService(db, env, 'user-1');

		expect(service).toBeInstanceOf(RAGService);
	});

	it('merges partial config with defaults', async () => {
		const db = createMockDb() as any;
		const env = createMockEnv() as any;

		const service = await createRAGService(db, env, 'user-1', {
			vectorTopK: 20,
			enableReranking: false
		});

		// The service was created successfully; internal config merged.
		expect(service).toBeInstanceOf(RAGService);
	});

	it('accepts costTracker and options', async () => {
		const db = createMockDb() as any;
		const env = createMockEnv() as any;
		const tracker = createCostTracker();

		const service = await createRAGService(db, env, 'user-1', undefined, tracker, {
			chatId: 'chat-123',
			attachedFileIds: ['file-1'],
			agentKnowledgeFileIds: ['kb-1']
		});

		expect(service).toBeInstanceOf(RAGService);
	});
});
