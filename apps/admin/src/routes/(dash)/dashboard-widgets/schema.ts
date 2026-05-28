import { z } from 'zod';
import { DashboardWidgetDefaultSize } from '@repo/db/types';

export const widgetSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, 'Name is required'),
	widget_type: z.string().min(1, 'Widget type key is required'),
	description: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	category: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	icon: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	base_type: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	default_size: z.nativeEnum(DashboardWidgetDefaultSize).default(DashboardWidgetDefaultSize.md),
	is_active: z.boolean().default(true),
	default_config: z.string().optional().default('{}'),
	locked_config: z.string().optional().default(''),
	tag_rule: z.string().optional().default('')
});

export type WidgetSchema = typeof widgetSchema;
