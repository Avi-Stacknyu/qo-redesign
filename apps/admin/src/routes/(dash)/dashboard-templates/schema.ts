import { z } from 'zod';

export const templateSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, 'Name is required'),
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
	is_active: z.preprocess((v) => v === true || v === 'true', z.boolean()).default(true),
	default_widgets: z.string().optional().default('[]'),
	tag_rule: z.string().optional().default('')
});

export type TemplateSchema = typeof templateSchema;
