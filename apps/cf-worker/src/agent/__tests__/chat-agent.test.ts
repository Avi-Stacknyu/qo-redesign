/**
 * Chat Agent Tests
 *
 * Tests for QuantPMAgent module export and types.
 * QuantPMAgent imports from cloudflare:workers (Agent API) which is not
 * available in standard vitest. Full DO tests require Workers pool (Batch 7).
 */

import { describe, it, expect } from 'vitest';

describe('QuantPMAgent', () => {
	it.skip('module exports QuantPMAgent class (requires Workers pool)', async () => {
		const mod = await import('../../agent/chat-agent');
		expect(mod.QuantPMAgent).toBeDefined();
	});
});
