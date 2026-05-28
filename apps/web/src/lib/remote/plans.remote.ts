import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

type PlanItem = {
	id: string;
	title: string;
	subtitle?: string;
	description?: string;
	credits: number;
	type: string;
	is_subscription?: boolean;
	highlight?: boolean;
	points?: string;
	not_included_points?: string;
};

export type GroupedPlans = {
	subscriptions: PlanItem[];
	topups: PlanItem[];
};

/** Fetch all active plans grouped by type */
export const getAvailablePlans = query(async (): Promise<GroupedPlans> => {
	const { platform } = getRequestEvent();
	if (!platform?.env?.CF_WORKER) {
		return { subscriptions: [], topups: [] };
	}

	const plans = await platform.env.CF_WORKER.getAvailablePlans();

	const subscriptions: PlanItem[] = [];
	const topups: PlanItem[] = [];

	for (const plan of plans) {
		const item: PlanItem = {
			id: plan.id,
			title: plan.title,
			subtitle: plan.subtitle,
			description: plan.description,
			credits: plan.credits,
			type: plan.type,
			is_subscription: plan.isSubscription,
			highlight: plan.highlight,
			points: plan.points,
			not_included_points: plan.notIncludedPoints
		};
		if (plan.isSubscription) {
			subscriptions.push(item);
		} else if (plan.type === 'topup') {
			topups.push(item);
		}
	}

	return { subscriptions, topups };
});

/** Start a Stripe Checkout session for a plan or credit pack */
export const initiateCheckout = command(
	z.object({ packageId: z.string().min(1) }),
	async ({ packageId }) => {
		const { platform, locals } = getRequestEvent();
		if (!locals.user) throw error(401, 'Unauthorized');
		if (!platform?.env?.CF_WORKER) throw error(503, 'Service unavailable');

		const { url } = await platform.env.CF_WORKER.createCheckoutSession({
			userId: locals.user.id,
			packageId
		});
		return { url };
	}
);

/** Open the Stripe Customer Portal for subscription management */
export const initiatePortal = command(async () => {
	const { platform, locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!platform?.env?.CF_WORKER) throw error(503, 'Service unavailable');

	const { url } = await platform.env.CF_WORKER.createPortalSession({
		userId: locals.user.id
	});
	return { url };
});
