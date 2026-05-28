/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

import type { Database } from '@repo/db/client';
import type { QuantPMAgentRpc, OrionWorkerRpc, FileServiceRpc } from '@repo/shared/types';

// ── Auth types ───────────────────────────────────────────────────────────────

import type { SessionUser } from '@repo/db/auth';

// ── App namespace ────────────────────────────────────────────────────────────

declare global {
	namespace App {
		interface Locals {
			db: Database;
			user: SessionUser | undefined;
			maintenanceMode?: boolean;
		}
		interface PageData {
			flash?: { type: 'success' | 'error'; message: string };
		}
		interface Platform {
			context: ExecutionContext;
			cf?: {
				country?: string;
				timezone?: string;
				continent?: string;
				city?: string;
				latitude?: string;
				longitude?: string;
				[key: string]: unknown;
			};
			env: {
				AI: Ai;
				SEND_EMAIL?: {
					send(message: unknown): Promise<unknown>;
				};
				QUANT_AGENT: DurableObjectNamespace<QuantPMAgentRpc>;
				ONBOARDING_SESSION: DurableObjectNamespace;
				DOCUMENTS_BUCKET: R2Bucket;
				R2_DOMAIN?: string;
				FILE_SERVICE: Service<FileServiceRpc>;
				CF_WORKER: Service<OrionWorkerRpc>;
				DOCUMENT_CHUNKS: VectorizeIndex;
				GRAPH_NODES: VectorizeIndex;
				HYPERDRIVE: Hyperdrive;
				// vars
				AUTH_FROM_EMAIL?: string;
				AUTH_FROM_NAME?: string;
				GOOGLE_CLIENT_ID?: string;
				GOOGLE_CLIENT_SECRET?: string;
				APPLE_CLIENT_ID?: string;
				APPLE_CLIENT_SECRET?: string;
				MICROSOFT_CLIENT_ID?: string;
				MICROSOFT_CLIENT_SECRET?: string;
				PROD: boolean;
			};
		}
	}
}

export {};

declare module 'cloudflare:email' {
	export class EmailMessage {
		constructor(from: string, to: string, raw: string | ReadableStream);
	}
}
