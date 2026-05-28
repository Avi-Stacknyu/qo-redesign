import '../worker-configuration';

import type { SessionUser } from '@repo/db/auth';
import type { Database } from '@repo/db/client';
import type { Ai } from '@cloudflare/workers-types';
import type { QuantPMAgentRpc, OrionWorkerRpc, FileServiceRpc } from '@repo/shared/types';

type RpcService<T> = T & Service;
type RpcDurableObjectNamespace<T> = Omit<DurableObjectNamespace, 'get'> & {
	get(id: DurableObjectId, options?: DurableObjectNamespaceGetOptions): DurableObjectStub & T;
};

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | undefined;
			db: Database;
			maintenanceMode: boolean;
		}
		interface PageData {
			flash?: { type: 'success' | 'error'; message: string };
		}
		interface Platform {
			context: ExecutionContext;
			env: {
				HYPERDRIVE: Hyperdrive;
				SEND_EMAIL?: {
					send(message: unknown): Promise<unknown>;
				};
				AUTH_FROM_EMAIL?: string;
				AUTH_FROM_NAME?: string;
				AI: Ai;
				QUANT_AGENT: RpcDurableObjectNamespace<QuantPMAgentRpc>;
				ONBOARDING_SESSION: DurableObjectNamespace;
				DOCUMENTS_BUCKET: R2Bucket;
				R2_DOMAIN?: string;
				FILE_SERVICE: RpcService<FileServiceRpc>;
				CF_WORKER: RpcService<OrionWorkerRpc>;
			};
		}
	}
}

declare module 'cloudflare:email' {
	export class EmailMessage {
		constructor(from: string, to: string, raw: string | ReadableStream);
	}
}
