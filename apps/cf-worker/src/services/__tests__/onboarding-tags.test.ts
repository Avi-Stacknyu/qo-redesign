import { describe, expect, it } from 'vitest';
import { buildCompletionTags } from '../onboarding-tags';

describe('buildCompletionTags', () => {
	it('always includes profile default tags along with deterministic and AI tags', () => {
		const tags = buildCompletionTags({
			capturedLocation: { country: 'US' },
			profilerData: [{ factKey: 'role', answer: 'Founder' }],
			transcript: [{ grantedTags: ['goal:liquidity'] }],
			defaultTags: ['industry:education', 'tier:vip'],
			aiTags: ['persona:planner', 'tier:vip']
		});

		expect(tags).toEqual([
			'geo:us',
			'role:founder',
			'goal:liquidity',
			'industry:education',
			'tier:vip',
			'persona:planner'
		]);
	});
});
