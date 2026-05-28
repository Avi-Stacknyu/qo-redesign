vi.mock('@repo/db/schema', () => ({
	configProfileSchema: {
		id: 'id',
		isActive: 'isActive',
		created: 'created',
		updated: 'updated'
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((left: unknown, right: unknown) => ({ left, right }))
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	activateGlobalSchemaVersion,
	deleteInactiveGlobalSchemaVersion
} from './global-schema-operations';

function createUpdateTx() {
	const where = vi.fn(() => Promise.resolve());
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));
	return { tx: { update }, update, set, where };
}

describe('global schema remote CRUD', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('activates one schema version by deactivating the others first', async () => {
		const { tx, update, set } = createUpdateTx();
		type MockTx = typeof tx;
		const db = {
			query: { configProfileSchema: { findFirst: vi.fn().mockResolvedValue({ id: 'schema-2' }) } },
			transaction: vi.fn(async (callback: (tx: MockTx) => Promise<void>) => callback(tx))
		};

		const result = await activateGlobalSchemaVersion(
			db as never,
			'schema-2',
			'2026-05-17T00:00:00.000Z'
		);

		expect(result).toEqual({ success: true });
		expect(db.transaction).toHaveBeenCalledOnce();
		expect(update).toHaveBeenCalledTimes(2);
		expect(set).toHaveBeenNthCalledWith(1, expect.objectContaining({ isActive: false }));
		expect(set).toHaveBeenNthCalledWith(2, expect.objectContaining({ isActive: true }));
	});

	it('refuses to delete the active schema version', async () => {
		const db = {
			query: {
				configProfileSchema: {
					findFirst: vi.fn().mockResolvedValue({ id: 'schema-1', isActive: true })
				}
			},
			delete: vi.fn()
		};

		const result = await deleteInactiveGlobalSchemaVersion(db as never, 'schema-1');

		expect(result.success).toBe(false);
		expect(result.error).toContain('active');
		expect(db.delete).not.toHaveBeenCalled();
	});

	it('deletes inactive schema versions', async () => {
		const where = vi.fn(() => Promise.resolve());
		const db = {
			query: {
				configProfileSchema: {
					findFirst: vi.fn().mockResolvedValue({ id: 'schema-1', isActive: false })
				}
			},
			delete: vi.fn(() => ({ where }))
		};

		const result = await deleteInactiveGlobalSchemaVersion(db as never, 'schema-1');

		expect(result).toEqual({ success: true });
		expect(db.delete).toHaveBeenCalledOnce();
		expect(where).toHaveBeenCalledOnce();
	});
});
