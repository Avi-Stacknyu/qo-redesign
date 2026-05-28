import { waitUntil } from 'cloudflare:workers';
import { PostHog } from 'posthog-node/edge';

import { formatError, setLogEventSink, type LogEntry } from './logger';
import type { Env } from '../types';

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
const WORKER_DISTINCT_ID = 'quant-orion-worker';

type PostHogLoggerEnv = Pick<Env, 'POSTHOG_TOKEN' | 'POSTHOG_HOST' | 'IS_DEV'>;

export function configurePostHogLogger(env: PostHogLoggerEnv): void {
	const token = env.POSTHOG_TOKEN?.trim();
	if (!token) {
		setLogEventSink(null);
		return;
	}

	const host = env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;
	setLogEventSink((entry) => {
		try {
			waitUntil(captureLogEntry({ token, host }, entry));
		} catch (error) {
			reportPostHogFailure('posthog_schedule_failed', error);
		}
	});
}

async function captureLogEntry(
	config: { token: string; host: string },
	entry: LogEntry
): Promise<void> {
	const posthog = new PostHog(config.token, {
		host: config.host,
		flushAt: 1,
		flushInterval: 0
	});

	try {
		const distinctId = getDistinctId(entry);
		const properties = getProperties(entry);

		if (entry.level === 'error') {
			await posthog.captureExceptionImmediate(getErrorFromEntry(entry), distinctId, properties);
		} else {
			await posthog.captureImmediate({
				distinctId,
				event: 'worker_warning',
				properties
			});
		}
	} catch (error) {
		reportPostHogFailure('posthog_capture_failed', error);
	} finally {
		await posthog._shutdown(1_000).catch((error) => {
			reportPostHogFailure('posthog_shutdown_failed', error);
		});
	}
}

function getDistinctId(entry: LogEntry): string {
	for (const key of ['userId', 'agentId', 'chatId', 'messageId', 'requestId']) {
		const value = entry[key];
		if (typeof value === 'string' && value.trim()) return value;
	}
	return WORKER_DISTINCT_ID;
}

function getErrorFromEntry(entry: LogEntry): Error {
	const message =
		getString(entry.errorMessage) ?? getString(entry.error) ?? `${entry.service}.${entry.event}`;
	const error = new Error(message);
	error.name = getString(entry.errorName) ?? 'WorkerLogError';
	const stack = getString(entry.errorStack);
	if (stack) error.stack = stack;
	return error;
}

function getProperties(entry: LogEntry): Record<string, unknown> {
	const { level, service, event, ts, ...data } = entry;
	return {
		level,
		service,
		logEvent: event,
		loggedAt: new Date(ts).toISOString(),
		...data
	};
}

function getString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value : null;
}

function reportPostHogFailure(event: string, error: unknown): void {
	console.error(
		JSON.stringify({
			level: 'error',
			service: 'PostHogLogger',
			event,
			ts: Date.now(),
			...formatError(error)
		})
	);
}
