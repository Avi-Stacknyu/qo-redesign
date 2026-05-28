/**
 * Universal Tag Rule Engine
 *
 * Evaluates tag rules using AND/OR group logic and provides a generic
 * visibility resolver for any entity type (agents, features, pages, etc.).
 */

import type { TagRule } from '@repo/shared/types';

/**
 * Evaluate a tag rule against a user's effective tag set.
 *
 * - null/undefined/empty groups → true (no restriction, visible to all)
 * - OR between groups: passes if ANY group matches
 * - AND within each group: passes only if ALL tags in the group are present
 */
export function evaluateTagRule(rule: TagRule | null | undefined, userTags: string[]): boolean {
	if (!rule || !rule.groups || rule.groups.length === 0) return true;

	const tagSet = new Set(userTags.map((t) => t.toLowerCase()));

	return rule.groups.some(
		(group) => group.tags.length === 0 || group.tags.every((tag) => tagSet.has(tag.toLowerCase()))
	);
}

/**
 * Generic visibility filter for any entity type.
 *
 * Filters entities to those whose tag rule passes for the given user tags.
 * The `getRule` accessor extracts the tag rule from each entity — return null
 * for entities that should be visible to everyone.
 */
export function resolveVisibility<T>(
	entities: T[],
	userTags: string[],
	getRule: (entity: T) => TagRule | null
): T[] {
	const tagSet = new Set(userTags.map((t) => t.toLowerCase()));

	return entities.filter((entity) => {
		const rule = getRule(entity);
		if (!rule || !rule.groups || rule.groups.length === 0) return true;

		return rule.groups.some(
			(group) => group.tags.length === 0 || group.tags.every((tag) => tagSet.has(tag.toLowerCase()))
		);
	});
}

/**
 * Score a tag rule against user tags by counting overlapping tags.
 *
 * Used by the profiler dispatcher to rank profilers.
 * - null/undefined/empty rule → 0 (fallback profiler, no tag affinity)
 * - Score = count of unique tags in the rule that the user has
 */
export function scoreTagOverlap(rule: TagRule | null | undefined, userTags: string[]): number {
	if (!rule || !rule.groups || rule.groups.length === 0) return 0;

	const tagSet = new Set(userTags.map((t) => t.toLowerCase()));
	const ruleTags = new Set(rule.groups.flatMap((g) => g.tags.map((t) => t.toLowerCase())));
	let score = 0;
	for (const tag of ruleTags) {
		if (tagSet.has(tag)) score++;
	}
	return score;
}
