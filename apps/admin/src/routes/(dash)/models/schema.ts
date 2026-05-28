import z from 'zod/v4';

const optionalPositiveInt = z
	.union([z.string(), z.number()])
	.optional()
	.transform((value, ctx) => {
		if (value === '' || value === undefined) return undefined;
		const num = typeof value === 'number' ? value : Number(value);
		if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a positive integer' });
			return z.NEVER;
		}
		return num;
	});

const booleanFromForm = (defaultValue: boolean) =>
	z
		.union([z.boolean(), z.string()])
		.optional()
		.transform((value) => {
			if (value === undefined || value === '') return defaultValue;
			return typeof value === 'string' ? value === 'true' : value;
		});

export const aiAgentModelSchema = z.object({
	id: z.string().optional(),
	display_name: z.string().min(1, 'Display name is required'),
	model_id: z.string().min(1, 'Model ID is required'),
	provider: z.string().min(1, 'Provider is required'),
	description: z.string().optional(),
	context_window: optionalPositiveInt,
	max_output_tokens: optionalPositiveInt,
	is_active: booleanFromForm(true),
	is_enabled: booleanFromForm(true),
	is_system_default: booleanFromForm(false),
	supported_tools: z.string().default('[]'),
	options_schema: z.string().optional(),
	default_options: z.string().optional(),
	capabilities: z.string().optional(),
	tag_rule: z.string().optional()
});

export type AiAgentModelSchema = z.infer<typeof aiAgentModelSchema>;
