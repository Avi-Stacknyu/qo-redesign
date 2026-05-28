/**
 * Shared Test Mocks & Utilities
 *
 * Provides mock factories for Drizzle DB, Env bindings, and AI SDK responses.
 * Import these in test files to avoid boilerplate setup.
 */

import { vi } from 'vitest';
import type { Env } from '../types';

// ============================================================================
// Mock Drizzle DB
// ============================================================================

export function createMockDb() {
	const db: any = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		groupBy: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn().mockResolvedValue([]),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		execute: vi.fn().mockResolvedValue([]),
		// Thenable — makes `await db.select().from().where()...` resolve correctly
		// Override in tests: db.then.mockImplementation((r) => r([...data...]))
		// For rejections: db.then.mockImplementation((_r, rej) => rej(new Error(...)))
		then: vi.fn((resolve: any, _reject?: any) => resolve([]))
	};

	function normalizeRelationalRow(row: any) {
		if (row?.model && row?.provider) {
			return { ...row.model, aiProvider: row.provider };
		}
		return row;
	}

	function createRelationalQueryMock() {
		return {
			findFirst: vi.fn(async () => {
				db.select();
				const rows = await new Promise<any[]>((resolve, reject) => db.then(resolve, reject));
				return Array.isArray(rows) && rows.length > 0 ? normalizeRelationalRow(rows[0]) : null;
			}),
			findMany: vi.fn(async () => {
				db.select();
				const rows = await new Promise<any[]>((resolve, reject) => db.then(resolve, reject));
				return Array.isArray(rows) ? rows.map(normalizeRelationalRow) : [];
			})
		};
	}

	db.query = new Proxy(
		{},
		{
			get(target: Record<string, ReturnType<typeof createRelationalQueryMock>>, prop: string) {
				if (!(prop in target)) target[prop] = createRelationalQueryMock();
				return target[prop];
			}
		}
	);

	return db;
}

// ============================================================================
// Mock Env Bindings
// ============================================================================

export function createMockEnv(): Partial<Env> {
	return {
		AI: {
			run: vi.fn(),
			toMarkdown: vi.fn()
		} as any,
		DOCUMENT_CHUNKS: {
			query: vi.fn().mockResolvedValue({ matches: [] }),
			upsert: vi.fn().mockResolvedValue(undefined),
			deleteByIds: vi.fn().mockResolvedValue(undefined),
			describe: vi.fn().mockResolvedValue({})
		} as any,
		GRAPH_NODES: {
			query: vi.fn().mockResolvedValue({ matches: [] }),
			upsert: vi.fn().mockResolvedValue(undefined),
			deleteByIds: vi.fn().mockResolvedValue(undefined),
			describe: vi.fn().mockResolvedValue({})
		} as any,
		DOCUMENTS_BUCKET: {
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
			list: vi.fn().mockResolvedValue({ objects: [] })
		} as any,
		OPENAI_API_KEY: 'test-openai-key',
		ANTHROPIC_API_KEY: 'test-anthropic-key',
		GOOGLE_AI_API_KEY: 'test-google-key',
		XAI_API_KEY: 'test-xai-key',
		FILE_HOST_URL: 'http://localhost:8090'
	} as unknown as Partial<Env>;
}
