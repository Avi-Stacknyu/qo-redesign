import { describe, expect, it } from 'vitest';

import { buildLandingTeasers } from './landing-teasers';

describe('buildLandingTeasers', () => {
	it('keeps the surfaced teasers interactive while soft-muted styling can still apply', () => {
		const teasers = buildLandingTeasers([
			'How can I set realistic financial goals and prioritize them?',
			'What are the best ways to reduce unnecessary expenses?',
			'How should I structure an emergency fund?'
		]);

		expect(teasers).toEqual([
			{
				prompt: 'How can I set realistic financial goals and prioritize them?',
				interactive: true,
				muted: false
			},
			{
				prompt: 'What are the best ways to reduce unnecessary expenses?',
				interactive: true,
				muted: true
			}
		]);
	});

	it('leaves a single teaser interactive', () => {
		expect(buildLandingTeasers(['One prompt'])).toEqual([
			{
				prompt: 'One prompt',
				interactive: true,
				muted: false
			}
		]);
	});
});