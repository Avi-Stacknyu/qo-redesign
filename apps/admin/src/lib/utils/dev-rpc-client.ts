/**
 * Dev RPC Client — transparent HTTP fallback for Cloudflare bindings.
 *
 * In production, SvelteKit accesses the CF-Worker, FileService, and Durable
 * Objects via Cloudflare Service Bindings (direct RPC — zero network overhead).
 * In local development (`vite dev`), those bindings aren't available, so this
 * module provides Proxy-based shims that route calls through HTTP to the
 * worker's `/dev-rpc/*` endpoints instead.
 *
 * Usage (hooks.server.ts):
 *   if (dev && !event.platform?.env?.CF_WORKER) {
 *     event.platform = createDevPlatform();
 *   }
 *
 * Nothing else needs to change — all existing remote functions continue to
 * call `platform.env.CF_WORKER.someMethod(args)` and it works in both modes.
 */

const DEV_WORKER_URL = 'http://localhost:8787';

// ---------------------------------------------------------------------------
// ArrayBuffer → base64 serialisation  (client → worker)
// ---------------------------------------------------------------------------

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Recursively walk args and convert any ArrayBuffer values into a
 * transport-safe `{ __devRpcType: 'ArrayBuffer', __data: base64 }` shape.
 */
function serializeArgs(value: unknown): unknown {
	if (value === null || value === undefined) return value;

	if (value instanceof ArrayBuffer) {
		return { __devRpcType: 'ArrayBuffer', __data: arrayBufferToBase64(value) };
	}

	if (ArrayBuffer.isView(value)) {
		const buf =
			value.buffer instanceof ArrayBuffer
				? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
				: new ArrayBuffer(0);
		return {
			__devRpcType: 'ArrayBuffer',
			__data: arrayBufferToBase64(buf)
		};
	}

	if (Array.isArray(value)) {
		return value.map(serializeArgs);
	}

	if (typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			result[key] = serializeArgs(val);
		}
		return result;
	}

	return value;
}

// ---------------------------------------------------------------------------
// Generic HTTP-based method proxy
// ---------------------------------------------------------------------------

/**
 * Make a POST to the worker's dev-rpc endpoint and return the result.
 * If the response is a streaming type (SSE / octet-stream), the raw
 * Response object is returned so callers can read the body as a stream.
 */
async function devRpcCall(urlPath: string, args: unknown): Promise<unknown> {
	const url = `${DEV_WORKER_URL}${urlPath}`;
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(serializeArgs(args ?? {}))
	});

	// Streaming responses (agent chat SSE) — return the raw Response
	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('text/event-stream') || contentType.includes('octet-stream')) {
		return response;
	}

	// Regular JSON responses
	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: response.statusText }));
		throw new Error((error as any).error ?? `Dev RPC failed: ${response.status}`);
	}

	return response.json();
}

// ---------------------------------------------------------------------------
// Proxy factories matching Cloudflare binding interfaces
// ---------------------------------------------------------------------------

/**
 * Creates a Proxy that implements the Service<OrionWorkerRpc> interface.
 * Every method call → POST /dev-rpc/worker/:method
 *
 * Special case: `.fetch(url, init)` forwards the full HTTP request to the
 * worker at localhost:8787, rewriting the URL but preserving headers/body.
 * This is needed because Cloudflare Service Bindings expose `.fetch()` to
 * forward requests to the bound worker's `fetch()` handler.
 */
function createWorkerProxy(): unknown {
	return new Proxy(
		{},
		{
			get(_, method) {
				if (typeof method !== 'string') return undefined;

				// .fetch() forwards the full HTTP request to the worker
				if (method === 'fetch') {
					return async (input: string | Request, init?: RequestInit) => {
						// Rewrite the URL to point to the local worker dev server
						const originalUrl = typeof input === 'string' ? input : input.url;
						const parsed = new URL(originalUrl);
						const localUrl = `${DEV_WORKER_URL}${parsed.pathname}${parsed.search}`;
						return fetch(localUrl, init ?? (typeof input !== 'string' ? input : undefined));
					};
				}

				return (args: unknown) => devRpcCall(`/dev-rpc/worker/${method}`, args);
			}
		}
	);
}

/**
 * Creates a Proxy that implements the Service<FileServiceRpc> interface.
 * Every method call → POST /dev-rpc/file/:method
 */
function createFileServiceProxy(): unknown {
	return new Proxy(
		{},
		{
			get(_, method) {
				if (typeof method !== 'string') return undefined;
				return (args: unknown) => devRpcCall(`/dev-rpc/file/${method}`, args);
			}
		}
	);
}

/**
 * Creates a Proxy that mimics DurableObjectNamespace<QuantPMAgentRpc>.
 *
 *   namespace.idFromName(agentName) → returns agentName
 *   namespace.get(id) → returns a stub Proxy whose methods POST to
 *                        /dev-rpc/agent/:agentName/:method
 */
function createAgentNamespaceProxy(): unknown {
	return {
		idFromName(name: string) {
			return name;
		},
		get(id: string | { toString(): string }) {
			const agentName = String(id);
			return new Proxy(
				{},
				{
					get(_, method) {
						if (typeof method !== 'string') return undefined;
						return (args: unknown) =>
							devRpcCall(`/dev-rpc/agent/${encodeURIComponent(agentName)}/${method}`, args);
					}
				}
			);
		}
	};
}

/**
 * Creates a Proxy for the OnboardingSessionDO namespace.
 */
function createOnboardingNamespaceProxy(): unknown {
	return {
		idFromName(name: string) {
			return name;
		},
		get(id: string | { toString(): string }) {
			const userId = String(id);
			return new Proxy(
				{},
				{
					get(_, method) {
						if (typeof method !== 'string') return undefined;
						return (args: unknown) =>
							devRpcCall(`/dev-rpc/onboarding/${encodeURIComponent(userId)}/${method}`, args);
					}
				}
			);
		}
	};
}

// ---------------------------------------------------------------------------
// Public API – called from hooks.server.ts
// ---------------------------------------------------------------------------

/**
 * Build a fake `App.Platform` with HTTP-backed binding proxies.
 *
 * The returned object matches the shape that remote functions expect:
 * ```
 *   platform.env.CF_WORKER.someMethod(args)
 *   platform.env.FILE_SERVICE.uploadFileBuffer(args)
 *   platform.env.QUANT_AGENT.idFromName(agentName)
 * ```
 */
export function createDevPlatformEnv(): Record<string, unknown> {
	return {
		SEND_EMAIL: {
			send: async () => ({ dev: true })
		},
		CF_WORKER: createWorkerProxy(),
		FILE_SERVICE: createFileServiceProxy(),
		QUANT_AGENT: createAgentNamespaceProxy(),
		ONBOARDING_SESSION: createOnboardingNamespaceProxy(),
		// AI, R2, Vectorize bindings are not proxied — they're only used by the worker internally
		AI: null,
		DOCUMENTS_BUCKET: null,
		DOCUMENT_CHUNKS: null,
		GRAPH_NODES: null
	};
}
