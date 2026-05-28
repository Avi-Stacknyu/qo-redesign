import { describe, expect, it } from 'vitest';
import { canonicalizeProfileUpdates, findProfileField, sameProfileField } from '@repo/shared/utils';

describe('profiler field aliases', () => {
	it('treats known alias keys as equivalent', () => {
		expect(sameProfileField('residence_country', 'country')).toBe(true);
		expect(sameProfileField('investment_horizon', 'investment_timeline')).toBe(true);
		expect(sameProfileField('profession', 'occupation')).toBe(true);
	});

	it('finds known alias values in the same section', () => {
		const sections = {
			goals: { fields: { primary_financial_goals: { value: 'retirement, wealth_building' } } }
		};

		const match = findProfileField(sections, 'goals', 'financial_goals');

		expect(match).toEqual(
			expect.objectContaining({
				sectionId: 'goals',
				key: 'primary_financial_goals',
				value: 'retirement, wealth_building'
			})
		);
	});

	it('canonicalizes profiler updates onto schema keys', () => {
		const updates = canonicalizeProfileUpdates(
			[
				{
					section: 'investment',
					fields: {
						investment_timeline: { value: 'long_term' },
						occupation: { value: 'Medical Tech' }
					}
				}
			],
			[
				{
					section_id: 'investment',
					fields: [{ key: 'investment_horizon' }, { key: 'profession' }]
				}
			]
		);

		expect(updates[0]?.fields).toEqual({
			investment_horizon: { value: 'long_term' },
			profession: { value: 'Medical Tech' }
		});
	});
});
