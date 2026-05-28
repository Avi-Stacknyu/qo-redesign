import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { chats } from '@repo/db/schema';

type WorkerHttpBinding = App.Platform['env']['CF_WORKER'] & {
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export const GET: RequestHandler = async ({ request, params, locals, platform }) => {
	const chatId = params.threadId;
	if (!chatId) throw error(400, 'Missing threadId');
	if (!locals.user) throw error(401, 'Unauthorized');

	const [chat] = await locals.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
	if (!chat) throw error(404, 'Thread not found');
	if (chat.user !== locals.user.id) throw error(403, 'Forbidden');

	const worker = platform?.env?.CF_WORKER as WorkerHttpBinding | undefined;
	if (!worker) throw error(503, 'Agent service unavailable');

	const upstreamRequest = new Request(
		`https://quant-orion.internal/agents/${chatId}/profiler-events`,
		{
			method: 'GET',
			headers: {
				Accept: 'text/event-stream',
				'Cache-Control': 'no-cache',
				...(request.headers.get('last-event-id')
					? { 'Last-Event-ID': request.headers.get('last-event-id')! }
					: {})
			},
			signal: request.signal
		}
	);

	const response = await worker.fetch(upstreamRequest);
	if (!response.ok || !response.body) {
		throw error(response.status === 404 ? 404 : 502, 'Failed to connect profiler event stream');
	}

	return new Response(response.body, {
		status: response.status,
		headers: {
			'Content-Type': response.headers.get('Content-Type') ?? 'text/event-stream',
			'Cache-Control': response.headers.get('Cache-Control') ?? 'no-cache, no-transform',
			Connection: response.headers.get('Connection') ?? 'keep-alive'
		}
	});
};
