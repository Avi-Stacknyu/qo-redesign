import { describe, it, expect } from 'vitest';
import { getUserTags } from '../../utils/tag-resolver';
import { isAgentVisible, filterVisibleAgents } from '../../utils/tag-visibility';

// ============================================================================
// getUserTags
// ============================================================================

describe('getUserTags', () => {
	it('returns empty array when both inputs are null', () => {
		expect(getUserTags(null, null)).toEqual([]);
	});

	it('returns plan granted_tags when no user tags', () => {
		const tags = getUserTags({ granted_tags: ['tier:free'] }, null);
		expect(tags).toEqual(['tier:free']);
	});

	it('returns user tags when no plan', () => {
		const tags = getUserTags(null, { tags: ['geo:in', 'role:doctor'] });
		expect(tags).toEqual(['geo:in', 'role:doctor']);
	});

	it('merges and deduplicates plan + user tags', () => {
		const tags = getUserTags(
			{ granted_tags: ['tier:free', 'tier:pro'] },
			{ tags: ['geo:in', 'tier:free'] }
		);
		expect(tags).toContain('tier:free');
		expect(tags).toContain('tier:pro');
		expect(tags).toContain('geo:in');
		expect(tags.filter((t) => t === 'tier:free')).toHaveLength(1);
	});

	it('lowercases all tags', () => {
		const tags = getUserTags({ granted_tags: ['TIER:PRO'] }, { tags: ['GEO:IN'] });
		expect(tags).toContain('tier:pro');
		expect(tags).toContain('geo:in');
	});

	it('ignores malformed tags without colon', () => {
		const tags = getUserTags({ granted_tags: ['nocolon', 'tier:pro'] }, null);
		expect(tags).toEqual(['tier:pro']);
	});

	it('handles empty arrays', () => {
		expect(getUserTags({ granted_tags: [] }, { tags: [] })).toEqual([]);
	});

	it('parses granted_tags from JSON string', () => {
		const tags = getUserTags({ granted_tags: '["tier:pro", "tier:free"]' as any }, null);
		expect(tags).toContain('tier:pro');
		expect(tags).toContain('tier:free');
	});

	it('parses user tags from JSON string', () => {
		const tags = getUserTags(null, { tags: '["geo:in", "role:doctor"]' as any });
		expect(tags).toContain('geo:in');
		expect(tags).toContain('role:doctor');
	});

	it('handles invalid JSON string gracefully', () => {
		const tags = getUserTags({ granted_tags: 'not-valid-json' as any }, { tags: ['geo:us'] });
		expect(tags).toEqual(['geo:us']);
	});

	it('handles non-array JSON gracefully', () => {
		const tags = getUserTags({ granted_tags: '{"key": "value"}' as any }, null);
		expect(tags).toEqual([]);
	});
});

// ============================================================================
// isAgentVisible
// ============================================================================

describe('isAgentVisible', () => {
	it('universal agents are always visible', () => {
		const agent = {
			id: 'a1',
			is_universal: true,
			tag_rule: { groups: [{ tags: ['tier:enterprise'] }] }
		};
		expect(isAgentVisible(agent, [])).toBe(true);
	});

	it('agents with no tag_rule are visible to everyone', () => {
		expect(isAgentVisible({ id: 'a1', is_universal: false }, [])).toBe(true);
		expect(isAgentVisible({ id: 'a1', is_universal: false, tag_rule: null }, [])).toBe(true);
	});

	it('visible when user satisfies a tag_rule group', () => {
		const agent = {
			id: 'a1',
			is_universal: false,
			tag_rule: { groups: [{ tags: ['geo:in', 'tier:pro'] }] }
		};
		expect(isAgentVisible(agent, ['geo:in', 'tier:pro', 'role:doctor'])).toBe(true);
	});

	it('not visible when user is missing a tag in every group', () => {
		const agent = {
			id: 'a1',
			is_universal: false,
			tag_rule: { groups: [{ tags: ['geo:in', 'tier:pro'] }] }
		};
		expect(isAgentVisible(agent, ['geo:in'])).toBe(false);
	});

	it('not visible when user has no tags and agent has tag_rule', () => {
		const agent = {
			id: 'a1',
			is_universal: false,
			tag_rule: { groups: [{ tags: ['tier:pro'] }] }
		};
		expect(isAgentVisible(agent, [])).toBe(false);
	});

	it('agent with empty tag_rule groups is visible to everyone', () => {
		const agent = { id: 'a1', is_universal: false, tag_rule: { groups: [] } };
		expect(isAgentVisible(agent, [])).toBe(true);
	});
});

// ============================================================================
// filterVisibleAgents
// ============================================================================

describe('filterVisibleAgents', () => {
	const agents = [
		{
			id: 'universal',
			is_universal: true,
			tag_rule: { groups: [{ tags: ['tier:enterprise'] }] }
		},
		{ id: 'open', is_universal: false },
		{
			id: 'geo-in',
			is_universal: false,
			tag_rule: { groups: [{ tags: ['geo:in'] }] }
		},
		{
			id: 'pro-only',
			is_universal: false,
			tag_rule: { groups: [{ tags: ['tier:pro'] }] }
		},
		{
			id: 'india-pro',
			is_universal: false,
			tag_rule: { groups: [{ tags: ['geo:in', 'tier:pro'] }] }
		}
	];

	it('user with no tags sees universal + open agents', () => {
		const visible = filterVisibleAgents(agents, []);
		const ids = visible.map((a) => a.id);
		expect(ids).toEqual(['universal', 'open']);
	});

	it('indian free user sees geo:in agents but not pro', () => {
		const visible = filterVisibleAgents(agents, ['geo:in', 'tier:free']);
		const ids = visible.map((a) => a.id);
		expect(ids).toContain('universal');
		expect(ids).toContain('open');
		expect(ids).toContain('geo-in');
		expect(ids).not.toContain('pro-only');
		expect(ids).not.toContain('india-pro');
	});

	it('indian pro user sees all agents', () => {
		const visible = filterVisibleAgents(agents, ['geo:in', 'tier:free', 'tier:pro']);
		const ids = visible.map((a) => a.id);
		expect(ids).toEqual(['universal', 'open', 'geo-in', 'pro-only', 'india-pro']);
	});

	it('US pro user does not see india-pro', () => {
		const visible = filterVisibleAgents(agents, ['geo:us', 'tier:pro']);
		const ids = visible.map((a) => a.id);
		expect(ids).toContain('pro-only');
		expect(ids).not.toContain('geo-in');
		expect(ids).not.toContain('india-pro');
	});
});

// ============================================================================
// isAgentVisible — tag_rule OR/AND group logic
// ============================================================================

describe('isAgentVisible with tag_rule', () => {
	it('agent with tag_rule uses OR/AND group logic', () => {
		const agent = {
			id: 'a1',
			is_universal: false,
			tag_rule: {
				groups: [{ tags: ['geo:in', 'tier:pro'] }, { tags: ['geo:us'] }]
			}
		};
		// US user matches second group
		expect(isAgentVisible(agent, ['geo:us'])).toBe(true);
		// Indian pro matches first group
		expect(isAgentVisible(agent, ['geo:in', 'tier:pro'])).toBe(true);
		// Indian free matches neither
		expect(isAgentVisible(agent, ['geo:in', 'tier:free'])).toBe(false);
	});

	it('universal agent with tag_rule is still visible to all', () => {
		const agent = {
			id: 'a1',
			is_universal: true,
			tag_rule: { groups: [{ tags: ['tier:enterprise'] }] }
		};
		expect(isAgentVisible(agent, [])).toBe(true);
	});

	it('agent with no tag_rule is visible to everyone', () => {
		const agent = {
			id: 'a1',
			is_universal: false
		};
		expect(isAgentVisible(agent, [])).toBe(true);
		expect(isAgentVisible(agent, ['geo:in', 'tier:pro'])).toBe(true);
	});
});

// ============================================================================
// filterVisibleAgents — tag_rule gating
// ============================================================================

describe('filterVisibleAgents with tag_rule', () => {
	const agents = [
		{ id: 'universal', is_universal: true },
		{ id: 'open', is_universal: false },
		{
			id: 'india-or-us',
			is_universal: false,
			tag_rule: { groups: [{ tags: ['geo:in'] }, { tags: ['geo:us'] }] }
		},
		{
			id: 'pro-india-or-enterprise',
			is_universal: false,
			tag_rule: {
				groups: [{ tags: ['geo:in', 'tier:pro'] }, { tags: ['tier:enterprise'] }]
			}
		}
	];

	it('user with no tags sees universal + open only', () => {
		const ids = filterVisibleAgents(agents, []).map((a) => a.id);
		expect(ids).toEqual(['universal', 'open']);
	});

	it('US pro user sees OR-group agents', () => {
		const ids = filterVisibleAgents(agents, ['geo:us', 'tier:pro']).map((a) => a.id);
		expect(ids).toContain('universal');
		expect(ids).toContain('open');
		expect(ids).toContain('india-or-us');
		expect(ids).not.toContain('pro-india-or-enterprise');
	});

	it('enterprise user sees enterprise OR group', () => {
		const ids = filterVisibleAgents(agents, ['tier:enterprise']).map((a) => a.id);
		expect(ids).toContain('pro-india-or-enterprise');
	});

	it('indian pro user sees all agents', () => {
		const ids = filterVisibleAgents(agents, ['geo:in', 'tier:pro']).map((a) => a.id);
		expect(ids).toEqual([
			'universal',
			'open',
			'india-or-us',
			'pro-india-or-enterprise'
		]);
	});
});
