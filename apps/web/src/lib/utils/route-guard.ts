/**
 * Route Guard — server-side feature gating for page loads.
 * Throws a 403 error if the required feature flag is not enabled for the user.
 */

import { error } from '@sveltejs/kit';

/** Require a feature flag to be present. Throws 403 if missing. */
export function requireFeature(features: string[], key: string): void {
	if (!features.includes(key)) {
		error(403, `Access denied: feature "${key}" is not enabled for your account.`);
	}
}
