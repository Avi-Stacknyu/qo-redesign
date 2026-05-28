import type { PageServerLoad } from './$types';
import { dashboardTemplates, dashboardWidgets } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const db = locals.db;

	const [template] = await db
		.select()
		.from(dashboardTemplates)
		.where(eq(dashboardTemplates.id, params.id));

	if (!template) throw error(404, 'Template not found');

	const widgets = await db
		.select()
		.from(dashboardWidgets)
		.where(eq(dashboardWidgets.isActive, true))
		.orderBy(dashboardWidgets.name);

	return { template, widgets };
};
