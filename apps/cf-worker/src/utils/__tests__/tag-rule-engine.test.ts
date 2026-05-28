import { describe, it, expect } from 'vitest';
import { evaluateTagRule, resolveVisibility } from '../../utils/tag-rule-engine';
import type { TagRule } from '@repo/shared/types';

// ============================================================================
// evaluateTagRule
// ============================================================================

describe('evaluateTagRule', () => {
	it('null rule → visible (no restriction)', () => {
		expect(evaluateTagRule(null, [])).toBe(true);
		expect(evaluateTagRule(null, ['tier:pro'])).toBe(true);
	});

	it('undefined rule → visible', () => {
		expect(evaluateTagRule(undefined, [])).toBe(true);
	});

	it('empty groups array → visible', () => {
		expect(evaluateTagRule({ groups: [] }, [])).toBe(true);
	});

	it('single group AND logic — all tags required', () => {
		const rule: TagRule = { groups: [{ tags: ['geo:in', 'tier:pro'] }] };
		expect(evaluateTagRule(rule, ['geo:in', 'tier:pro'])).toBe(true);
		expect(evaluateTagRule(rule, ['geo:in', 'tier:pro', 'role:doctor'])).toBe(true);
		expect(evaluateTagRule(rule, ['geo:in'])).toBe(false);
		expect(evaluateTagRule(rule, ['tier:pro'])).toBe(false);
		expect(evaluateTagRule(rule, [])).toBe(false);
	});

	it('multiple groups OR logic — any group can match', () => {
		const rule: TagRule = {
			groups: [{ tags: ['geo:in', 'tier:pro'] }, { tags: ['geo:us'] }]
		};
		// US user matches second group
		expect(evaluateTagRule(rule, ['geo:us'])).toBe(true);
		// Indian pro matches first group
		expect(evaluateTagRule(rule, ['geo:in', 'tier:pro'])).toBe(true);
		// Indian free matches neither
		expect(evaluateTagRule(rule, ['geo:in', 'tier:free'])).toBe(false);
		// UK user matches neither
		expect(evaluateTagRule(rule, ['geo:gb'])).toBe(false);
	});

	it('group with empty tags → passes (no requirements)', () => {
		const rule: TagRule = { groups: [{ tags: [] }] };
		expect(evaluateTagRule(rule, [])).toBe(true);
		expect(evaluateTagRule(rule, ['tier:pro'])).toBe(true);
	});

	it('mixed group sizes', () => {
		const rule: TagRule = {
			groups: [
				{ tags: ['geo:in', 'tier:pro', 'role:doctor'] },
				{ tags: ['tier:enterprise'] }
			]
		};
		// Enterprise user matches second group regardless of geo
		expect(evaluateTagRule(rule, ['tier:enterprise'])).toBe(true);
		// Indian pro doctor matches first group
		expect(evaluateTagRule(rule, ['geo:in', 'tier:pro', 'role:doctor'])).toBe(true);
		// Indian pro (no role) fails both
		expect(evaluateTagRule(rule, ['geo:in', 'tier:pro'])).toBe(false);
	});

	it('case insensitive matching', () => {
		const rule: TagRule = { groups: [{ tags: ['TIER:PRO'] }] };
		expect(evaluateTagRule(rule, ['tier:pro'])).toBe(true);

		const rule2: TagRule = { groups: [{ tags: ['tier:pro'] }] };
		expect(evaluateTagRule(rule2, ['TIER:PRO'])).toBe(true);
	});

	it('three groups — complex OR', () => {
		const rule: TagRule = {
			groups: [
				{ tags: ['geo:in', 'tier:pro'] },
				{ tags: ['geo:us', 'tier:pro'] },
				{ tags: ['tier:enterprise'] }
			]
		};
		expect(evaluateTagRule(rule, ['geo:in', 'tier:pro'])).toBe(true);
		expect(evaluateTagRule(rule, ['geo:us', 'tier:pro'])).toBe(true);
		expect(evaluateTagRule(rule, ['tier:enterprise'])).toBe(true);
		expect(evaluateTagRule(rule, ['geo:gb', 'tier:pro'])).toBe(false);
		expect(evaluateTagRule(rule, ['geo:in', 'tier:free'])).toBe(false);
	});
});

// ============================================================================
// resolveVisibility
// ============================================================================

describe('resolveVisibility', () => {
	interface TestEntity {
		id: string;
		name: string;
		rule: TagRule | null;
	}

	const entities: TestEntity[] = [
		{ id: '1', name: 'open', rule: null },
		{ id: '2', name: 'empty-rule', rule: { groups: [] } },
		{ id: '3', name: 'pro-only', rule: { groups: [{ tags: ['tier:pro'] }] } },
		{
			id: '4',
			name: 'india-or-us',
			rule: { groups: [{ tags: ['geo:in'] }, { tags: ['geo:us'] }] }
		},
		{
			id: '5',
			name: 'india-pro-or-enterprise',
			rule: {
				groups: [{ tags: ['geo:in', 'tier:pro'] }, { tags: ['tier:enterprise'] }]
			}
		}
	];

	const getRule = (e: TestEntity) => e.rule;

	it('entities with no rule are visible to all', () => {
		const visible = resolveVisibility(entities, [], getRule);
		const ids = visible.map((e) => e.id);
		expect(ids).toContain('1');
		expect(ids).toContain('2');
	});

	it('filters by single-group AND rule', () => {
		const visible = resolveVisibility(entities, ['tier:pro'], getRule);
		const ids = visible.map((e) => e.id);
		expect(ids).toContain('3');
		expect(ids).not.toContain('4');
	});

	it('filters by multi-group OR rule', () => {
		const visible = resolveVisibility(entities, ['geo:us'], getRule);
		const ids = visible.map((e) => e.id);
		expect(ids).toContain('4');
		expect(ids).not.toContain('3');
	});

	it('complex scenario: indian pro user', () => {
		const visible = resolveVisibility(entities, ['geo:in', 'tier:pro'], getRule);
		const ids = visible.map((e) => e.id);
		expect(ids).toEqual(['1', '2', '3', '4', '5']);
	});

	it('complex scenario: enterprise user', () => {
		const visible = resolveVisibility(entities, ['tier:enterprise'], getRule);
		const ids = visible.map((e) => e.id);
		expect(ids).toContain('1');
		expect(ids).toContain('2');
		expect(ids).toContain('5');
		expect(ids).not.toContain('3');
		expect(ids).not.toContain('4');
	});

	it('empty entities list returns empty', () => {
		expect(resolveVisibility([], ['tier:pro'], getRule)).toEqual([]);
	});

	it('empty user tags — only unrestricted entities visible', () => {
		const visible = resolveVisibility(entities, [], getRule);
		const ids = visible.map((e) => e.id);
		expect(ids).toEqual(['1', '2']);
	});
});
