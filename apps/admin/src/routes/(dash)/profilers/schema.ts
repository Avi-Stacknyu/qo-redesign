import { z } from 'zod';
import { ProfilerAgentStatus } from '@repo/db/types';

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

export const profilerAgentSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, 'Name is required'),
	description: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	status: z.nativeEnum(ProfilerAgentStatus).default(ProfilerAgentStatus.active),
	system_prompt: z.string().min(1, 'System prompt is required'),
	model: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	max_tokens: optionalPositiveInt,
	focus_sections: z.string().optional().default('[]'),
	priority: optionalPositiveInt,
	tag_rule: z.string().optional().default('')
});

export type ProfilerAgentSchema = typeof profilerAgentSchema;
