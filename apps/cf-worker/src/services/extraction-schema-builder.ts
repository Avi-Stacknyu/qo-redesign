import { z } from 'zod/v4';

export interface SchemaField {
	key: string;
	label: string;
	type: 'string' | 'number' | 'boolean' | 'array';
}

export interface SchemaSection {
	sectionId: string;
	fields: SchemaField[];
}

export function buildExtractionSchema(sections: SchemaSection[]) {
	const profileUpdateSchema = z.array(
		z.object({
			sectionId: z.string().min(1),
			sectionLabel: z.string().optional(),
			icon: z.string().optional(),
			order: z.number().optional(),
			fields: z.record(
				z.string(),
				z.object({
					value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
					label: z.string().optional(),
					confidence: z.number().min(0).max(1),
					reasoning: z.string().max(200)
				})
			)
		})
	);

	return z.object({
		profileUpdates: profileUpdateSchema.default([]),
		memoryObservations: z
			.array(
				z.object({
					nodeType: z.enum(['FACT', 'ENTITY', 'TOPIC', 'INSIGHT', 'ACTION_ITEM']),
					groupKey: z.string().optional(),
					title: z.string().optional(),
					text: z.string(),
					category: z.string().optional(),
					data: z.record(z.string(), z.unknown()).default({}),
					confidence: z.number().min(0).max(1),
					visibility: z
						.object({
							shareWithAgent: z.boolean().default(true),
							shareWithManager: z.boolean().default(false),
							shareWithAdmin: z.boolean().default(false)
						})
						.default({
							shareWithAgent: true,
							shareWithManager: false,
							shareWithAdmin: false
						})
				})
			)
			.default([]),
		schemaProposals: z
			.array(
				z.object({
					suggestedKey: z.string(),
					suggestedSection: z.string(),
					label: z.string(),
					reason: z.string(),
					confidence: z.number().min(0).max(1)
				})
			)
			.default([])
	});
}

export type ExtractionSchema = ReturnType<typeof buildExtractionSchema>;
export type ExtractionOutput = z.infer<ExtractionSchema>;
