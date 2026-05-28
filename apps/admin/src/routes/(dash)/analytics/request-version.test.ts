import { describe, expect, test } from 'vitest';

import { createLatestRequestVersion } from './request-version';

describe('createLatestRequestVersion', () => {
	test('marks only the most recent request as current', () => {
		const requests = createLatestRequestVersion();

		const first = requests.next();
		const second = requests.next();

		expect(requests.isCurrent(first)).toBe(false);
		expect(requests.isCurrent(second)).toBe(true);
	});

	test('invalidates older requests after multiple rapid updates', () => {
		const requests = createLatestRequestVersion();

		const seen = [requests.next(), requests.next(), requests.next()];

		expect(seen.map((token) => requests.isCurrent(token))).toEqual([false, false, true]);
	});
});
