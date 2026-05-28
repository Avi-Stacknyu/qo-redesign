/**
 * Tag-Based Agent Visibility
 *
 * An agent is visible if:
 *   - is_universal = true, OR
 *   - tag_rule is set → evaluated via OR/AND group logic, OR
 *   - no tag_rule → visible to everyone
 */

import type { TagRule } from '@repo/shared/types';
import { evaluateTagRule } from './tag-rule-engine';

export interface AgentWithTags {
	id: string;
	is_universal: boolean;
	tag_rule?: TagRule | null;
	[key: string]: unknown;
}

/**
 * Check if a single agent is visible to a user based on their tags.
 * Uses tag_rule (OR/AND groups) for gating.
 */
export function isAgentVisible(agent: AgentWithTags, userTags: string[]): boolean {
	if (agent.is_universal) return true;

	// tag_rule with OR/AND group logic
	// Empty groups = admin cleared all restrictions = visible to all.
	if (agent.tag_rule && agent.tag_rule.groups) {
		return evaluateTagRule(agent.tag_rule, userTags);
	}

	// No tag_rule = visible to everyone
	return true;
}

/**
 * Filter a list of agents to those visible for the given user tags.
 */
export function filterVisibleAgents<T extends AgentWithTags>(agents: T[], userTags: string[]): T[] {
	return agents.filter((agent) => isAgentVisible(agent, userTags));
}

/**
 * Split agents into "shelf" (personalized) and "other" categories.
 * Shelf agents are ordered according to shelfAgentIds.
 */
export function splitAgentsByShelf<T extends { id: string }>(
	visibleAgents: T[],
	shelfAgentIds: string[]
): { shelfAgents: T[]; otherAgents: T[] } {
	const shelfAgents = visibleAgents
		.filter((a) => shelfAgentIds.includes(a.id))
		.sort((a, b) => shelfAgentIds.indexOf(a.id) - shelfAgentIds.indexOf(b.id));

	const otherAgents = visibleAgents.filter((a) => !shelfAgentIds.includes(a.id));

	return { shelfAgents, otherAgents };
}

// ============================================================================
// Generic Tag-Rule Visibility (templates, widgets, etc.)
// ============================================================================

export interface TagGatedRecord {
	id: string;
	tag_rule?: TagRule | null;
	[key: string]: unknown;
}

/**
 * Filter any tag-gated records by user tags.
 * No tag_rule or empty groups → visible to everyone.
 */
export function filterVisibleByTags<T extends TagGatedRecord>(items: T[], userTags: string[]): T[] {
	return items.filter((item) => {
		if (!item.tag_rule || !item.tag_rule.groups || item.tag_rule.groups.length === 0) return true;
		return evaluateTagRule(item.tag_rule, userTags);
	});
}
