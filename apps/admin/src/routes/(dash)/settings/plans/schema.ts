import { z } from 'zod';

export const planPackageSchema = z.object({
	id: z.string().optional(),
	title: z.string().min(1, 'Title is required'),
	subtitle: z.string().optional(),
	description: z.string().optional(),
	credits: z.string().default('0'),
	type: z.string().min(1, 'Type is required'),
	provider: z.string().min(1, 'Provider is required'),
	product_id: z.string().optional(),
	stripe_price_id: z.string().optional(),
	is_subscription: z.string().default('false'),
	is_active: z.string().default('true'),
	is_archived: z.string().default('false'),
	highlight: z.string().default('false'),
	points: z.string().optional(),
	not_included_points: z.string().optional(),
	allowed_models: z.string().default('[]'),
	allowed_tools: z.string().default('[]'),
	granted_tags: z.string().default('[]'),
	fallback_model: z.string().optional()
});

export type PlanPackageSchema = z.infer<typeof planPackageSchema>;
