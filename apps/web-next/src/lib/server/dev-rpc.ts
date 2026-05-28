/**
 * Dev RPC Client — transparent HTTP fallback for Cloudflare bindings.
 *
 * In production, SvelteKit accesses the CF-Worker, FileService, and Durable
 * Objects via Cloudflare Service Bindings (direct RPC — zero network overhead).
 * In local development (`vite dev`), those bindings aren't available, so this
 * module provides Proxy-based shims that route calls through HTTP to the
 * worker's `/dev-rpc/*` endpoints instead.
 */

const DEV_WORKER_URL = 'http://localhost:8787';

// ── Serialisation helpers ────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/** Recursively convert ArrayBuffer values into a transport-safe shape. */
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
		return { __devRpcType: 'ArrayBuffer', __data: arrayBufferToBase64(buf) };
	}

	if (Array.isArray(value)) return value.map(serializeArgs);

	if (typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			result[key] = serializeArgs(val);
		}
		return result;
	}

	return value;
}

// ── Generic HTTP call ────────────────────────────────────────────────────────

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

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: response.statusText }));
		throw new Error(
			(error as Record<string, string>).error ?? `Dev RPC failed: ${response.status}`
		);
	}

	// DO methods that return void produce non-JSON bodies — handle gracefully
	const text = await response.text();
	if (!text || text === 'null' || text === 'undefined') return null;
	return JSON.parse(text);
}

// ── Proxy factories ──────────────────────────────────────────────────────────

/** Properties that must NOT be proxied — prevents thenables and serialisation traps. */
const PASSTHROUGH_PROPS = new Set(['then', 'toJSON', 'valueOf', '$$typeof', 'constructor']);

/** Service<OrionWorkerRpc> — POST /dev-rpc/worker/:method */
function createWorkerProxy(): unknown {
	return new Proxy(
		{},
		{
			get(_, method) {
				if (typeof method !== 'string') return undefined;
				if (PASSTHROUGH_PROPS.has(method)) return undefined;

				if (method === 'fetch') {
					return async (input: string | Request, init?: RequestInit) => {
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

/** Service<FileServiceRpc> — POST /dev-rpc/file/:method */
function createFileServiceProxy(): unknown {
	return new Proxy(
		{},
		{
			get(_, method) {
				if (typeof method !== 'string') return undefined;
				if (PASSTHROUGH_PROPS.has(method)) return undefined;
				return (args: unknown) => devRpcCall(`/dev-rpc/file/${method}`, args);
			}
		}
	);
}

/** DurableObjectNamespace<QuantPMAgentRpc> — /dev-rpc/agent/:agentName/:method */
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
						if (PASSTHROUGH_PROPS.has(method)) return undefined;
						return (args: unknown) =>
							devRpcCall(`/dev-rpc/agent/${encodeURIComponent(agentName)}/${method}`, args);
					}
				}
			);
		}
	};
}

/** DurableObjectNamespace (OnboardingSessionDO) — /dev-rpc/onboarding/:userId/:method */
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
						if (PASSTHROUGH_PROPS.has(method)) return undefined;

						// DO's fetch() requires a proper Request — serialize all parts
						if (method === 'fetch') {
							return async (input: string | Request, init?: RequestInit) => {
								const url = typeof input === 'string' ? input : input.url;
								const mergedInit = init ?? (typeof input === 'string' ? {} : input);
								const body = typeof mergedInit.body === 'string' ? mergedInit.body : undefined;
								const headers =
									mergedInit.headers instanceof Headers
										? Object.fromEntries(mergedInit.headers.entries())
										: (mergedInit.headers ?? {});

								const rpcUrl = `${DEV_WORKER_URL}/dev-rpc/onboarding/${encodeURIComponent(userId)}/fetch`;
								return fetch(rpcUrl, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										__doFetch: true,
										url,
										method: mergedInit.method ?? 'GET',
										headers,
										body
									})
								});
							};
						}

						return (args: unknown) =>
							devRpcCall(`/dev-rpc/onboarding/${encodeURIComponent(userId)}/${method}`, args);
					}
				}
			);
		}
	};
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Build a fake platform env with HTTP-backed binding proxies for dev mode. */
export function createDevPlatformEnv(): Record<string, unknown> {
	return {
		SEND_EMAIL: {
			send: async () => ({ dev: true })
		},
		CF_WORKER: createWorkerProxy(),
		FILE_SERVICE: createFileServiceProxy(),
		QUANT_AGENT: createAgentNamespaceProxy(),
		ONBOARDING_SESSION: createOnboardingNamespaceProxy(),
		AI: null,
		DOCUMENTS_BUCKET: null,
		DOCUMENT_CHUNKS: null,
		GRAPH_NODES: null
	};
}
