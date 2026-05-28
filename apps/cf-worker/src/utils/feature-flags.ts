/**
 * Feature Flag Resolver
 *
 * Evaluates config_feature_flags against a user's effective tags.
 * Returns the list of flag_key strings the user is entitled to.
 *
 * Rules:
 *  - is_enabled = true  → restriction ACTIVE, tag_rule is evaluated
 *  - is_enabled = false → restriction INACTIVE, feature available to everyone
 *  - tag_rule null/empty → available to everyone (when enabled)
 */

import type { TagRule } from '@repo/shared/types';
import { evaluateTagRule } from './tag-rule-engine';

/** Minimal shape needed from a feature flag record. */
type FeatureFlagInput = {
	flagKey: string | null;
	isEnabled: boolean | null;
	tagRule: TagRule | null | unknown;
};

/**
 * Filter feature flags to those available for the given user tags.
 * Pure function — no I/O, just logic.
 *
 * When is_enabled is false, the flag's restriction is bypassed and
 * the feature is available to everyone (kill switch OFF).
 */
export function resolveEnabledFeatures(
	flags: FeatureFlagInput[],
	userTags: string[]
): string[] {
	const result: string[] = [];

	for (const flag of flags) {
		if (!flag.flagKey) continue;
		// Restriction inactive → feature available to everyone
		if (!flag.isEnabled) {
			result.push(flag.flagKey);
			continue;
		}
		// Restriction active → evaluate tag rule
		if (!evaluateTagRule(flag.tagRule as TagRule | null | undefined, userTags)) continue;
		result.push(flag.flagKey);
	}

	return result;
}
