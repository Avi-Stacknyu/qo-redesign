/**
 * Vitest configuration for Cloudflare Workers pool tests.
 *
 * These tests run inside the Workers runtime via @cloudflare/vitest-pool-workers
 * and can test Durable Objects, WorkerEntrypoints, and Workflows.
 *
 * Prerequisites:
 * 1. Set CLOUDFLARE_ACCOUNT_ID in your environment (or wrangler.jsonc)
 * 2. Run: pnpm test:workers
 *
 * @see https://developers.cloudflare.com/workers/testing/vitest-integration/
 */

import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: {
				configPath: './wrangler.jsonc'
			}
		})
	],
	test: {
		include: ['src/**/__tests__/**/*.workers.test.ts'],
		globals: false,
		typecheck: {
			tsconfig: './tsconfig.workers.json'
		}
	}
});