import { describe, expect, it, vi } from 'vitest';

import { ProfilerEventHub, type ProfilerEvent } from '../profiler-events';

describe('ProfilerEventHub', () => {
	it('notifies all current subscribers', () => {
		const hub = new ProfilerEventHub();
		const first = vi.fn();
		const second = vi.fn();
		const event: ProfilerEvent = {
			type: 'profiler-complete',
			chatId: 'chat-123',
			occurredAt: '2026-04-16T10:00:00.000Z',
			reason: 'threshold'
		};

		hub.subscribe(first);
		hub.subscribe(second);
		hub.emit(event);

		expect(first).toHaveBeenCalledWith(event);
		expect(second).toHaveBeenCalledWith(event);
	});

	it('stops notifying listeners after unsubscribe', () => {
		const hub = new ProfilerEventHub();
		const listener = vi.fn();
		const unsubscribe = hub.subscribe(listener);

		unsubscribe();
		hub.emit({
			type: 'profiler-failed',
			chatId: 'chat-123',
			occurredAt: '2026-04-16T10:00:00.000Z',
			reason: 'flush'
		});

		expect(listener).not.toHaveBeenCalled();
	});
});
