import { describe, it, expect } from 'vitest';
import { resolveEnabledFeatures } from '../feature-flags';
import type { ConfigFeatureFlagRow } from '@repo/db/types';

function makeFlag(
	overrides: Partial<ConfigFeatureFlagRow> & { flagKey: string }
): ConfigFeatureFlagRow {
	return {
		id: overrides.flagKey,
		created: '',
		updated: '',
		flagKey: overrides.flagKey,
		displayName: overrides.displayName ?? overrides.flagKey,
		description: overrides.description ?? '',
		isEnabled: overrides.isEnabled ?? true,
		tagRule: overrides.tagRule ?? null
	} as ConfigFeatureFlagRow;
}

describe('resolveEnabledFeatures', () => {
	it('returns empty array for empty flags', () => {
		expect(resolveEnabledFeatures([], ['tier:pro'])).toEqual([]);
	});

	it('includes disabled flags (restriction inactive = available to everyone)', () => {
		const flags = [makeFlag({ flagKey: 'charts', isEnabled: false })];
		expect(resolveEnabledFeatures(flags, ['tier:pro'])).toEqual(['charts']);
		expect(resolveEnabledFeatures(flags, [])).toEqual(['charts']);
	});

	it('includes enabled flag with no tagRule (available to all)', () => {
		const flags = [makeFlag({ flagKey: 'charts', isEnabled: true, tagRule: null })];
		expect(resolveEnabledFeatures(flags, [])).toEqual(['charts']);
		expect(resolveEnabledFeatures(flags, ['tier:pro'])).toEqual(['charts']);
	});

	it('includes enabled flag when user matches tagRule', () => {
		const flags = [
			makeFlag({
				flagKey: 'advanced_analytics',
				isEnabled: true,
				tagRule: { groups: [{ tags: ['tier:pro'] }] }
			})
		];
		expect(resolveEnabledFeatures(flags, ['tier:pro'])).toEqual(['advanced_analytics']);
		expect(resolveEnabledFeatures(flags, ['tier:pro', 'geo:us'])).toEqual(['advanced_analytics']);
	});

	it('excludes enabled flag when user does not match tagRule', () => {
		const flags = [
			makeFlag({
				flagKey: 'advanced_analytics',
				isEnabled: true,
				tagRule: { groups: [{ tags: ['tier:pro'] }] }
			})
		];
		expect(resolveEnabledFeatures(flags, ['tier:free'])).toEqual([]);
		expect(resolveEnabledFeatures(flags, [])).toEqual([]);
	});

	it('handles multiple flags with mixed rules', () => {
		const flags = [
			makeFlag({ flagKey: 'basic', isEnabled: true, tagRule: null }),
			makeFlag({
				flagKey: 'pro_feature',
				isEnabled: true,
				tagRule: { groups: [{ tags: ['tier:pro'] }] }
			}),
			makeFlag({ flagKey: 'disabled_feature', isEnabled: false }),
			makeFlag({
				flagKey: 'geo_feature',
				isEnabled: true,
				tagRule: { groups: [{ tags: ['geo:us'] }] }
			})
		];

		// disabled_feature is always included (restriction inactive)
		expect(resolveEnabledFeatures(flags, ['tier:pro'])).toEqual([
			'basic',
			'pro_feature',
			'disabled_feature'
		]);
		expect(resolveEnabledFeatures(flags, ['geo:us'])).toEqual([
			'basic',
			'disabled_feature',
			'geo_feature'
		]);
		expect(resolveEnabledFeatures(flags, ['tier:pro', 'geo:us'])).toEqual([
			'basic',
			'pro_feature',
			'disabled_feature',
			'geo_feature'
		]);
		expect(resolveEnabledFeatures(flags, [])).toEqual(['basic', 'disabled_feature']);
	});

	it('supports OR logic across groups', () => {
		const flags = [
			makeFlag({
				flagKey: 'multi_gate',
				isEnabled: true,
				tagRule: {
					groups: [{ tags: ['tier:pro'] }, { tags: ['role:beta_tester'] }]
				}
			})
		];

		expect(resolveEnabledFeatures(flags, ['tier:pro'])).toEqual(['multi_gate']);
		expect(resolveEnabledFeatures(flags, ['role:beta_tester'])).toEqual(['multi_gate']);
		expect(resolveEnabledFeatures(flags, ['tier:free'])).toEqual([]);
	});
});
