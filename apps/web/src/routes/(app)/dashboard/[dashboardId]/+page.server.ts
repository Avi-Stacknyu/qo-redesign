/**
 * Dynamic dashboard page server load.
 * Loads widgets for a specific dashboard (profile) by ID.
 */

import { loadProfileDashboard } from '$lib/remote/dashboard.remote';
import { error } from '@sveltejs/kit';

export async function load({ params, parent }) {
	await parent();

	const { dashboardId } = params;
	if (!dashboardId) throw error(400, 'Missing dashboard ID');

	const { layout, widgets } = await loadProfileDashboard(dashboardId);

	return { layout, widgets, dashboardId };
}
