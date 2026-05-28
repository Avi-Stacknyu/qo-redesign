export type ProfilerEventType = 'profiler-started' | 'profiler-complete' | 'profiler-failed';

export interface ProfilerEvent {
	type: ProfilerEventType;
	chatId: string;
	occurredAt: string;
	reason: 'threshold' | 'flush' | 'session_timeout';
	error?: string;
}

type ProfilerEventListener = (event: ProfilerEvent) => void;

export class ProfilerEventHub {
	private readonly listeners = new Set<ProfilerEventListener>();

	subscribe(listener: ProfilerEventListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	emit(event: ProfilerEvent): void {
		for (const listener of [...this.listeners]) {
			listener(event);
		}
	}
}

export function formatSseEvent(eventName: string, data: unknown): string {
	return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}
