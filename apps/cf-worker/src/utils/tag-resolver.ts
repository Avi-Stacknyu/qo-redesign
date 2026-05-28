/**
 * Tag Resolver
 *
 * Resolves a user's effective tag set from their plan and stored profile tags.
 * Tags are flat strings with a namespace prefix: "geo:in", "tier:pro", "role:doctor".
 *
 * Geo tags come from stored profile (set during onboarding), NOT from live CF headers.
 * This prevents travel from changing agent visibility.
 */

interface PlanWithTags {
	granted_tags?: string[] | string | null;
}

interface UserTagsCustomization {
	tags?: string[] | string;
}

/** Try to coerce a value that might be a JSON string into an array. */
function coerceToArray(value: unknown): string[] | null {
	if (Array.isArray(value)) return value;
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed;
		} catch {
			// not valid JSON — ignore
		}
	}
	return null;
}

/**
 * Compute the user's effective tag set by merging plan-granted tags
 * with stored user profile tags.
 *
 * Defensively handles both array and JSON-string formats for granted_tags/tags,
 * since the database may serialize arrays as JSON strings in some edge cases.
 *
 * @param plan - User's active plan (with granted_tags)
 * @param userCustomization - User's stored tags from user_customization
 * @returns Deduplicated array of tag strings
 */
export function getUserTags(
	plan: PlanWithTags | null,
	userCustomization: UserTagsCustomization | null
): string[] {
	const tags = new Set<string>();

	// Plan-granted tags (e.g., ["tier:free", "tier:pro"])
	const planTags = plan?.granted_tags ? coerceToArray(plan.granted_tags) : null;
	if (planTags) {
		for (const tag of planTags) {
			if (typeof tag === 'string' && tag.includes(':')) {
				tags.add(tag.toLowerCase());
			}
		}
	}

	// Stored user profile tags (e.g., ["geo:in", "role:doctor"])
	const userTags = userCustomization?.tags ? coerceToArray(userCustomization.tags) : null;
	if (userTags) {
		for (const tag of userTags) {
			if (typeof tag === 'string' && tag.includes(':')) {
				tags.add(tag.toLowerCase());
			}
		}
	}

	return [...tags];
}
