/**
 * Ambient type declarations for Cloudflare Workers pool tests.
 *
 * This file provides type information for `cloudflare:test` imports
 * used in *.workers.test.ts files. It is referenced by tsconfig.workers.json.
 *
 * @see https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/
 */

import '../worker-configuration.d.ts';

declare module 'cloudflare:test' {
	// Use the existing Env type from worker-configuration.d.ts
	interface ProvidedEnv extends Env {}
}
