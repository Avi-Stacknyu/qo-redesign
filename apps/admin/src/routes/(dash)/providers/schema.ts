import { z } from 'zod';

export const aiProviderSchema = z.object({
	id: z.string().optional(),
	provider_key: z.string().min(1, 'Provider key is required'),
	display_name: z.string().min(1, 'Display name is required'),
	env_key_name: z.string().min(1, 'Env key name is required'),
	base_url: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	docs_url: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	website_url: z
		.string()
		.optional()
		.or(z.literal('').transform(() => undefined)),
	default_headers: z
		.string()
		.optional()
		.transform((val) => {
			if (!val || val.trim() === '') return null;
			try {
				return JSON.parse(val);
			} catch {
				return null;
			}
		}),
	is_active: z.boolean().default(true)
});
