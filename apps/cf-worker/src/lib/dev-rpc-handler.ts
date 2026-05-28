/**
 * Dev RPC Handler — HTTP proxy for Cloudflare Service Bindings & Durable Objects.
 *
 * In local development, SvelteKit apps cannot use direct RPC bindings
 * (CF_WORKER, FILE_SERVICE, QUANT_AGENT) because
 * cross-service bindings aren't available in `vite dev` mode.
 *
 * This handler exposes HTTP endpoints that dispatch to the real
 * bindings/DOs inside the running worker, so SvelteKit can `fetch()`
 * to them from server-side code.
 *
 * Route patterns:
 *   POST /dev-rpc/worker/:method        → WorkerEntrypoint RPC method
 *   POST /dev-rpc/file/:method          → FileServiceEntrypoint RPC method
 *   POST /dev-rpc/agent/:agentName/:method → QuantPMAgent DO method
 *
 * IMPORTANT: Only enabled when IS_DEV === 'true'. Never deploy with this active.
 */

import type { Env } from '../types';
import { createLogger, formatError } from '../utils/logger';

const log = createLogger('DevRPC');

// ---------------------------------------------------------------------------
// ArrayBuffer serialization helpers
// ---------------------------------------------------------------------------

/**
 * Recursively reconstruct ArrayBuffer values from base64-encoded transport objects.
 * Client sends: `{ __devRpcType: 'ArrayBuffer', __data: '<base64>' }`
 * Server converts back to a real ArrayBuffer.
 */
function deserializeArgs(value: unknown): unknown {
	if (value === null || value === undefined) return value;

	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>;

		// Check for our serialized ArrayBuffer marker
		if (obj.__devRpcType === 'ArrayBuffer' && typeof obj.__data === 'string') {
			// Decode base64 → Uint8Array → ArrayBuffer
			const binary = atob(obj.__data as string);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			return bytes.buffer;
		}

		// Recurse arrays
		if (Array.isArray(value)) {
			return value.map(deserializeArgs);
		}

		// Recurse plain objects
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(obj)) {
			result[key] = deserializeArgs(val);
		}
		return result;
	}

	return value;
}

// ---------------------------------------------------------------------------
// CORS headers (cross-port in local dev)
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

function corsJson(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: CORS_HEADERS });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Handle a dev-rpc request.
 *
 * @param request   The incoming HTTP request (must be POST with JSON body)
 * @param env       Worker environment bindings
 * @param path      The URL pathname (e.g. "/dev-rpc/worker/transcribeAudio")
 * @param workerRpc  A map of worker-level RPC methods (bound to `this`)
 */
export async function handleDevRpc(
	request: Request,
	env: Env,
	path: string,
	workerRpc: Record<string, (args: any) => Promise<any>>
): Promise<Response> {
	// Gate: only in dev mode
	if (env.IS_DEV !== 'true') {
		return corsJson({ error: 'Dev RPC not available in production' }, 403);
	}

	// CORS preflight
	if (request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}

	if (request.method !== 'POST') {
		return corsJson({ error: 'Method not allowed — use POST' }, 405);
	}

	try {
		const rawBody = await request.json().catch(() => ({}));
		const args = deserializeArgs(rawBody);

		// ── Worker RPC methods ───────────────────────────────────────────
		// POST /dev-rpc/worker/:method
		const workerMatch = path.match(/^\/dev-rpc\/worker\/(\w+)$/);
		if (workerMatch) {
			const method = workerMatch[1];
			const fn = workerRpc[method];
			if (!fn) return corsJson({ error: `Unknown worker method: ${method}` }, 404);
			const result = await fn(args as Record<string, unknown>);

			// Streaming responses (e.g. chatWithAgent) — pass through with CORS
			if (result instanceof Response) {
				const headers = new Headers(result.headers);
				for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
				return new Response(result.body, { status: result.status, headers });
			}

			return corsJson(result);
		}

		// ── FileService methods ──────────────────────────────────────────
		// POST /dev-rpc/file/:method
		const fileMatch = path.match(/^\/dev-rpc\/file\/(\w+)$/);
		if (fileMatch) {
			const method = fileMatch[1];
			const fileService = env.FILE_SERVICE;
			if (!fileService) return corsJson({ error: 'FILE_SERVICE binding not available' }, 500);
			const fn = (fileService as any)[method];
			if (typeof fn !== 'function')
				return corsJson({ error: `Unknown file method: ${method}` }, 404);
			const result = await (fileService as any)[method](args);
			return corsJson(result);
		}

		// ── QuantPMAgent DO methods ──────────────────────────────────────
		// POST /dev-rpc/agent/:agentName/:method
		const agentMatch = path.match(/^\/dev-rpc\/agent\/([^/]+)\/(\w+)$/);
		if (agentMatch) {
			const agentName = decodeURIComponent(agentMatch[1]);
			const method = agentMatch[2];
			const id = env.QuantPMAgent.idFromName(agentName);
			const stub = env.QuantPMAgent.get(id);

			// Chat returns a streaming Response — pass through with CORS headers
			if (method === 'chat') {
				const response: Response = await (stub as any).chat(args);
				const headers = new Headers(response.headers);
				for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
				return new Response(response.body, { status: response.status, headers });
			}

			// DO stubs use transparent RPC proxies — just call the method directly
			const result = await (stub as any)[method](args);
			return corsJson(result);
		}

		// ── Onboarding Session DO ────────────────────────────────────────
		// POST /dev-rpc/onboarding/:userId/:method
		const onboardingMatch = path.match(/^\/dev-rpc\/onboarding\/([^/]+)\/(\w+)$/);
		if (onboardingMatch) {
			const userId = decodeURIComponent(onboardingMatch[1]);
			const method = onboardingMatch[2];
			const id = env.OnboardingSessionDO.idFromName(userId);
			const stub = env.OnboardingSessionDO.get(id);

			// fetch() needs a proper Request — reconstruct from serialized parts
			if (method === 'fetch' && args && (args as any).__doFetch) {
				const {
					url,
					method: reqMethod,
					headers,
					body
				} = args as {
					url: string;
					method: string;
					headers: Record<string, string>;
					body?: string;
				};
				const doRequest = new Request(url, {
					method: reqMethod,
					headers,
					body: body ?? undefined
				});
				const doResponse = await stub.fetch(doRequest);
				const responseHeaders = new Headers(doResponse.headers);
				for (const [k, v] of Object.entries(CORS_HEADERS)) responseHeaders.set(k, v);
				return new Response(doResponse.body, {
					status: doResponse.status,
					headers: responseHeaders
				});
			}

			// Other methods use transparent RPC proxies
			const result = await (stub as any)[method](args);
			return corsJson(result);
		}

		return corsJson({ error: `Unknown dev-rpc route: ${path}` }, 404);
	} catch (error) {
		log.error('dev_rpc_error', { path, ...formatError(error) });
		return corsJson({ error: error instanceof Error ? error.message : String(error) }, 500);
	}
}
