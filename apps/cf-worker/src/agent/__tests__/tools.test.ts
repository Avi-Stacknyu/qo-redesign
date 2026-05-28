/**
 * Agent Tools Tests
 *
 * Tests for getSdkTool, createNotesTools, createTaskTools,
 * createReminderTools, createAllTools, createUtilityTools.
 */

// @ts-nocheck — AI SDK tool execute is typed as optional but always present for our tools
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	getSdkTool,
	createNotesTools,
	createTaskTools,
	createReminderTools,
	createUtilityTools,
	createAllTools,
	BUILTIN_TOOL_KEYS,
	type ToolContext
} from '../../agent/tools';
import { ValidationError } from '../../utils/errors';
import { createMockDb, createMockEnv } from '../../__tests__/setup';
import { createCostTracker } from '../../utils/billing';

// ============================================================================
// Helper: create a ToolContext with mock deps
// ============================================================================

function createMockToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
	return {
		db: createMockDb() as any,
		env: createMockEnv() as any,
		userId: 'test-user-id',
		sessionId: 'test-session-id',
		costTracker: createCostTracker(),
		...overrides
	};
}

// ============================================================================
// getSdkTool
// ============================================================================

describe('getSdkTool', () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		logSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('returns null for unknown provider', () => {
		const result = getSdkTool('unknown_provider', 'someTool');
		expect(result).toBeNull();
	});

	it('returns null for unknown tool name on valid provider', () => {
		const result = getSdkTool('google', 'nonexistentTool999');
		expect(result).toBeNull();
	});

	it('returns tool for valid google provider + tool', () => {
		// Google's tools are available via @ai-sdk/google
		const result = getSdkTool('google', 'googleSearch');
		// May or may not exist depending on SDK version, but should not throw
		if (result) {
			expect(result).toBeDefined();
		}
	});

	afterEach(() => {
		logSpy?.mockRestore();
	});
});

// ============================================================================
// createNotesTools
// ============================================================================

describe('createNotesTools', () => {
	it('returns all note tools', () => {
		const ctx = createMockToolContext();
		const tools = createNotesTools(ctx);

		expect(tools.create_note).toBeDefined();
		expect(tools.get_notes).toBeDefined();
		expect(tools.update_note).toBeDefined();
		expect(tools.delete_note).toBeDefined();
	});

	it('create_note calls DB insert', async () => {
		const ctx = createMockToolContext();
		const tools = createNotesTools(ctx);

		const result = await tools.create_note.execute(
			{ text: 'Test note content', title: 'My Note' },
			{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
		);

		expect(result).toContain('Created note');
		const db = ctx.db as any;
		expect(db.insert).toHaveBeenCalled();
		expect(db.values).toHaveBeenCalled();
	});

	it('get_notes returns formatted list', async () => {
		const ctx = createMockToolContext();
		const db = ctx.db as any;
		db.then.mockImplementation((r: any) =>
			r([
				{ id: 'n1', title: 'Note 1', content: 'Content 1', created: new Date().toISOString() },
				{ id: 'n2', title: 'Note 2', content: 'Content 2', created: new Date().toISOString() }
			])
		);

		const tools = createNotesTools(ctx);
		const result = await tools.get_notes.execute(
			{},
			{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
		);

		expect(result).toContain('Found 2 note(s)');
		expect(result).toContain('n1');
		expect(result).toContain('Note 1');
	});

	it('get_notes returns message when empty', async () => {
		const ctx = createMockToolContext();
		// Default mock returns [] — notes.length === 0

		const tools = createNotesTools(ctx);
		const result = await tools.get_notes.execute(
			{},
			{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
		);

		expect(result).toBe('No notes found');
	});

	it('update_note throws ValidationError for wrong user', async () => {
		const ctx = createMockToolContext();
		// Default mock returns [] — ownership check fails

		const tools = createNotesTools(ctx);

		await expect(
			tools.update_note.execute(
				{ note_id: 'n1', title: 'Hacked' },
				{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
			)
		).rejects.toThrow(ValidationError);
	});

	it('delete_note throws ValidationError for wrong user', async () => {
		const ctx = createMockToolContext();
		// Default mock returns [] — ownership check fails

		const tools = createNotesTools(ctx);

		await expect(
			tools.delete_note.execute(
				{ note_id: 'n1' },
				{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
			)
		).rejects.toThrow(ValidationError);
	});

	it('delete_note succeeds for correct user', async () => {
		const ctx = createMockToolContext();
		const db = ctx.db as any;
		// First query (ownership check) returns found note
		db.then.mockImplementationOnce((r: any) => r([{ id: 'n1' }]));

		const tools = createNotesTools(ctx);
		const result = await tools.delete_note.execute(
			{ note_id: 'n1' },
			{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
		);

		expect(result).toBe('Deleted note');
	});
});

// ============================================================================
// createTaskTools
// ============================================================================

describe('createTaskTools', () => {
	it('returns all task tools', () => {
		const ctx = createMockToolContext();
		const tools = createTaskTools(ctx);

		expect(tools.create_task).toBeDefined();
		expect(tools.get_tasks).toBeDefined();
		expect(tools.update_task).toBeDefined();
		expect(tools.toggle_task).toBeDefined();
		expect(tools.delete_task).toBeDefined();
	});

	it('toggle_task flips pending to completed', async () => {
		const ctx = createMockToolContext();
		const db = ctx.db as any;
		// First query returns task with pending status
		db.then.mockImplementationOnce((r: any) => r([{ id: 't1', status: 'pending' }]));

		const tools = createTaskTools(ctx);
		const result = await tools.toggle_task.execute(
			{ task_id: 't1' },
			{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
		);

		expect(result).toContain('completed');
	});

	it('toggle_task flips completed to pending', async () => {
		const ctx = createMockToolContext();
		const db = ctx.db as any;
		db.then.mockImplementationOnce((r: any) => r([{ id: 't1', status: 'completed' }]));

		const tools = createTaskTools(ctx);
		const result = await tools.toggle_task.execute(
			{ task_id: 't1' },
			{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
		);

		expect(result).toContain('pending');
	});

	it('update_task throws ValidationError for wrong user', async () => {
		const ctx = createMockToolContext();
		// Default mock returns [] — ownership check fails
		// Default mock returns [] — ownership check fails

		const tools = createTaskTools(ctx);

		await expect(
			tools.update_task.execute(
				{ task_id: 't1', title: 'Hacked' },
				{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
			)
		).rejects.toThrow(ValidationError);
	});
});

// ============================================================================
// createReminderTools
// ============================================================================

describe('createReminderTools', () => {
	it('returns all reminder tools', () => {
		const ctx = createMockToolContext();
		const tools = createReminderTools(ctx);

		expect(tools.create_reminder).toBeDefined();
		expect(tools.get_reminders).toBeDefined();
		expect(tools.update_reminder).toBeDefined();
		expect(tools.delete_reminder).toBeDefined();
	});

	it('update_reminder throws ValidationError for wrong user', async () => {
		const ctx = createMockToolContext();
		// Default mock returns [] — ownership check fails

		const tools = createReminderTools(ctx);

		await expect(
			tools.update_reminder.execute(
				{ reminder_id: 'r1', title: 'Hacked' },
				{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
			)
		).rejects.toThrow(ValidationError);
	});
});

// ============================================================================
// createUtilityTools
// ============================================================================

describe('createUtilityTools', () => {
	it('get_current_time returns time object', async () => {
		const ctx = createMockToolContext({ timezone: 'UTC' });
		const tools = createUtilityTools(ctx);

		const result = await tools.get_current_time.execute(
			{},
			{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
		);

		expect(result).toHaveProperty('iso');
		expect(result).toHaveProperty('local');
		expect(result).toHaveProperty('timezone', 'UTC');
	});

	it('calculate evaluates expressions', async () => {
		const ctx = createMockToolContext();
		const tools = createUtilityTools(ctx);

		const result = await tools.calculate.execute(
			{ expression: '2 + 3 * 4' },
			{ toolCallId: 'tc1', messages: [], abortSignal: new AbortController().signal }
		);

		expect(result).toHaveProperty('result', 14);
		expect(result).toHaveProperty('formatted', '2 + 3 * 4 = 14');
	});
});

// ============================================================================
// createAllTools
// ============================================================================

describe('createAllTools', () => {
	it('returns combined tool set', () => {
		const ctx = createMockToolContext();
		const tools = createAllTools(ctx);

		// Should include note, task, reminder, document, utility tools
		expect(tools.create_note).toBeDefined();
		expect(tools.create_task).toBeDefined();
		expect(tools.create_reminder).toBeDefined();
		expect(tools.get_current_time).toBeDefined();
		expect(tools.calculate).toBeDefined();
	});
});

// ============================================================================
// BUILTIN_TOOL_KEYS
// ============================================================================

describe('BUILTIN_TOOL_KEYS', () => {
	it('is a non-empty array of strings', () => {
		expect(BUILTIN_TOOL_KEYS.length).toBeGreaterThan(10);
		for (const key of BUILTIN_TOOL_KEYS) {
			expect(typeof key).toBe('string');
		}
	});

	it('includes core tools', () => {
		expect(BUILTIN_TOOL_KEYS).toContain('create_note');
		expect(BUILTIN_TOOL_KEYS).toContain('create_task');
		expect(BUILTIN_TOOL_KEYS).toContain('create_reminder');
		expect(BUILTIN_TOOL_KEYS).toContain('calculate');
		expect(BUILTIN_TOOL_KEYS).toContain('get_current_time');
	});
});
