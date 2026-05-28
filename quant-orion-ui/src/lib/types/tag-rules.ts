/**
 * Universal Tag Rule System
 *
 * Tag rules control access to any entity (agents, pages, features, models, etc.)
 * using AND/OR group logic:
 *   - Groups are OR'd: pass if ANY group matches
 *   - Tags within a group are AND'd: pass only if ALL tags in the group are present
 *
 * Example: { groups: [{ tags: ["geo:in", "tier:pro"] }, { tags: ["geo:us"] }] }
 *   → "(geo:in AND tier:pro) OR geo:us"
 */

/** A single group — all tags must match (AND logic). */
export type TagGroup = {
	tags: string[];
};

/** A full rule — any group must match (OR logic between groups). */
export type TagRule = {
	groups: TagGroup[];
};

/** All entity types that can be gated by tag rules. */
export type TaggableEntity =
	| 'agent'
	| 'page'
	| 'feature'
	| 'model'
	| 'analytical_tool'
	| 'widget'
	| 'template'
	| 'data_source';

/** Convert a flat tag array (old format) to a single-group TagRule. */
export function tagsToTagRule(tags: string[]): TagRule {
	if (tags.length === 0) return { groups: [] };
	return { groups: [{ tags }] };
}
