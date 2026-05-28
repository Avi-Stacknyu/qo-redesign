import { z } from 'zod';
import { AiToolCategory, AiToolType } from '@repo/db/types';

export const toolSchema = z.object({
	id: z.string().optional(),
	display_name: z.string().min(1, 'Display name is required'),
	tool_key: z.string().min(1, 'Tool key is required'),
	description: z.string().optional(),
	category: z
		.nativeEnum(AiToolCategory)
		.optional()
		.or(z.literal('').transform(() => undefined)),
	tool_type: z.nativeEnum(AiToolType),
	sdk_tool_name: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	provider: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	docs_url: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	icon: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	is_active: z.boolean().default(true),
	is_enabled: z.boolean().default(true),
	config_schema: z.string().optional().default('{}'),
	default_config: z.string().optional().default('{}'),
	execution_config: z.string().optional().default('{}')
});

export type ToolSchema = typeof toolSchema;
