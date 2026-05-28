import z from 'zod/v4';

// Schema for AI Agent Personality settings
export const aiPersonalitySchema = z.object({
	proactive: z.boolean().default(false),
	use_emojis: z.boolean().default(false),
	ask_clarifications: z.boolean().default(true),
	tone: z.enum(['balanced', 'professional', 'friendly']).default('balanced'),
	response_length: z.enum(['balanced', 'concise', 'detailed']).default('balanced'),
	formality: z.enum(['standard', 'casual', 'formal']).default('standard'),
	explanation_style: z.enum(['mixed', 'technical', 'simple', 'eli5']).default('mixed'),
	custom_prompt: z.string().optional().default('')
});

export type AiPersonality = z.infer<typeof aiPersonalitySchema>;
