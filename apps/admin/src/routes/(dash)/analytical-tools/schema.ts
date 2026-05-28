import { z } from 'zod';

export const toolSchema = z.object({
	id: z.string().optional(),
	tool_key: z.string().min(1, 'Tool key is required'),
	display_name: z.string().min(1, 'Display name is required'),
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
	computation_type: z.string().optional().default('worker'),
	is_active: z.preprocess((v) => v === true || v === 'true', z.boolean()).default(true),
	input_schema: z.string().optional().default('[]'),
	output_config: z.string().optional().default('{}'),
	tag_rule: z.string().optional().default('')
});

export type ToolSchema = typeof toolSchema;
