/**
 * Dashboard page server load.
 * ensureDefaultProfile runs in +layout.server.ts (parent), so we await parent() first
 * to ensure the profile/layout/widgets are created before we try to load them.
 */

import { loadDashboardData } from '$lib/remote/dashboard.remote';

export async function load({ parent }) {
	// Wait for layout to complete — ensures ensureDefaultProfile() has run for new users
	await parent();

	const { layout, widgets } = await loadDashboardData();

	return { layout, widgets };
}
