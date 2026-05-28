/**
 * Flow Executor Tests
 *
 * Tests for loadUserConfig and FlowExecutor execute flow.
 */

import { describe, it, expect, vi } from 'vitest';
import { loadUserConfig } from '../../agent/flow-executor';
import { createMockDb } from '../../__tests__/setup';

// ============================================================================
// loadUserConfig
// ============================================================================

describe('loadUserConfig', () => {
	it('maps user customization records to UserConfig', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([
				{ key: 'ai_agent_personality', value: 'Be concise and professional' },
				{ key: 'timezone', value: 'America/New_York' },
				{ key: 'location', value: 'New York, NY' },
				{ key: 'locale', value: 'en-US' },
				{ key: 'custom_pref', value: 'dark_mode' }
			])
		);

		const config = await loadUserConfig(db as any, 'user-123');

		expect(config.personality).toBe('Be concise and professional');
		expect(config.timezone).toBe('America/New_York');
		expect(config.location).toBe('New York, NY');
		expect(config.locale).toBe('en-US');
		expect(config.preferences?.custom_pref).toBe('dark_mode');
	});

	it('returns empty config on DB failure', async () => {
		const db = createMockDb();
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		db.then.mockImplementation((_resolve: any, reject: any) => reject(new Error('DB down')));

		const config = await loadUserConfig(db as any, 'user-123');

		expect(config).toEqual({});
		spy.mockRestore();
	});

	it('handles non-string personality as markdown', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) =>
			resolve([{ key: 'ai_agent_personality', value: { tone: 'formal' } }])
		);

		const config = await loadUserConfig(db as any, 'user-123');
		expect(config.personality).toBe('- Tone: formal');
	});

	it('returns empty preferences when no extra keys', async () => {
		const db = createMockDb();
		db.then.mockImplementation((resolve: any) => resolve([{ key: 'timezone', value: 'UTC' }]));

		const config = await loadUserConfig(db as any, 'user-123');
		expect(config.personality).toBeUndefined();
		expect(config.preferences).toBeUndefined();
	});

	it('handles empty records', async () => {
		const db = createMockDb();
		// Default: then resolves to []

		const config = await loadUserConfig(db as any, 'user-123');
		expect(config).toEqual({});
	});
});

// ============================================================================
// FlowExecutor.execute - Integration-style tests
//
// These test the full execute() path but require vi.mock for AI SDK.
// Since vi.mock in this context is complex with Workers modules,
// focus on exported helpers and constructor validation.
// Full integration tests will go in Batch 7 with Workers pool.
// ============================================================================

describe('FlowExecutor', () => {
	it('module exports FlowExecutor class', async () => {
		const mod = await import('../../agent/flow-executor');
		expect(mod.FlowExecutor).toBeDefined();
		expect(mod.createFlowExecutor).toBeDefined();
	});
});
